import { FastifyInstance } from "fastify";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { 
  fetchServiceById, 
  fetchActivePromotionPrice,
  addLoyaltyPoints, 
  findClientByPhone, 
  createClient,
  fetchNotificationSettings,
  fetchContactInfo,
  type NotificationSettings,
  type ContactInfo
} from "../lib/strapi.js";
import {
  buildSlots,
  buildSlotsFromSchedule,
  WeekSchedule
} from "../lib/availability.js";
import { getBoss } from "../lib/boss.js";
import { queueWhatsAppMessage } from "../lib/whatsapp.js";

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

// Brazil country code
const BRAZIL_COUNTRY_CODE = "55";

/**
 * Normalize phone number: remove non-digits and add Brazil country code if needed.
 * Users enter DDD + number (e.g., 27996975347), we prepend 55 for WhatsApp.
 */
function normalizePhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  
  // If already starts with 55 and has the right length (13 digits for mobile), keep as is
  if (digitsOnly.startsWith(BRAZIL_COUNTRY_CODE) && digitsOnly.length >= 12) {
    return digitsOnly;
  }
  
  // Otherwise, prepend Brazil country code
  return `${BRAZIL_COUNTRY_CODE}${digitsOnly}`;
}

// Helper to compose WhatsApp confirmation message from template
type ComposeMessageParams = {
  template: string;
  name: string;
  services: string;
  date: string;
  time: string;
  totalDuration: number;
  totalPrice: number;
};

function composeMessage(params: ComposeMessageParams): string {
  const { template, name, services, date, time, totalDuration, totalPrice } = params;
  
  return template
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{services\}\}/g, services)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{totalDuration\}\}/g, String(totalDuration))
    .replace(/\{\{totalPrice\}\}/g, totalPrice.toFixed(2).replace(".", ","));
}

// Helper to queue WhatsApp confirmation via Baileys worker
async function queueConfirmationMessage(params: {
  phone: string;
  userName: string;
  services: Array<{ name: string; durationMinutes: number; price: number }>;
  startAt: Date;
  endAt: Date;
  appointmentId: string;
  notificationSettings: NotificationSettings | null;
  contactInfo: ContactInfo | null;
  log: { info: (msg: any, ...args: any[]) => void; error: (msg: any, ...args: any[]) => void };
}): Promise<void> {
  const { phone, userName, services, startAt, endAt, appointmentId, notificationSettings, contactInfo, log } = params;

  if (!notificationSettings?.confirmationMessageTemplate) {
    log.info("No confirmation template configured, skipping WhatsApp");
    return;
  }

  const dateLabel = formatInTimeZone(startAt, config.TIMEZONE, "dd/MM/yyyy");
  const timeLabel = formatInTimeZone(startAt, config.TIMEZONE, "HH:mm");
  const serviceNames = services.map(s => s.name).join(", ");
  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

  // Compose text message (clean, no URLs)
  const message = composeMessage({
    template: notificationSettings.confirmationMessageTemplate,
    name: userName,
    services: serviceNames,
    date: dateLabel,
    time: timeLabel,
    totalDuration,
    totalPrice
  });

  // Build location data for native WhatsApp location message
  const locationData = notificationSettings.businessLatitude && notificationSettings.businessLongitude
    ? {
        latitude: Number(notificationSettings.businessLatitude),
        longitude: Number(notificationSettings.businessLongitude),
        name: notificationSettings.businessName,
        address: contactInfo?.address ?? ""
      }
    : undefined;

  // Build calendar data for .ics file attachment
  const calendarData = {
    title: `Agendamento - ${notificationSettings.businessName}`,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    location: contactInfo?.address ?? undefined,
    description: `Procedimentos: ${serviceNames}`,
    timezone: config.TIMEZONE,
    caption: notificationSettings.calendarCaption ?? undefined
  };

  // Queue for async send via Baileys worker
  await queueWhatsAppMessage({
    phone,
    message,
    appointmentId,
    eventType: "CONFIRMATION_SENT",
    location: locationData,
    calendar: calendarData
  });
  log.info({ phone, appointmentId }, "WhatsApp confirmation queued");
}

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

    // Normalize phone (remove non-digits and add country code)
    const normalizedPhone = normalizePhoneNumber(data.phone);
    request.log.info({ originalPhone: data.phone, normalizedPhone }, "Phone normalization");

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

    // Check for active promotion price
    const promoPrice = await fetchActivePromotionPrice(data.serviceId);
    const effectivePrice = promoPrice ?? service.price;

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        serviceId: data.serviceId,
        serviceName: service.name,
        serviceDurationMin: service.durationMinutes,
        servicePrice: effectivePrice,
        serviceCost: service.cost,
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

    // Queue WhatsApp confirmation via Baileys worker
    try {
      const [notificationSettings, contactInfo] = await Promise.all([
        fetchNotificationSettings(),
        fetchContactInfo()
      ]);

      await queueConfirmationMessage({
        phone: user.phone,
        userName: user.name,
        services: [{ name: service.name, durationMinutes: service.durationMinutes, price: effectivePrice }],
        startAt,
        endAt,
        appointmentId: appointment.id,
        notificationSettings,
        contactInfo,
        log: request.log
      });
    } catch (error) {
      request.log.error({ error }, "Failed to queue confirmation");
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

    // Normalize phone (remove non-digits and add country code)
    const normalizedPhone = normalizePhoneNumber(data.phone);

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
    const servicesWithPrices: Array<{ name: string; durationMinutes: number; price: number }> = [];
    let currentStartAt = initialStartAt;

    for (const service of services) {
      const endAt = addMinutes(currentStartAt, service.durationMinutes);
      
      // Check for active promotion price
      const svcPromoPrice = await fetchActivePromotionPrice(service.id);
      const svcEffectivePrice = svcPromoPrice ?? service.price;

      const appointment = await prisma.appointment.create({
        data: {
          userId: user.id,
          serviceId: service.id,
          serviceName: service.name,
          serviceDurationMin: service.durationMinutes,
          servicePrice: svcEffectivePrice,
          serviceCost: service.cost,
          startAt: currentStartAt,
          endAt,
          notes: data.notes ?? null
        }
      });

      appointments.push(appointment);
      servicesWithPrices.push({ name: service.name, durationMinutes: service.durationMinutes, price: svcEffectivePrice });
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

    // Queue WhatsApp confirmation for the batch via Baileys worker
    try {
      const [notificationSettings, contactInfo] = await Promise.all([
        fetchNotificationSettings(),
        fetchContactInfo()
      ]);

      await queueConfirmationMessage({
        phone: user.phone,
        userName: user.name,
        services: servicesWithPrices,
        startAt: initialStartAt,
        endAt: finalEndAt,
        appointmentId: appointments[0].id,
        notificationSettings,
        contactInfo,
        log: request.log
      });
    } catch (error) {
      request.log.error({ error }, "Failed to queue confirmation");
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
