import { FastifyInstance } from "fastify";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "../lib/db.js";
import {
  addLoyaltyPoints,
  setLoyaltyPoints,
  subtractLoyaltyPoints,
  fetchServiceById,
  findClientByPhone,
  createClient
} from "../lib/strapi.js";

// Legacy schema for backwards compatibility
const availabilitySchema = z.object({
  serviceId: z.number(),
  rules: z
    .array(
      z.object({
        weekday: z.number().min(0).max(6),
        startMinute: z.number().min(0).max(1440),
        endMinute: z.number().min(0).max(1440),
        slotIntervalMinutes: z.number().min(5).max(240)
      })
    )
    .min(1)
});

// New Calendly-style schedule schema
const scheduleSchema = z.object({
  days: z.array(
    z.object({
      weekday: z.number().min(0).max(6),
      isAvailable: z.boolean(),
      timeWindows: z.array(
        z.object({
          startMinute: z.number().min(0).max(1440),
          endMinute: z.number().min(0).max(1440)
        })
      )
    })
  )
});

const loyaltySchema = z.object({
  phone: z.string().min(8),
  points: z.number().int(),
  reason: z.string().min(2)
});

// Admin appointment schemas
const adminCreateAppointmentSchema = z.object({
  serviceId: z.number(),
  startAt: z.string().datetime(),
  name: z.string().min(2),
  phone: z.string().min(8),
  notes: z.string().optional(),
  durationMinutes: z.number().min(15).optional() // Override service duration if needed
});

const adminUpdateAppointmentSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  notes: z.string().optional()
});

