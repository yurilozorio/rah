"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Slot = {
  startAt: string;
  endAt: string;
  label: string;
};

type TimeSlotsPanelProps = {
  date: string;
  slots: Slot[];
  selectedSlot: string | null;
  onSelectSlot: (slotStart: string) => void;
  isLoading?: boolean;
};

const formatDateHeader = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
};

export function TimeSlotsPanel({
  date,
  slots,
  selectedSlot,
  onSelectSlot,
  isLoading = false,
}: TimeSlotsPanelProps) {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b pb-3">
          <h3 className="text-muted-foreground text-sm">Carregando horários...</h3>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground text-sm">Aguarde...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Date header */}
      <div className="border-b pb-3">
        <h3 className="font-medium capitalize">{formatDateHeader(date)}</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {slots.length} {slots.length === 1 ? "horário disponível" : "horários disponíveis"}
        </p>
      </div>

      {/* Slots list */}
      <div className="flex-1 overflow-y-auto py-3">
        {slots.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            Nenhum horário disponível para esta data.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.startAt;
              return (
                <Button
                  key={slot.startAt}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => onSelectSlot(slot.startAt)}
                  className={cn(
                    "w-full justify-center font-medium",
                    !isSelected && "border-primary text-primary hover:bg-primary/5"
                  )}
                >
                  {slot.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
