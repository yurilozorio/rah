"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "./types";

type CopyScheduleDialogProps = {
  sourceWeekday: number;
  onCopy: (targetWeekdays: number[]) => void;
  onClose: () => void;
};

export function CopyScheduleDialog({
  sourceWeekday,
  onCopy,
  onClose,
}: CopyScheduleDialogProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const sourceDayLabel = WEEKDAYS.find((d) => d.value === sourceWeekday)?.label;

  const toggleDay = (weekday: number) => {
    setSelectedDays((prev) =>
      prev.includes(weekday)
        ? prev.filter((d) => d !== weekday)
        : [...prev, weekday]
    );
  };

  const handleCopy = () => {
    if (selectedDays.length > 0) {
      onCopy(selectedDays);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card w-full max-w-sm rounded-lg border p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Copiar horários</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Copiar horários de {sourceDayLabel} para:
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {WEEKDAYS.filter((day) => day.value !== sourceWeekday).map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                selectedDays.includes(day.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleCopy}
            disabled={selectedDays.length === 0}
          >
            Copiar
          </Button>
        </div>
      </div>
    </div>
  );
}
