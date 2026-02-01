import { FastifyInstance } from "fastify";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { fetchServiceById, addLoyaltyPoints, findClientByPhone, createClient } from "../lib/strapi.js";
import {
  buildSlots,
  buildSlotsFromSchedule,
  WeekSchedule
} from "../lib/availability.js";
import { getBoss } from "../lib/boss.js";
import { sendWhatsAppTemplate } from "../lib/whatsapp.js";

const createSchema = z.object({
  serviceId: z.number(),
  startAt: z.string().datetime(),
  name: z.string().min(2),
  phone: z.string().min(8),
  notes: z.string().optional()
});

const batchCreateSchema = z.object({
  serviceIds: z.array(z.number()).min(1),
  startAt: z.string().datetime(),
  name: z.string().min(2),
  phone: z.string().min(8),
  notes: z.string().optional()
});

// Default slot interval (30 minutes)
const DEFAULT_SLOT_INTERVAL = 30;

// Helper to get global availability schedule
async function getGlobalSchedule(): Promise<{
  schedule: WeekSchedule | null;
  slotIntervalMinutes: number;
}> {
  // Get global schedule from AvailabilitySchedule model
  const globalSchedules = await prisma.availabilitySchedule.findMany({
    include: { timeWindows: true },
    orderBy: { weekday: "asc" }
  });

  if (globalSchedules.length > 0) {
    const schedule: WeekSchedule = Array.from({ length: 7 }, (_, weekday) => {
      const daySchedule = globalSchedules.find((s) => s.weekday === weekday);
      return {
        weekday,
        isAvailable: daySchedule?.isAvailable ?? false,
        timeWindows:
          daySchedule?.timeWindows.map((tw) => ({
            startMinute: tw.startMinute,
            endMinute: tw.endMinute
          })) ?? []
      };
    });
    return { schedule, slotIntervalMinutes: DEFAULT_SLOT_INTERVAL };
  }

  // Fall back to legacy ServiceAvailability model
  const legacyRules = await prisma.serviceAvailability.findMany({
    where: { isActive: true }
  });

  if (legacyRules.length > 0) {
    return { schedule: null, slotIntervalMinutes: legacyRules[0].slotIntervalMinutes };
  }

  return { schedule: null, slotIntervalMinutes: DEFAULT_SLOT_INTERVAL };
}

// Helper to check if a date is blocked
async function isDateBlocked(date: Date): Promise<boolean> {
  const dateOnly = new Date(date.toISOString().slice(0, 10));
  const blocked = await prisma.blockedDate.findFirst({
    where: { date: dateOnly }
  });
  return !!blocked;
}

