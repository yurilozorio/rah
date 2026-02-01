import { FastifyInstance } from "fastify";
import { z } from "zod";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { prisma } from "../lib/db.js";
import {
  buildSlots,
  buildSlotsFromSchedule,
  DaySchedule,
  WeekSchedule
} from "../lib/availability.js";
import { config } from "../lib/config.js";
import { fetchServiceById } from "../lib/strapi.js";

const querySchema = z.object({
  date: z.string().regex(/\d{4}-\d{2}-\d{2}/)
});

const rangeQuerySchema = z.object({
  from: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  to: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  duration: z.string().optional() // Optional override for total duration (for multi-service bookings)
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

  // Fall back to legacy ServiceAvailability model (use first found)
  const legacyRules = await prisma.serviceAvailability.findMany({
    where: { isActive: true }
  });

  if (legacyRules.length > 0) {
    // Use legacy system - return null schedule to use buildSlots
    return { schedule: null, slotIntervalMinutes: legacyRules[0].slotIntervalMinutes };
  }

  // No configuration found - use null to trigger fallback defaults
  return { schedule: null, slotIntervalMinutes: DEFAULT_SLOT_INTERVAL };
}

// Helper to check if a date is blocked
async function isDateBlocked(dateStr: string): Promise<boolean> {
  const date = new Date(dateStr);
  const blocked = await prisma.blockedDate.findFirst({
    where: { date }
  });
  return !!blocked;
}

// Helper to get all blocked dates in a range with reasons
async function getBlockedDatesInRange(from: string, to: string): Promise<Map<string, string | null>> {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      date: {
        gte: fromDate,
        lte: toDate
      }
    }
  });

  const result = new Map<string, string | null>();
  for (const bd of blockedDates) {
    result.set(bd.date.toISOString().slice(0, 10), bd.reason);
  }
  return result;
}