export const registerAdminRoutes = (app: FastifyInstance) => {
  app.get("/admin/agenda", { preHandler: app.requireAdmin }, async (request) => {
    const query = request.query as { from?: string; to?: string };

    const where = query.from && query.to
      ? {
          startAt: {
            gte: new Date(query.from),
            lte: new Date(query.to)
          }
        }
      : undefined;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startAt: "asc" },
      include: {
        user: true
      }
    });

    return { appointments };
  });

  app.get("/admin/calendar", { preHandler: app.requireAdmin }, async () => {
    const appointments = await prisma.appointment.findMany({
      orderBy: { startAt: "asc" },
      include: { user: true }
    });

    return { appointments };
  });

  app.get("/admin/availability", { preHandler: app.requireAdmin }, async (request, reply) => {
    const serviceId = Number((request.query as { serviceId?: string }).serviceId);
    if (!serviceId) {
      return reply.code(400).send({ message: "serviceId is required" });
    }

    const rules = await prisma.serviceAvailability.findMany({
      where: { serviceId, isActive: true },
      orderBy: { weekday: "asc" }
    });

    return { rules };
  });

  // Legacy endpoint - kept for backwards compatibility
  app.post("/admin/availability", { preHandler: app.requireAdmin }, async (request) => {
    const data = availabilitySchema.parse(request.body);

    await prisma.$transaction(async (tx) => {
      await tx.serviceAvailability.deleteMany({
        where: { serviceId: data.serviceId }
      });

      await tx.serviceAvailability.createMany({
        data: data.rules.map((rule) => ({
          serviceId: data.serviceId,
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
          slotIntervalMinutes: rule.slotIntervalMinutes,
          isActive: true
        }))
      });
    });

    return { ok: true };
  });

  // ============================================
  // Global availability endpoints
  // ============================================

  // Get global availability schedule
  app.get("/admin/availability/global", { preHandler: app.requireAdmin }, async () => {
    const schedules = await prisma.availabilitySchedule.findMany({
      include: { timeWindows: true },
      orderBy: { weekday: "asc" }
    });

    // Transform to frontend-friendly format
    const days = Array.from({ length: 7 }, (_, weekday) => {
      const schedule = schedules.find((s) => s.weekday === weekday);
      return {
        weekday,
        isAvailable: schedule?.isAvailable ?? false,
        timeWindows: schedule?.timeWindows.map((tw) => ({
          startMinute: tw.startMinute,
          endMinute: tw.endMinute
        })) ?? []
      };
    });

    return { days };
  });

  // Save global availability schedule
  app.post("/admin/availability/global", { preHandler: app.requireAdmin }, async (request) => {
    const data = scheduleSchema.parse(request.body);

    await prisma.$transaction(async (tx) => {
      // Delete existing schedules and their time windows (cascade)
      await tx.availabilitySchedule.deleteMany();

      // Create new schedules with time windows
      for (const day of data.days) {
        const schedule = await tx.availabilitySchedule.create({
          data: {
            weekday: day.weekday,
            isAvailable: day.isAvailable
          }
        });

        if (day.timeWindows.length > 0) {
          await tx.availabilityTimeWindow.createMany({
            data: day.timeWindows.map((tw) => ({
              scheduleId: schedule.id,
              startMinute: tw.startMinute,
              endMinute: tw.endMinute
            }))
          });
        }
      }
    });

    return { ok: true };
  });

  // ============================================
  // Blocked dates endpoints
  // ============================================

  // Get all blocked dates
  app.get("/admin/availability/blocked-dates", { preHandler: app.requireAdmin }, async () => {
    const blockedDates = await prisma.blockedDate.findMany({
      orderBy: { date: "asc" }
    });

    return {
      blockedDates: blockedDates.map((bd) => ({
        id: bd.id,
        date: bd.date.toISOString().slice(0, 10), // Return as YYYY-MM-DD
        reason: bd.reason
      }))
    };
  });

  // Add a blocked date
  app.post("/admin/availability/blocked-dates", { preHandler: app.requireAdmin }, async (request, reply) => {
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().optional()
    });

    const data = schema.parse(request.body);

    // Check if date already exists
    const existing = await prisma.blockedDate.findFirst({
      where: { date: new Date(data.date) }
    });

    if (existing) {
      return reply.code(409).send({ message: "Date is already blocked" });
    }

    const blockedDate = await prisma.blockedDate.create({
      data: {
        date: new Date(data.date),
        reason: data.reason
      }
    });

    return {
      ok: true,
      blockedDate: {
        id: blockedDate.id,
        date: blockedDate.date.toISOString().slice(0, 10),
        reason: blockedDate.reason
      }
    };
  });

  // Delete a blocked date
  app.delete("/admin/availability/blocked-dates/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.blockedDate.delete({
        where: { id }
      });
      return { ok: true };
    } catch {
      return reply.code(404).send({ message: "Blocked date not found" });
    }
  });

  // Migrate legacy ServiceAvailability to new global AvailabilitySchedule
  app.post("/admin/availability/migrate", { preHandler: app.requireAdmin }, async () => {
    // Check if new schedules already exist
    const existingSchedules = await prisma.availabilitySchedule.count();
    if (existingSchedules > 0) {
      return {
        ok: false,
        message: "Migration skipped: new schedules already exist",
        existingCount: existingSchedules
      };
    }

    // Get all legacy rules (use the first service's rules as global)
    const legacyRules = await prisma.serviceAvailability.findMany({
      where: { isActive: true },
      orderBy: [{ weekday: "asc" }]
    });

    if (legacyRules.length === 0) {
      // Create default global schedule
      for (let weekday = 0; weekday < 7; weekday++) {
        const isWorkday = weekday >= 1 && weekday <= 6;
        await prisma.availabilitySchedule.create({
          data: {
            weekday,
            isAvailable: isWorkday,
            timeWindows: isWorkday
              ? { create: [{ startMinute: 540, endMinute: 1140 }] }
              : undefined
          }
        });
      }
      return {
        ok: true,
        message: "No legacy rules found. Created default global schedule."
      };
    }

    // Group rules by weekday (merge all services into global)
    const rulesByWeekday = new Map<number, typeof legacyRules>();
    for (const rule of legacyRules) {
      const existing = rulesByWeekday.get(rule.weekday) ?? [];
      existing.push(rule);
      rulesByWeekday.set(rule.weekday, existing);
    }

    // Create global schedule from merged rules
    for (let weekday = 0; weekday < 7; weekday++) {
      const dayRules = rulesByWeekday.get(weekday) ?? [];
      // Use the first rule's time window if any exist for this day
      const firstRule = dayRules[0];
      await prisma.availabilitySchedule.create({
        data: {
          weekday,
          isAvailable: dayRules.length > 0,
          timeWindows: firstRule
            ? { create: [{ startMinute: firstRule.startMinute, endMinute: firstRule.endMinute }] }
            : undefined
        }
      });
    }

    return {
      ok: true,
      message: "Migration complete - created global schedule from legacy rules",
      totalRules: legacyRules.length
    };
  });

  app.post("/admin/loyalty/adjust", { preHandler: app.requireAdmin }, async (request, reply) => {
    const data = loyaltySchema.parse(request.body);

    // Normalize phone (remove non-digits)
    const normalizedPhone = data.phone.replace(/\D/g, "");

    // Find the user by phone and their Strapi client link
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone }
    });

    if (!user) {
      return reply.code(404).send({ message: "Cliente não encontrado com este telefone" });
    }

    if (!user.strapiClientId) {
      return reply.code(400).send({ message: "Cliente não está vinculado ao Strapi" });
    }

    // Set loyalty points in Strapi (replace, not add)
    await setLoyaltyPoints(user.strapiClientId, data.points);

    return { ok: true };
  });

  // ============================================
  // Admin appointment management endpoints
  // ============================================

  // Get all users for selection dropdown
  app.get("/admin/users", { preHandler: app.requireAdmin }, async () => {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true
      }
    });

    return { users };
  });

  // Create appointment on behalf of a user (admin only)
  app.post("/admin/appointments", { preHandler: app.requireAdmin }, async (request, reply) => {
    const data = adminCreateAppointmentSchema.parse(request.body);
    const startAt = new Date(data.startAt);

    if (Number.isNaN(startAt.getTime())) {
      return reply.code(400).send({ message: "Invalid start time" });
    }

    // Fetch service details from Strapi
    const service = await fetchServiceById(data.serviceId);
    if (!service.durationMinutes && !data.durationMinutes) {
      return reply.code(400).send({ message: "Service duration is required" });
    }

    const durationMinutes = data.durationMinutes ?? service.durationMinutes;
    const endAt = addMinutes(startAt, durationMinutes);

    // Check for overlapping appointments
    const overlap = await prisma.appointment.findFirst({
      where: {
        status: "BOOKED",
        startAt: { lt: endAt },
        endAt: { gt: startAt }
      }
    });

    if (overlap) {
      return reply.code(409).send({ message: "Time slot unavailable - overlaps with existing appointment" });
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
        serviceDurationMin: durationMinutes,
        servicePrice: service.price,
        startAt,
        endAt,
        notes: data.notes ?? null
      },
      include: { user: true }
    });

    // Update loyalty points in Strapi if client is linked
    if (user.strapiClientId) {
      try {
        await addLoyaltyPoints(user.strapiClientId, 1);
      } catch (error) {
        request.log.error({ error }, "Failed to update loyalty points in Strapi");
      }
    }

    return { appointment };
  });

  // Update appointment (reschedule or change duration)
  app.patch("/admin/appointments/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = adminUpdateAppointmentSchema.parse(request.body);

    // Find existing appointment
    const existing = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Appointment not found" });
    }

    if (existing.status === "CANCELLED") {
      return reply.code(400).send({ message: "Cannot update a cancelled appointment" });
    }

    // Calculate new times
    const newStartAt = data.startAt ? new Date(data.startAt) : existing.startAt;
    let newEndAt: Date;

    if (data.endAt) {
      newEndAt = new Date(data.endAt);
    } else if (data.startAt) {
      // If only startAt changed, maintain the same duration
      const durationMs = existing.endAt.getTime() - existing.startAt.getTime();
      newEndAt = new Date(newStartAt.getTime() + durationMs);
    } else {
      newEndAt = existing.endAt;
    }

    // Validate times
    if (newEndAt <= newStartAt) {
      return reply.code(400).send({ message: "End time must be after start time" });
    }

    // Check for overlapping appointments (excluding this one)
    const overlap = await prisma.appointment.findFirst({
      where: {
        id: { not: id },
        status: "BOOKED",
        startAt: { lt: newEndAt },
        endAt: { gt: newStartAt }
      }
    });

    if (overlap) {
      return reply.code(409).send({ message: "Time slot unavailable - overlaps with existing appointment" });
    }

    // Calculate new duration in minutes
    const newDurationMin = Math.round((newEndAt.getTime() - newStartAt.getTime()) / (1000 * 60));

    // Update appointment
    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        startAt: newStartAt,
        endAt: newEndAt,
        serviceDurationMin: newDurationMin,
        notes: data.notes !== undefined ? data.notes : undefined
      },
      include: { user: true }
    });

    return { appointment };
  });

  // Delete appointment and deduct loyalty points
  app.delete("/admin/appointments/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Find appointment with user data
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!appointment) {
      return reply.code(404).send({ message: "Appointment not found" });
    }

    // Deduct loyalty points if user has Strapi client link and appointment was BOOKED
    if (appointment.status === "BOOKED" && appointment.user.strapiClientId) {
      try {
        await subtractLoyaltyPoints(appointment.user.strapiClientId, 1);
      } catch (error) {
        request.log.error({ error }, "Failed to deduct loyalty points in Strapi");
      }
    }

    // Delete the appointment
    await prisma.appointment.delete({
      where: { id }
    });

    return { ok: true };
  });
};