export const registerAppointmentRoutes = (app: FastifyInstance) => {
  // No authentication required - anyone can book with name + phone
  app.post("/appointments", async (request, reply) => {
    const data = createSchema.parse(request.body);
    const startAt = new Date(data.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return reply.code(400).send({ message: "Invalid start time" });
    }
    if (startAt.getTime() < Date.now()) {
      return reply.code(400).send({ message: "Start time must be in the future" });
    }

    const service = await fetchServiceById(data.serviceId);
    if (!service.durationMinutes) {
      return reply.code(400).send({ message: "Service duration is required" });
    }
    const endAt = addMinutes(startAt, service.durationMinutes);

    const overlap = await prisma.appointment.findFirst({
      where: {
        status: "BOOKED",
        startAt: { lt: endAt },
        endAt: { gt: startAt }
      }
    });

    if (overlap) {
      return reply.code(409).send({ message: "Time slot unavailable" });
    }

    // Check if date is blocked
    const blocked = await isDateBlocked(startAt);
    if (blocked) {
      return reply.code(409).send({ message: "Date is not available for booking" });
    }

    const dateKey = formatInTimeZone(startAt, config.TIMEZONE, "yyyy-MM-dd");
    const dayStartUtc = fromZonedTime(`${dateKey}T00:00:00`, config.TIMEZONE);
    const dayEndUtc = addMinutes(dayStartUtc, 1440);

    const { schedule, slotIntervalMinutes } = await getGlobalSchedule();

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        status: "BOOKED",
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc }
      },
      select: { startAt: true, endAt: true }
    });

    let slots;

    if (schedule) {
      // Use new Calendly-style schedule
      slots = buildSlotsFromSchedule({
        date: dateKey,
        timezone: config.TIMEZONE,
        schedule,
        durationMinutes: service.durationMinutes,
        slotIntervalMinutes,
        existing: existingAppointments
      });
    } else {
      // Fall back to legacy system or defaults
      const legacyRules = await prisma.serviceAvailability.findMany({
        where: { isActive: true }
      });

      const rules =
        legacyRules.length > 0
          ? legacyRules.map((rule) => ({
              weekday: rule.weekday,
              startMinute: rule.startMinute,
              endMinute: rule.endMinute,
              slotIntervalMinutes: rule.slotIntervalMinutes
            }))
          : [1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              startMinute: config.businessStartMin,
              endMinute: config.businessEndMin,
              slotIntervalMinutes
            }));

      slots = buildSlots({
        date: dateKey,
        timezone: config.TIMEZONE,
        rules,
        durationMinutes: service.durationMinutes,
        existing: existingAppointments
      });
    }

    const matchesSlot = slots.some((slot) => slot.startAt.getTime() === startAt.getTime());
    if (!matchesSlot) {
      return reply.code(409).send({ message: "Slot not available" });
    }

    // Normalize phone (remove non-digits)
    const normalizedPhone = data.phone.replace(/\D/g, "");

    // Find or create Strapi client
    let strapiClientId: string | null = null;
    try {
      let strapiClient = await findClientByPhone(normalizedPhone);
      if (!strapiClient) {
        strapiClient = await createClient({
          name: data.name,
          phone: normalizedPhone
        });
      }
      strapiClientId = strapiClient.documentId;
    } catch (error) {
      // Log error but don't fail - continue without Strapi link
      request.log.error({ error }, "Failed to sync with Strapi");
    }

    // Find or create user by phone
    let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: data.name,
          phone: normalizedPhone,
          strapiClientId
        }
      });
    } else if (strapiClientId && !user.strapiClientId) {
      // Link existing user to Strapi client
      user = await prisma.user.update({
        where: { id: user.id },
        data: { strapiClientId }
      });
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        serviceId: data.serviceId,
        serviceName: service.name,
        serviceDurationMin: service.durationMinutes,
        servicePrice: service.price,
        startAt,
        endAt,
        notes: data.notes ?? null
      }
    });

    // Update loyalty points in Strapi if client is linked
    if (user.strapiClientId) {
      try {
        await addLoyaltyPoints(user.strapiClientId, 1);
      } catch (error) {
        // Log error but don't fail the booking
        request.log.error({ error }, "Failed to update loyalty points in Strapi");
      }
    }

    // Send WhatsApp confirmation if configured
    if (config.WHATSAPP_TEMPLATE_CONFIRMATION) {
      const dateLabel = formatInTimeZone(startAt, config.TIMEZONE, "dd/MM/yyyy");
      const timeLabel = formatInTimeZone(startAt, config.TIMEZONE, "HH:mm");
      try {
        await sendWhatsAppTemplate(user.phone, config.WHATSAPP_TEMPLATE_CONFIRMATION, [
          { type: "text", text: user.name },
          { type: "text", text: service.name },
          { type: "text", text: dateLabel },
          { type: "text", text: timeLabel }
        ]);

        await prisma.appointmentEvent.create({
          data: {
            appointmentId: appointment.id,
            type: "CONFIRMATION_SENT"
          }
        });
      } catch (error) {
        request.log.error({ error }, "Failed to send confirmation");
      }
    }

    // Schedule reminder
    const reminderAt = addMinutes(startAt, -24 * 60);
    if (reminderAt.getTime() > Date.now()) {
      const boss = getBoss();
      await boss.send(
        "appointment-reminder",
        { appointmentId: appointment.id },
        { startAfter: reminderAt }
      );
    }

    return {
      appointment
    };
  });

  // Batch create appointments for multiple services
  app.post("/appointments/batch", async (request, reply) => {
    const data = batchCreateSchema.parse(request.body);
    const initialStartAt = new Date(data.startAt);
    
    if (Number.isNaN(initialStartAt.getTime())) {
      return reply.code(400).send({ message: "Invalid start time" });
    }
    if (initialStartAt.getTime() < Date.now()) {
      return reply.code(400).send({ message: "Start time must be in the future" });
    }

    // Fetch all services first
    const services = await Promise.all(
      data.serviceIds.map((id) => fetchServiceById(id))
    );

    // Validate all services have duration
    for (const service of services) {
      if (!service.durationMinutes) {
        return reply.code(400).send({ message: `Service ${service.name} has no duration` });
      }
    }

    // Calculate total duration and check initial slot
    const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const finalEndAt = addMinutes(initialStartAt, totalDuration);

    // Check for any overlapping appointments for the entire time block
    const overlap = await prisma.appointment.findFirst({
      where: {
        status: "BOOKED",
        startAt: { lt: finalEndAt },
        endAt: { gt: initialStartAt }
      }
    });

    if (overlap) {
      return reply.code(409).send({ message: "Time slot unavailable" });
    }

    // Check if date is blocked
    const blocked = await isDateBlocked(initialStartAt);
    if (blocked) {
      return reply.code(409).send({ message: "Date is not available for booking" });
    }

    // Validate the initial slot is available using TOTAL duration of all services
    const dateKey = formatInTimeZone(initialStartAt, config.TIMEZONE, "yyyy-MM-dd");
    const dayStartUtc = fromZonedTime(`${dateKey}T00:00:00`, config.TIMEZONE);
    const dayEndUtc = addMinutes(dayStartUtc, 1440);

    const { schedule, slotIntervalMinutes } = await getGlobalSchedule();

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        status: "BOOKED",
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc }
      },
      select: { startAt: true, endAt: true }
    });

    let slots;

    if (schedule) {
      // Use total duration to check if entire block fits within schedule
      slots = buildSlotsFromSchedule({
        date: dateKey,
        timezone: config.TIMEZONE,
        schedule,
        durationMinutes: totalDuration,
        slotIntervalMinutes,
        existing: existingAppointments
      });
    } else {
      const legacyRules = await prisma.serviceAvailability.findMany({
        where: { isActive: true }
      });

      const rules =
        legacyRules.length > 0
          ? legacyRules.map((rule) => ({
              weekday: rule.weekday,
              startMinute: rule.startMinute,
              endMinute: rule.endMinute,
              slotIntervalMinutes: rule.slotIntervalMinutes
            }))
          : [1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              startMinute: config.businessStartMin,
              endMinute: config.businessEndMin,
              slotIntervalMinutes
            }));

      slots = buildSlots({
        date: dateKey,
        timezone: config.TIMEZONE,
        rules,
        durationMinutes: totalDuration,
        existing: existingAppointments
      });
    }

    const matchesSlot = slots.some((slot) => slot.startAt.getTime() === initialStartAt.getTime());
    if (!matchesSlot) {
      return reply.code(409).send({ message: "Slot not available" });
    }

    // Normalize phone
    const normalizedPhone = data.phone.replace(/\D/g, "");

    // Find or create Strapi client
    let strapiClientId: string | null = null;
    try {
      let strapiClient = await findClientByPhone(normalizedPhone);
      if (!strapiClient) {
        strapiClient = await createClient({
          name: data.name,
          phone: normalizedPhone
        });
      }
      strapiClientId = strapiClient.documentId;
    } catch (error) {
      request.log.error({ error }, "Failed to sync with Strapi");
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: data.name,
          phone: normalizedPhone,
          strapiClientId
        }
      });
    } else if (strapiClientId && !user.strapiClientId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { strapiClientId }
      });
    }

    // Create appointments sequentially
    const appointments = [];
    let currentStartAt = initialStartAt;

    for (const service of services) {
      const endAt = addMinutes(currentStartAt, service.durationMinutes);
      
      const appointment = await prisma.appointment.create({
        data: {
          userId: user.id,
          serviceId: service.id,
          serviceName: service.name,
          serviceDurationMin: service.durationMinutes,
          servicePrice: service.price,
          startAt: currentStartAt,
          endAt,
          notes: data.notes ?? null
        }
      });

      appointments.push(appointment);
      currentStartAt = endAt; // Next service starts when this one ends
    }

    // Update loyalty points (once for all services)
    if (user.strapiClientId) {
      try {
        await addLoyaltyPoints(user.strapiClientId, services.length);
      } catch (error) {
        request.log.error({ error }, "Failed to update loyalty points in Strapi");
      }
    }

    // Send WhatsApp confirmation for the batch
    if (config.WHATSAPP_TEMPLATE_CONFIRMATION) {
      const dateLabel = formatInTimeZone(initialStartAt, config.TIMEZONE, "dd/MM/yyyy");
      const timeLabel = formatInTimeZone(initialStartAt, config.TIMEZONE, "HH:mm");
      const serviceNames = services.map(s => s.name).join(", ");
      
      try {
        await sendWhatsAppTemplate(user.phone, config.WHATSAPP_TEMPLATE_CONFIRMATION, [
          { type: "text", text: user.name },
          { type: "text", text: serviceNames },
          { type: "text", text: dateLabel },
          { type: "text", text: timeLabel }
        ]);

        // Log confirmation for first appointment
        await prisma.appointmentEvent.create({
          data: {
            appointmentId: appointments[0].id,
            type: "CONFIRMATION_SENT"
          }
        });
      } catch (error) {
        request.log.error({ error }, "Failed to send confirmation");
      }
    }

    // Schedule reminder for first appointment
    const reminderAt = addMinutes(initialStartAt, -24 * 60);
    if (reminderAt.getTime() > Date.now()) {
      const boss = getBoss();
      await boss.send(
        "appointment-reminder",
        { appointmentId: appointments[0].id },
        { startAfter: reminderAt }
      );
    }

    return {
      appointments
    };
  });

  // Admin-only: cancel an appointment
  app.post("/appointments/:id/cancel", { preHandler: app.authenticate }, async (request, reply) => {
    // Only admins can cancel appointments
    if (request.user.role !== "ADMIN") {
      return reply.code(403).send({ message: "Admin access required" });
    }

    const appointmentId = (request.params as { id: string }).id;
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });

    if (!appointment) {
      return reply.code(404).send({ message: "Appointment not found" });
    }

    if (appointment.status === "CANCELLED") {
      return { appointment };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED" }
    });

    await prisma.appointmentEvent.create({
      data: {
        appointmentId,
        type: "CANCELLED"
      }
    });

    return { appointment: updated };
  });
};
