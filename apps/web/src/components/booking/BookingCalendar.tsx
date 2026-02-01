"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BlockedDateInfo = {
  date: string;
  reason?: string | null;
};

type BookingCalendarProps = {
  availableDates: Set<string>;
  blockedDates?: BlockedDateInfo[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  isLoading?: boolean;
};

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const isSameDay = (date1: Date, date2: Date) =>
  date1.getFullYear() === date2.getFullYear() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getDate() === date2.getDate();

const isToday = (date: Date) => isSameDay(date, new Date());

const isPast = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

export function BookingCalendar({
  availableDates,
  blockedDates = [],
  selectedDate,
  onSelectDate,
  isLoading = false,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Create a map for quick blocked date lookup with reason
  const blockedDateMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const bd of blockedDates) {
      map.set(bd.date, bd.reason ?? null);
    }
    return map;
  }, [blockedDates]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Days from previous month to fill the first week
    const startPadding = firstDay.getDay();
    // Days from next month to fill the last week
    const endPadding = 6 - lastDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month days
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month days
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const canGoPrevious = useMemo(() => {
    const now = new Date();
    return (
      currentMonth.getFullYear() > now.getFullYear() ||
      (currentMonth.getFullYear() === now.getFullYear() &&
        currentMonth.getMonth() > now.getMonth())
    );
  }, [currentMonth]);

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={!canGoPrevious}
          className="size-8"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[160px] text-center font-medium">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="size-8"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-muted-foreground py-2 text-center text-xs font-medium"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          const dateKey = toDateKey(date);
          const isAvailable = availableDates.has(dateKey);
          const isBlocked = blockedDateMap.has(dateKey);
          const blockedReason = blockedDateMap.get(dateKey);
          const isSelected = selectedDate === dateKey;
          const isPastDay = isPast(date);
          const isTodayDay = isToday(date);
          const isDisabled = !isCurrentMonth || isPastDay || !isAvailable;

          // Build tooltip text for blocked dates
          const tooltipText = isBlocked && isCurrentMonth && !isPastDay
            ? blockedReason || "Indisponível"
            : undefined;

          return (
            <div key={index} className="group relative">
              <button
                type="button"
                disabled={isDisabled || isLoading}
                onClick={() => onSelectDate(dateKey)}
                className={cn(
                  "relative flex h-10 w-full items-center justify-center rounded-full text-sm transition-colors",
                  // Base states
                  !isCurrentMonth && "text-muted-foreground/30",
                  isCurrentMonth && isPastDay && "text-muted-foreground/50",
                  // Available days
                  isCurrentMonth &&
                    !isPastDay &&
                    isAvailable &&
                    !isSelected &&
                    "text-primary font-medium hover:bg-primary/10",
                  // Selected day
                  isSelected && "bg-primary text-primary-foreground font-semibold",
                  // Blocked days (show differently from just unavailable)
                  isCurrentMonth &&
                    !isPastDay &&
                    isBlocked &&
                    "text-muted-foreground cursor-not-allowed line-through decoration-muted-foreground/50",
                  // Unavailable days (current month, not past, not blocked)
                  isCurrentMonth &&
                    !isPastDay &&
                    !isAvailable &&
                    !isBlocked &&
                    "text-muted-foreground cursor-not-allowed",
                  // Today indicator
                  isTodayDay && !isSelected && "ring-primary/30 ring-1 ring-inset"
                )}
              >
                {date.getDate()}
                {/* Availability dot */}
                {isCurrentMonth && !isPastDay && isAvailable && !isSelected && (
                  <span className="bg-primary absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full" />
                )}
              </button>
              {/* Instant tooltip for blocked dates */}
              {tooltipText && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 group-hover:block">
                  <div className="whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background shadow-lg">
                    {tooltipText}
                  </div>
                  <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="text-muted-foreground mt-4 text-center text-sm">
          Carregando disponibilidade...
        </div>
      )}
    </div>
  );
}
