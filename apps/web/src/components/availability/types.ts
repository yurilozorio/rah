export type TimeWindow = {
  startMinute: number;
  endMinute: number;
};

export type DaySchedule = {
  weekday: number;
  isAvailable: boolean;
  timeWindows: TimeWindow[];
  isInherited?: boolean;
};

export type WeekSchedule = DaySchedule[];

export type BlockedDate = {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  reason?: string;
};

export const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "D" },
  { value: 1, label: "Segunda", short: "S" },
  { value: 2, label: "Terça", short: "T" },
  { value: 3, label: "Quarta", short: "Q" },
  { value: 4, label: "Quinta", short: "Q" },
  { value: 5, label: "Sexta", short: "S" },
  { value: 6, label: "Sábado", short: "S" },
] as const;

// Helper functions
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const timeToMinutes = (time: string): number => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

export const formatTimeDisplay = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${String(mins).padStart(2, "0")} ${period}`;
};

export const createDefaultSchedule = (): WeekSchedule => {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isAvailable: weekday >= 1 && weekday <= 5, // Mon-Fri
    timeWindows:
      weekday >= 1 && weekday <= 5
        ? [{ startMinute: 540, endMinute: 1020 }] // 9am - 5pm
        : [],
  }));
};
