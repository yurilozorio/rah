"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DayScheduleRow } from "./DayScheduleRow";
import { CopyScheduleDialog } from "./CopyScheduleDialog";
import { DaySchedule, WeekSchedule, WEEKDAYS } from "./types";

type WeeklyHoursEditorProps = {
  schedule: WeekSchedule;
  onChange: (schedule: WeekSchedule) => void;
  title?: string;
  description?: string;
};

export function WeeklyHoursEditor({
  schedule,
  onChange,
  title = "Horários semanais",
  description = "Configure quando você está disponível para agendamentos",
}: WeeklyHoursEditorProps) {
  const [copyDialogOpen, setCopyDialogOpen] = useState<number | null>(null);

  const handleDayChange = (updatedDay: DaySchedule) => {
    onChange(
      schedule.map((day) =>
        day.weekday === updatedDay.weekday ? updatedDay : day
      )
    );
  };

  const handleCopySchedule = (sourceWeekday: number, targetWeekdays: number[]) => {
    const sourceDay = schedule.find((d) => d.weekday === sourceWeekday);
    if (!sourceDay) return;

    onChange(
      schedule.map((day) =>
        targetWeekdays.includes(day.weekday)
          ? {
              ...day,
              isAvailable: sourceDay.isAvailable,
              timeWindows: [...sourceDay.timeWindows],
            }
          : day
      )
    );
  };

  // Ensure we have all 7 days in order
  const sortedSchedule = WEEKDAYS.map(({ value }) => {
    const daySchedule = schedule.find((d) => d.weekday === value);
    return (
      daySchedule ?? {
        weekday: value,
        isAvailable: false,
        timeWindows: [],
      }
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {sortedSchedule.map((daySchedule) => (
            <DayScheduleRow
              key={daySchedule.weekday}
              schedule={daySchedule}
              onChange={handleDayChange}
              onCopyClick={() => setCopyDialogOpen(daySchedule.weekday)}
            />
          ))}
        </div>

        {copyDialogOpen !== null && (
          <CopyScheduleDialog
            sourceWeekday={copyDialogOpen}
            onCopy={(targets) => handleCopySchedule(copyDialogOpen, targets)}
            onClose={() => setCopyDialogOpen(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
