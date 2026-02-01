"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeWindow, minutesToTime, timeToMinutes } from "./types";

type TimeWindowInputProps = {
  timeWindow: TimeWindow;
  onChange: (timeWindow: TimeWindow) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function TimeWindowInput({
  timeWindow,
  onChange,
  onRemove,
  canRemove,
}: TimeWindowInputProps) {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...timeWindow,
      startMinute: timeToMinutes(e.target.value),
    });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...timeWindow,
      endMinute: timeToMinutes(e.target.value),
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        value={minutesToTime(timeWindow.startMinute)}
        onChange={handleStartChange}
        className="w-[120px]"
      />
      <span className="text-muted-foreground">-</span>
      <Input
        type="time"
        value={minutesToTime(timeWindow.endMinute)}
        onChange={handleEndChange}
        className="w-[120px]"
      />
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
