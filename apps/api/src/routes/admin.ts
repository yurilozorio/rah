import { FastifyInstance } from "fastify";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Prisma } from "@rah/db";
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import {
  addLoyaltyPoints,
  setLoyaltyPoints,
  subtractLoyaltyPoints,
  fetchServiceById,
  fetchActivePromotionPrice,
  fetchAllServices,
  fetchNotificationSettings,
  findClientByPhone,
  createClient
} from "../lib/strapi.js";
import { queueWhatsAppMessage } from "../lib/whatsapp.js";

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
        user: true,
        payments: true
      }
    });

    return { appointments };
  });

  app.get("/admin/calendar", { preHandler: app.requireAdmin }, async () => {
    const appointments = await prisma.appointment.findMany({
      orderBy: { startAt: "asc" },
      include: { user: true, payments: true }
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

    // Check for active promotion price
    const promoPrice = await fetchActivePromotionPrice(data.serviceId);
    const effectivePrice = promoPrice ?? service.price;

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        serviceId: data.serviceId,
        serviceName: service.name,
        serviceDurationMin: durationMinutes,
        servicePrice: effectivePrice,
        serviceCost: service.cost,
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

    // Delete the appointment and all related records
    await prisma.$transaction(async (tx) => {
      await tx.appointmentEvent.deleteMany({ where: { appointmentId: id } });
      await tx.payment.deleteMany({ where: { appointmentId: id } });
      await tx.appointment.delete({ where: { id } });
    });

    return { ok: true };
  });

  // ============================================
  // Mark appointment as DONE
  // ============================================

  const markDoneSchema = z.object({
    amountReceived: z.number().min(0),
    payments: z.array(
      z.object({
        method: z.string().min(1),
        amount: z.number().min(0),
        installments: z.number().int().min(1).default(1)
      })
    ).min(1)
  });

  app.patch("/admin/appointments/:id/done", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = markDoneSchema.parse(request.body);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!appointment) {
      return reply.code(404).send({ message: "Appointment not found" });
    }

    if (appointment.status === "CANCELLED") {
      return reply.code(400).send({ message: "Cannot mark a cancelled appointment as done" });
    }

    if (appointment.status === "DONE") {
      return reply.code(400).send({ message: "Appointment is already marked as done" });
    }

    // Validate that payment amounts sum to amountReceived
    const paymentTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paymentTotal - data.amountReceived) > 0.01) {
      return reply.code(400).send({
        message: "Sum of payment amounts must equal amountReceived"
      });
    }

    // Update appointment and create payment records in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const apt = await tx.appointment.update({
        where: { id },
        data: {
          status: "DONE",
          amountReceived: new Prisma.Decimal(data.amountReceived)
        },
        include: { user: true }
      });

      // Create payment records
      await tx.payment.createMany({
        data: data.payments.map((p) => ({
          appointmentId: id,
          method: p.method,
          amount: new Prisma.Decimal(p.amount),
          installments: p.installments
        }))
      });

      // Log the event
      await tx.appointmentEvent.create({
        data: {
          appointmentId: id,
          type: "DONE"
        }
      });

      return apt;
    });

    // Send WhatsApp completion message
    try {
      const notificationSettings = await fetchNotificationSettings();
      if (notificationSettings?.completionMessageTemplate) {
        const dateLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "dd/MM/yyyy");
        const timeLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "HH:mm");

        const message = notificationSettings.completionMessageTemplate
          .replace(/\{\{name\}\}/g, appointment.user.name)
          .replace(/\{\{services\}\}/g, appointment.serviceName)
          .replace(/\{\{date\}\}/g, dateLabel)
          .replace(/\{\{time\}\}/g, timeLabel);

        await queueWhatsAppMessage({
          phone: appointment.user.phone,
          message,
          appointmentId: appointment.id,
          eventType: "DONE"
        });
      }
    } catch (error) {
      request.log.error({ error }, "Failed to queue completion WhatsApp message");
    }

    return { appointment: updated };
  });

  // ============================================
  // Mark appointment as CANCELLED (distinct from DELETE)
  // ============================================

  app.patch("/admin/appointments/:id/cancel", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!appointment) {
      return reply.code(404).send({ message: "Appointment not found" });
    }

    if (appointment.status === "CANCELLED") {
      return reply.code(400).send({ message: "Appointment is already cancelled" });
    }

    if (appointment.status === "DONE") {
      return reply.code(400).send({ message: "Cannot cancel a completed appointment" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const apt = await tx.appointment.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { user: true }
      });

      await tx.appointmentEvent.create({
        data: {
          appointmentId: id,
          type: "CANCELLED"
        }
      });

      return apt;
    });

    // Deduct loyalty points
    if (appointment.user.strapiClientId) {
      try {
        await subtractLoyaltyPoints(appointment.user.strapiClientId, 1);
      } catch (error) {
        request.log.error({ error }, "Failed to deduct loyalty points in Strapi");
      }
    }

    // Send WhatsApp cancellation message
    try {
      const notificationSettings = await fetchNotificationSettings();
      if (notificationSettings?.cancellationMessageTemplate) {
        const dateLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "dd/MM/yyyy");
        const timeLabel = formatInTimeZone(appointment.startAt, config.TIMEZONE, "HH:mm");

        const message = notificationSettings.cancellationMessageTemplate
          .replace(/\{\{name\}\}/g, appointment.user.name)
          .replace(/\{\{services\}\}/g, appointment.serviceName)
          .replace(/\{\{date\}\}/g, dateLabel)
          .replace(/\{\{time\}\}/g, timeLabel);

        await queueWhatsAppMessage({
          phone: appointment.user.phone,
          message,
          appointmentId: appointment.id,
          eventType: "CANCELLED"
        });
      }
    } catch (error) {
      request.log.error({ error }, "Failed to queue cancellation WhatsApp message");
    }

    return { appointment: updated };
  });

  // ============================================
  // Revert appointment to BOOKED
  // ============================================

  app.patch("/admin/appointments/:id/revert", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true, payments: true }
    });

    if (!appointment) {
      return reply.code(404).send({ message: "Appointment not found" });
    }

    if (appointment.status === "BOOKED") {
      return reply.code(400).send({ message: "Appointment is already active" });
    }

    const wasDone = appointment.status === "DONE";

    const updated = await prisma.$transaction(async (tx) => {
      // If reverting from DONE, delete payment records and clear amount
      if (wasDone) {
        await tx.payment.deleteMany({ where: { appointmentId: id } });
      }

      const apt = await tx.appointment.update({
        where: { id },
        data: {
          status: "BOOKED",
          amountReceived: null
        },
        include: { user: true, payments: true }
      });

      await tx.appointmentEvent.create({
        data: {
          appointmentId: id,
          type: "REBOOKED"
        }
      });

      return apt;
    });

    // If reverting from CANCELLED, re-add loyalty point
    if (!wasDone && appointment.user.strapiClientId) {
      try {
        await addLoyaltyPoints(appointment.user.strapiClientId, 1);
      } catch (error) {
        request.log.error({ error }, "Failed to re-add loyalty points in Strapi");
      }
    }

    return { appointment: updated };
  });

  // ============================================
  // Financial data endpoints
  // ============================================

  const financialQuerySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  });

  // Financial summary - totals for a period
  app.get("/admin/financial/summary", { preHandler: app.requireAdmin }, async (request) => {
    const query = financialQuerySchema.parse(request.query);
    const fromDate = new Date(`${query.from}T00:00:00`);
    const toDate = new Date(`${query.to}T23:59:59`);

    // Get all DONE appointments in the period
    const appointments = await prisma.appointment.findMany({
      where: {
        status: "DONE",
        startAt: { gte: fromDate, lte: toDate }
      },
      include: { payments: true }
    });

    const totalRevenue = appointments.reduce(
      (sum, a) => sum + Number(a.amountReceived ?? 0),
      0
    );

    const totalCost = appointments.reduce(
      (sum, a) => sum + (a.serviceCost ?? 0),
      0
    );

    const appointmentCount = appointments.length;
    const profit = totalRevenue - totalCost;

    return {
      from: query.from,
      to: query.to,
      totalRevenue,
      totalCost,
      profit,
      appointmentCount
    };
  });

  // Financial data grouped by service
  app.get("/admin/financial/by-service", { preHandler: app.requireAdmin }, async (request) => {
    const query = financialQuerySchema.parse(request.query);
    const fromDate = new Date(`${query.from}T00:00:00`);
    const toDate = new Date(`${query.to}T23:59:59`);

    const appointments = await prisma.appointment.findMany({
      where: {
        status: "DONE",
        startAt: { gte: fromDate, lte: toDate }
      }
    });

    const byService = new Map<string, { serviceName: string; serviceId: number; revenue: number; cost: number; count: number }>();

    for (const apt of appointments) {
      const key = apt.serviceName;
      const existing = byService.get(key) ?? {
        serviceName: apt.serviceName,
        serviceId: apt.serviceId,
        revenue: 0,
        cost: 0,
        count: 0
      };
      existing.revenue += Number(apt.amountReceived ?? 0);
      existing.cost += apt.serviceCost ?? 0;
      existing.count += 1;
      byService.set(key, existing);
    }

    return {
      from: query.from,
      to: query.to,
      data: Array.from(byService.values()).sort((a, b) => b.revenue - a.revenue)
    };
  });

  // Financial data grouped by payment method
  app.get("/admin/financial/by-payment-method", { preHandler: app.requireAdmin }, async (request) => {
    const query = financialQuerySchema.parse(request.query);
    const fromDate = new Date(`${query.from}T00:00:00`);
    const toDate = new Date(`${query.to}T23:59:59`);

    const payments = await prisma.payment.findMany({
      where: {
        appointment: {
          status: "DONE",
          startAt: { gte: fromDate, lte: toDate }
        }
      }
    });

    const byMethod = new Map<string, { method: string; total: number; count: number }>();

    for (const payment of payments) {
      const existing = byMethod.get(payment.method) ?? {
        method: payment.method,
        total: 0,
        count: 0
      };
      existing.total += Number(payment.amount);
      existing.count += 1;
      byMethod.set(payment.method, existing);
    }

    return {
      from: query.from,
      to: query.to,
      data: Array.from(byMethod.values()).sort((a, b) => b.total - a.total)
    };
  });

  // Daily financial breakdown
  app.get("/admin/financial/daily", { preHandler: app.requireAdmin }, async (request) => {
    const query = financialQuerySchema.parse(request.query);
    const fromDate = new Date(`${query.from}T00:00:00`);
    const toDate = new Date(`${query.to}T23:59:59`);

    const appointments = await prisma.appointment.findMany({
      where: {
        status: "DONE",
        startAt: { gte: fromDate, lte: toDate }
      },
      orderBy: { startAt: "asc" }
    });

    const daily = new Map<string, { date: string; revenue: number; cost: number; count: number }>();

    for (const apt of appointments) {
      const dateKey = apt.startAt.toISOString().slice(0, 10);
      const existing = daily.get(dateKey) ?? { date: dateKey, revenue: 0, cost: 0, count: 0 };
      existing.revenue += Number(apt.amountReceived ?? 0);
      existing.cost += apt.serviceCost ?? 0;
      existing.count += 1;
      daily.set(dateKey, existing);
    }

    return {
      from: query.from,
      to: query.to,
      data: Array.from(daily.values())
    };
  });

  // ============================================
  // Blocked dates batch enhancement
  // ============================================

  app.post("/admin/availability/blocked-dates/batch", { preHandler: app.requireAdmin }, async (request) => {
    const schema = z.object({
      dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
      reason: z.string().optional()
    });

    const data = schema.parse(request.body);
    const results: Array<{ date: string; id: string; created: boolean }> = [];

    for (const dateStr of data.dates) {
      const existing = await prisma.blockedDate.findFirst({
        where: { date: new Date(dateStr) }
      });

      if (existing) {
        results.push({ date: dateStr, id: existing.id, created: false });
        continue;
      }

      const blockedDate = await prisma.blockedDate.create({
        data: {
          date: new Date(dateStr),
          reason: data.reason
        }
      });

      results.push({ date: dateStr, id: blockedDate.id, created: true });
    }

    return { ok: true, results };
  });

  // ============================================
  // DateTime override endpoints (special hours for specific days)
  // ============================================

  app.get("/admin/availability/time-overrides", { preHandler: app.requireAdmin }, async () => {
    const overrides = await prisma.dateTimeOverride.findMany({
      orderBy: { date: "asc" },
      include: { timeWindows: true }
    });

    return {
      overrides: overrides.map((o) => ({
        id: o.id,
        date: o.date.toISOString().slice(0, 10),
        reason: o.reason,
        timeWindows: o.timeWindows.map((tw) => ({
          startMinute: tw.startMinute,
          endMinute: tw.endMinute
        }))
      }))
    };
  });

  const timeOverrideSchema = z.object({
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
    timeWindows: z.array(z.object({
      startMinute: z.number().min(0).max(1440),
      endMinute: z.number().min(0).max(1440)
    })).min(1),
    reason: z.string().optional()
  });

  app.post("/admin/availability/time-overrides", { preHandler: app.requireAdmin }, async (request, reply) => {
    const data = timeOverrideSchema.parse(request.body);

    // Validate each time window
    for (const tw of data.timeWindows) {
      if (tw.endMinute <= tw.startMinute) {
        return reply.code(400).send({ message: "End time must be after start time" });
      }
    }

    const results: Array<{ date: string; id: string }> = [];

    for (const dateStr of data.dates) {
      // Delete existing override for this date if any
      await prisma.dateTimeOverride.deleteMany({
        where: { date: new Date(dateStr) }
      });

      const override = await prisma.dateTimeOverride.create({
        data: {
          date: new Date(dateStr),
          reason: data.reason,
          timeWindows: {
            create: data.timeWindows.map((tw) => ({
              startMinute: tw.startMinute,
              endMinute: tw.endMinute
            }))
          }
        }
      });

      results.push({ date: dateStr, id: override.id });
    }

    return { ok: true, results };
  });

  app.delete("/admin/availability/time-overrides/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.dateTimeOverride.delete({ where: { id } });
      return { ok: true };
    } catch {
      return reply.code(404).send({ message: "Time override not found" });
    }
  });

  // ============================================
  // One-time backfill: populate serviceCost on existing appointments
  // ============================================
  app.post("/admin/backfill-service-cost", { preHandler: app.requireAdmin }, async (request) => {
    const services = await fetchAllServices();
    const costMap = new Map(services.map((s) => [s.id, s.cost]));

    // Find appointments that still have serviceCost = 0
    const appointments = await prisma.appointment.findMany({
      where: { serviceCost: 0 },
      select: { id: true, serviceId: true }
    });

    let updated = 0;
    for (const apt of appointments) {
      const cost = costMap.get(apt.serviceId) ?? 0;
      if (cost > 0) {
        await prisma.appointment.update({
          where: { id: apt.id },
          data: { serviceCost: cost }
        });
        updated++;
      }
    }

    return { ok: true, total: appointments.length, updated };
  });
};