export const registerAvailabilityRoutes = (app: FastifyInstance) => {
  app.get("/services/:id/availability", async (request, reply) => {
    const serviceId = Number((request.params as { id: string }).id);
    const query = querySchema.parse(request.query);

    if (!serviceId) {
      return reply.code(400).send({ message: "Invalid service id" });
    }

    const service = await fetchServiceById(serviceId);
    if (!service.durationMinutes) {
      return reply.code(400).send({ message: "Service duration is required" });
    }

    // Check if date is blocked
    const blocked = await isDateBlocked(query.date);
    if (blocked) {
      return {
        service,
        date: query.date,
        slots: [],
        blocked: true
      };
    }

    const { schedule, slotIntervalMinutes } = await getGlobalSchedule();

    const dayStartUtc = fromZonedTime(`${query.date}T00:00:00`, config.TIMEZONE);
    const dayEndUtc = addDays(dayStartUtc, 1);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        status: "BOOKED",
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc }
      },
      select: {
        startAt: true,
        endAt: true
      }
    });

    let slots;

    if (schedule) {
      // Use new Calendly-style schedule
      slots = buildSlotsFromSchedule({
        date: query.date,
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

      const fallbackRule = {
        weekday: 0,
        startMinute: config.businessStartMin,
        endMinute: config.businessEndMin,
        slotIntervalMinutes
      };

      const normalizedRules =
        legacyRules.length > 0
          ? legacyRules.map((rule) => ({
              weekday: rule.weekday,
              startMinute: rule.startMinute,
              endMinute: rule.endMinute,
              slotIntervalMinutes: rule.slotIntervalMinutes
            }))
          : [1, 2, 3, 4, 5, 6].map((weekday) => ({ ...fallbackRule, weekday }));

      slots = buildSlots({
        date: query.date,
        timezone: config.TIMEZONE,
        rules: normalizedRules,
        durationMinutes: service.durationMinutes,
        existing: existingAppointments
      });
    }

    return {
      service,
      date: query.date,
      slots: slots.map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        label: formatInTimeZone(slot.startAt, config.TIMEZONE, "HH:mm")
      }))
    };
  });

  // Get availability for a date range (single request for calendar)
  app.get("/services/:id/availability/range", async (request, reply) => {
    const serviceId = Number((request.params as { id: string }).id);
    const query = rangeQuerySchema.parse(request.query);

    if (!serviceId) {
      return reply.code(400).send({ message: "Invalid service id" });
    }

    const service = await fetchServiceById(serviceId);
    if (!service.durationMinutes) {
      return reply.code(400).send({ message: "Service duration is required" });
    }

    // Use override duration if provided (for multi-service bookings), otherwise use service duration
    const durationMinutes = query.duration ? Number(query.duration) : service.durationMinutes;

    const { schedule, slotIntervalMinutes } = await getGlobalSchedule();

    // Get blocked dates in range
    const blockedDates = await getBlockedDatesInRange(query.from, query.to);

    // Generate all dates in range
    const fromDate = new Date(`${query.from}T00:00:00`);
    const toDate = new Date(`${query.to}T00:00:00`);
    const dates: string[] = [];
    
    const current = new Date(fromDate);
    while (current <= toDate) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    // Get all existing appointments in the range
    const rangeStartUtc = fromZonedTime(`${query.from}T00:00:00`, config.TIMEZONE);
    const rangeEndUtc = fromZonedTime(`${query.to}T23:59:59`, config.TIMEZONE);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        status: "BOOKED",
        startAt: { lt: rangeEndUtc },
        endAt: { gt: rangeStartUtc }
      },
      select: {
        startAt: true,
        endAt: true
      }
    });

    // Build slots for each day
    const availability: Array<{
      date: string;
      slots: Array<{ startAt: string; endAt: string; label: string }>;
      blocked?: boolean;
      blockedReason?: string | null;
    }> = [];

    for (const dateKey of dates) {
      // Check if date is blocked
      if (blockedDates.has(dateKey)) {
        availability.push({
          date: dateKey,
          slots: [],
          blocked: true,
          blockedReason: blockedDates.get(dateKey)
        });
        continue;
      }

      const dayStartUtc = fromZonedTime(`${dateKey}T00:00:00`, config.TIMEZONE);
      const dayEndUtc = addDays(dayStartUtc, 1);

      // Filter appointments for this day
      const dayAppointments = existingAppointments.filter(
        (appt) => appt.startAt < dayEndUtc && appt.endAt > dayStartUtc
      );

      let slots;

      if (schedule) {
        slots = buildSlotsFromSchedule({
          date: dateKey,
          timezone: config.TIMEZONE,
          schedule,
          durationMinutes,
          slotIntervalMinutes,
          existing: dayAppointments
        });
      } else {
        // Fall back to legacy or defaults
        const legacyRules = await prisma.serviceAvailability.findMany({
          where: { isActive: true }
        });

        const fallbackRule = {
          weekday: 0,
          startMinute: config.businessStartMin,
          endMinute: config.businessEndMin,
          slotIntervalMinutes
        };

        const normalizedRules =
          legacyRules.length > 0
            ? legacyRules.map((rule) => ({
                weekday: rule.weekday,
                startMinute: rule.startMinute,
                endMinute: rule.endMinute,
                slotIntervalMinutes: rule.slotIntervalMinutes
              }))
            : [1, 2, 3, 4, 5, 6].map((weekday) => ({ ...fallbackRule, weekday }));

        slots = buildSlots({
          date: dateKey,
          timezone: config.TIMEZONE,
          rules: normalizedRules,
          durationMinutes,
          existing: dayAppointments
        });
      }

      availability.push({
        date: dateKey,
        slots: slots.map((slot) => ({
          startAt: slot.startAt.toISOString(),
          endAt: slot.endAt.toISOString(),
          label: formatInTimeZone(slot.startAt, config.TIMEZONE, "HH:mm")
        }))
      });
    }

    // Convert blocked dates map to array with reasons
    const blockedDatesArray = Array.from(blockedDates.entries()).map(([date, reason]) => ({
      date,
      reason
    }));

    return {
      service,
      from: query.from,
      to: query.to,
      blockedDates: blockedDatesArray,
      availability
    };
  });
};
