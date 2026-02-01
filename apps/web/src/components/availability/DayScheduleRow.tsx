"use client";

import { Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeWindowInput } from "./TimeWindowInput";
import { DaySchedule, TimeWindow, WEEKDAYS } from "./types";
import { cn } from "@/lib/utils";

type DayScheduleRowProps = {
  schedule: DaySchedule;
  onChange: (schedule: DaySchedule) => void;
  onCopyClick: () => void;
};

export function DayScheduleRow({
  schedule,
  onChange,
  onCopyClick,
}: DayScheduleRowProps) {
  const weekday = WEEKDAYS.find((d) => d.value === schedule.weekday);

  const handleToggleAvailable = () => {
    const newIsAvailable = !schedule.isAvailable;
    onChange({
      ...schedule,
      isAvailable: newIsAvailable,
      timeWindows: newIsAvailable
        ? [{ startMinute: 540, endMinute: 1020 }] // Default 9am-5pm
        : [],
    });
  };

  const handleAddTimeWindow = () => {
    const lastWindow = schedule.timeWindows[schedule.timeWindows.length - 1];
    const newStart = lastWindow ? lastWindow.endMinute + 60 : 540;
    const newEnd = Math.min(newStart + 240, 1380); // 4 hours later or 11pm max

    onChange({
      ...schedule,
      timeWindows: [
        ...schedule.timeWindows,
        { startMinute: newStart, endMinute: newEnd },
      ],
    });
  };

  const handleTimeWindowChange = (index: number, timeWindow: TimeWindow) => {
    onChange({
      ...schedule,
      timeWindows: schedule.timeWindows.map((tw, i) =>
        i === index ? timeWindow : tw
      ),
    });
  };

  const handleRemoveTimeWindow = (index: number) => {
    const newTimeWindows = schedule.timeWindows.filter((_, i) => i !== index);
    onChange({
      ...schedule,
      isAvailable: newTimeWindows.length > 0,
      timeWindows: newTimeWindows,
    });
  };

  return (
    <div className="flex items-start gap-4 py-3">
      {/* Day badge */}
      <button
        type="button"
        onClick={handleToggleAvailable}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
          schedule.isAvailable
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
        title={schedule.isAvailable ? "Clique para desativar" : "Clique para ativar"}
      >
        {weekday?.short}
      </button>

      {/* Time windows or Unavailable label */}
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {schedule.isAvailable ? (
          <>
            <div className="flex flex-col gap-2">
              {schedule.timeWindows.map((timeWindow, index) => (
                <TimeWindowInput
                  key={index}
                  timeWindow={timeWindow}
                  onChange={(tw) => handleTimeWindowChange(index, tw)}
                  onRemove={() => handleRemoveTimeWindow(index)}
                  canRemove={schedule.timeWindows.length > 1}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleAddTimeWindow}
                title="Adicionar horário"
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onCopyClick}
                title="Copiar para outros dias"
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Indisponível</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleToggleAvailable}
              title="Adicionar disponibilidade"
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Inherited indicator */}
      {schedule.isInherited && (
        <span className="text-muted-foreground shrink-0 text-xs">
          (herdado)
        </span>
      )}
    </div>
  );
}
