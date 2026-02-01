import { addMinutes, isAfter, isBefore } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// Legacy types (kept for backwards compatibility)
export type AvailabilityRule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotIntervalMinutes: number;
};

export type AppointmentRange = {
  startAt: Date;
  endAt: Date;
};

// New Calendly-style types
export type TimeWindow = {
  startMinute: number;
  endMinute: number;
};

export type DaySchedule = {
  weekday: number;
  isAvailable: boolean;
  timeWindows: TimeWindow[];
};

export type WeekSchedule = DaySchedule[];

// Legacy buildSlots function (kept for backwards compatibility)
export const buildSlots = ({
  date,
  timezone,
  rules,
  durationMinutes,
  existing
}: {
  date: string;
  timezone: string;
  rules: AvailabilityRule[];
  durationMinutes: number;
  existing: AppointmentRange[];
}) => {
  const localMidnightUtc = fromZonedTime(`${date}T00:00:00`, timezone);
  const isoWeekday = Number(formatInTimeZone(localMidnightUtc, timezone, "i"));
  const weekdayIndex = isoWeekday % 7;
  const slots: AppointmentRange[] = [];

  rules
    .filter((rule) => rule.weekday === weekdayIndex)
    .forEach((rule) => {
      for (
        let startMinute = rule.startMinute;
        startMinute + durationMinutes <= rule.endMinute;
        startMinute += rule.slotIntervalMinutes
      ) {
        const slotStart = addMinutes(localMidnightUtc, startMinute);
        const slotEnd = addMinutes(slotStart, durationMinutes);

        const overlap = existing.some(
          (appt) => isBefore(slotStart, appt.endAt) && isAfter(slotEnd, appt.startAt)
        );

        if (!overlap) {
          slots.push({ startAt: slotStart, endAt: slotEnd });
        }
      }
    });

  return slots;
};

// New buildSlotsFromSchedule function for Calendly-style availability
export const buildSlotsFromSchedule = ({
  date,
  timezone,
  schedule,
  durationMinutes,
  slotIntervalMinutes,
  existing
}: {
  date: string;
  timezone: string;
  schedule: WeekSchedule;
  durationMinutes: number;
  slotIntervalMinutes: number;
  existing: AppointmentRange[];
}) => {
  const localMidnightUtc = fromZonedTime(`${date}T00:00:00`, timezone);
  const isoWeekday = Number(formatInTimeZone(localMidnightUtc, timezone, "i"));
  const weekdayIndex = isoWeekday % 7;
  const slots: AppointmentRange[] = [];

  // Find the schedule for this day
  const daySchedule = schedule.find((d) => d.weekday === weekdayIndex);

  // If no schedule or day is marked unavailable, return empty
  if (!daySchedule || !daySchedule.isAvailable) {
    return slots;
  }

  // Generate slots for each time window
  for (const timeWindow of daySchedule.timeWindows) {
    for (
      let startMinute = timeWindow.startMinute;
      startMinute + durationMinutes <= timeWindow.endMinute;
      startMinute += slotIntervalMinutes
    ) {
      const slotStart = addMinutes(localMidnightUtc, startMinute);
      const slotEnd = addMinutes(slotStart, durationMinutes);

      const overlap = existing.some(
        (appt) => isBefore(slotStart, appt.endAt) && isAfter(slotEnd, appt.startAt)
      );

      if (!overlap) {
        slots.push({ startAt: slotStart, endAt: slotEnd });
      }
    }
  }

  return slots;
};

// Convert legacy rules to new schedule format
export const convertLegacyRulesToSchedule = (
  rules: AvailabilityRule[]
): WeekSchedule => {
  return Array.from({ length: 7 }, (_, weekday) => {
    const dayRules = rules.filter((r) => r.weekday === weekday);
    return {
      weekday,
      isAvailable: dayRules.length > 0,
      timeWindows: dayRules.map((r) => ({
        startMinute: r.startMinute,
        endMinute: r.endMinute
      }))
    };
  });
};

// Helper to get merged schedule (service-specific or global fallback)
export const getMergedSchedule = (
  serviceSchedule: DaySchedule[] | null,
  globalSchedule: DaySchedule[]
): WeekSchedule => {
  if (serviceSchedule && serviceSchedule.length > 0) {
    return serviceSchedule;
  }
  return globalSchedule;
};
