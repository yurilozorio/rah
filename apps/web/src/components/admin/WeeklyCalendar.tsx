"use client";

import { useMemo, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Appointment = {
  id: string;
  serviceName: string;
  serviceId?: number;
  serviceDurationMin?: number;
  startAt: string;
  endAt?: string;
  status: "BOOKED" | "CANCELLED";
  notes?: string;
  user: { name: string; phone: string };
};

type WeeklyCalendarProps = {
  appointments: Appointment[];
  currentWeekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  startHour?: number;
  endHour?: number;
  onAppointmentClick?: (appointment: Appointment) => void;
  onAppointmentDrop?: (appointmentId: string, newStartAt: Date, newEndAt: Date) => void;
  onAppointmentResize?: (appointmentId: string, newEndAt: Date) => void;
  onAppointmentDelete?: (appointmentId: string) => void;
  onSlotClick?: (date: Date) => void;
};

const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const HOUR_HEIGHT = 64; // 64px per hour
const SLOT_SNAP_MINUTES = 15; // Snap to 15-minute intervals

const formatTime = (hour: number) => {
  return `${hour.toString().padStart(2, "0")}:00`;
};

const getWeekDates = (weekStart: Date) => {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });
};

const getMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isSameDay = (date1: Date, date2: Date) =>
  date1.getFullYear() === date2.getFullYear() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getDate() === date2.getDate();

const isToday = (date: Date) => isSameDay(date, new Date());

// Snap minutes to nearest interval
const snapToInterval = (minutes: number, interval: number = SLOT_SNAP_MINUTES) => {
  return Math.round(minutes / interval) * interval;
};

export function WeeklyCalendar({
  appointments,
  currentWeekStart,
  onPreviousWeek,
  onNextWeek,
  onToday,
  startHour = 8,
  endHour = 19,
  onAppointmentClick,
  onAppointmentDrop,
  onAppointmentResize,
  onAppointmentDelete,
  onSlotClick,
}: WeeklyCalendarProps) {
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const startMonth = start.toLocaleDateString("pt-BR", { month: "long" });
    const endMonth = end.toLocaleDateString("pt-BR", { month: "long" });
    const year = start.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth.charAt(0).toUpperCase() + startMonth.slice(1)} ${year}`;
    }
    return `${startMonth.charAt(0).toUpperCase() + startMonth.slice(1)} - ${endMonth.charAt(0).toUpperCase() + endMonth.slice(1)} ${year}`;
  }, [weekDates]);

  // Drag state
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragOverMinutes, setDragOverMinutes] = useState<number | null>(null);

  // Resize state
  const [resizingAppointment, setResizingAppointment] = useState<Appointment | null>(null);
  const [currentResizeDuration, setCurrentResizeDuration] = useState<number>(0);
  const currentResizeDurationRef = useRef<number>(0);

  const gridRef = useRef<HTMLDivElement>(null);

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.startAt);
      return isSameDay(aptDate, date);
    });
  };

  const getAppointmentStyle = (appointment: Appointment, isResizing: boolean = false) => {
    const start = new Date(appointment.startAt);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const dayStartMinutes = startHour * 60;

    // Default duration of 60 minutes if no endAt
    let durationMinutes = 60;
    if (appointment.endAt) {
      const end = new Date(appointment.endAt);
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }

    // If currently resizing this appointment, use the current resize duration
    if (isResizing && resizingAppointment?.id === appointment.id) {
      durationMinutes = currentResizeDuration;
    }

    const topOffset = ((startMinutes - dayStartMinutes) / 60) * HOUR_HEIGHT;
    const height = (durationMinutes / 60) * HOUR_HEIGHT;

    return {
      top: `${topOffset}px`,
      height: `${Math.max(height, 24)}px`,
    };
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    if (appointment.status === "CANCELLED") return;
    
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", appointment.id);
    setDraggedAppointment(appointment);
  };

  const handleDragEnd = () => {
    setDraggedAppointment(null);
    setDragOverDay(null);
    setDragOverMinutes(null);
  };

  const handleDragOver = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = startHour * 60 + (y / HOUR_HEIGHT) * 60;
    const snappedMinutes = snapToInterval(minutes);
    
    setDragOverDay(dayIndex);
    setDragOverMinutes(snappedMinutes);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
    setDragOverMinutes(null);
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    
    if (!draggedAppointment || !onAppointmentDrop || dragOverMinutes === null) return;

    const targetDate = weekDates[dayIndex];
    const newStartAt = new Date(targetDate);
    newStartAt.setHours(Math.floor(dragOverMinutes / 60), dragOverMinutes % 60, 0, 0);

    // Calculate duration from original appointment
    let durationMinutes = 60;
    if (draggedAppointment.endAt) {
      const start = new Date(draggedAppointment.startAt);
      const end = new Date(draggedAppointment.endAt);
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }

    const newEndAt = new Date(newStartAt.getTime() + durationMinutes * 60 * 1000);

    onAppointmentDrop(draggedAppointment.id, newStartAt, newEndAt);
    
    setDraggedAppointment(null);
    setDragOverDay(null);
    setDragOverMinutes(null);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, appointment: Appointment) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (appointment.status === "CANCELLED") return;

    let durationMinutes = 60;
    if (appointment.endAt) {
      const start = new Date(appointment.startAt);
      const end = new Date(appointment.endAt);
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }

    const initialY = e.clientY;
    const initialDuration = durationMinutes;

    setResizingAppointment(appointment);
    setCurrentResizeDuration(durationMinutes);
    currentResizeDurationRef.current = durationMinutes;

    // Add global mouse listeners
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - initialY;
      const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
      const newDuration = Math.max(15, snapToInterval(initialDuration + deltaMinutes));
      setCurrentResizeDuration(newDuration);
      currentResizeDurationRef.current = newDuration;
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      const finalDuration = currentResizeDurationRef.current;
      
      if (onAppointmentResize && finalDuration !== initialDuration) {
        const start = new Date(appointment.startAt);
        const newEndAt = new Date(start.getTime() + finalDuration * 60 * 1000);
        onAppointmentResize(appointment.id, newEndAt);
      }

      setResizingAppointment(null);
      setCurrentResizeDuration(0);
      currentResizeDurationRef.current = 0;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Click on empty slot to create appointment
  const handleSlotClick = (e: React.MouseEvent, dayIndex: number) => {
    if (!onSlotClick) return;
    
    // Don't trigger if clicking on an appointment
    if ((e.target as HTMLElement).closest("[data-appointment]")) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = startHour * 60 + (y / HOUR_HEIGHT) * 60;
    const snappedMinutes = snapToInterval(minutes);
    
    const targetDate = new Date(weekDates[dayIndex]);
    targetDate.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);
    
    onSlotClick(targetDate);
  };

  // Calculate ghost position for drag preview
  const ghostStyle = useMemo(() => {
    if (dragOverDay === null || dragOverMinutes === null || !draggedAppointment) return null;
    
    let durationMinutes = 60;
    if (draggedAppointment.endAt) {
      const start = new Date(draggedAppointment.startAt);
      const end = new Date(draggedAppointment.endAt);
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }
    
    const topOffset = ((dragOverMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
    const height = (durationMinutes / 60) * HOUR_HEIGHT;
    
    return {
      top: `${topOffset}px`,
      height: `${Math.max(height, 24)}px`,
    };
  }, [dragOverDay, dragOverMinutes, draggedAppointment, startHour]);

  return (
    <div className="w-full">
      {/* Header with navigation */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToday}>
            Hoje
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={onPreviousWeek} className="size-8">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNextWeek} className="size-8">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <span className="text-lg font-medium">{weekLabel}</span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[800px]">
          {/* Weekday headers */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b bg-muted/30">
            <div className="border-r p-2" /> {/* Empty corner cell */}
            {weekDates.map((date, index) => (
              <div
                key={index}
                className={cn(
                  "border-r p-3 text-center last:border-r-0",
                  isToday(date) && "bg-primary/10"
                )}
              >
                <div className="text-xs font-medium text-muted-foreground">{WEEKDAYS[index]}</div>
                <div
                  className={cn(
                    "mt-1 inline-flex size-8 items-center justify-center rounded-full text-lg font-semibold",
                    isToday(date) && "bg-primary text-primary-foreground"
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time slots grid */}
          <div className="relative" ref={gridRef}>
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0">
                {/* Time label */}
                <div className="flex items-start justify-end border-r p-2 text-xs text-muted-foreground">
                  {formatTime(hour)}
                </div>
                {/* Day cells */}
                {weekDates.map((date, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={cn(
                      "relative h-16 border-r last:border-r-0",
                      isToday(date) && "bg-primary/5"
                    )}
                  />
                ))}
              </div>
            ))}

            {/* Appointments overlay */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-[80px_repeat(7,1fr)]">
              <div /> {/* Empty space for time column */}
              {weekDates.map((date, dayIndex) => {
                const dayAppointments = getAppointmentsForDay(date);
                const isDragTarget = dragOverDay === dayIndex;
                
                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      "pointer-events-auto relative cursor-pointer",
                      isDragTarget && "bg-primary/10"
                    )}
                    onDragOver={(e) => handleDragOver(e, dayIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dayIndex)}
                    onClick={(e) => handleSlotClick(e, dayIndex)}
                  >
                    {/* Ghost element for drag preview */}
                    {isDragTarget && ghostStyle && (
                      <div
                        className="absolute left-1 right-1 rounded-md border-2 border-dashed border-primary bg-primary/10"
                        style={ghostStyle}
                      />
                    )}

                    {/* Appointments */}
                    {dayAppointments.map((appointment) => {
                      const style = getAppointmentStyle(
                        appointment,
                        resizingAppointment?.id === appointment.id
                      );
                      const isCancelled = appointment.status === "CANCELLED";
                      const isDragging = draggedAppointment?.id === appointment.id;
                      const isResizing = resizingAppointment?.id === appointment.id;
                      
                      return (
                        <div
                          key={appointment.id}
                          data-appointment={appointment.id}
                          draggable={!isCancelled}
                          onDragStart={(e) => handleDragStart(e, appointment)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick?.(appointment);
                          }}
                          className={cn(
                            "group absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm transition-all",
                            isCancelled
                              ? "cursor-not-allowed border-muted bg-muted text-muted-foreground line-through"
                              : "cursor-grab border-primary/30 bg-primary/20 text-foreground hover:shadow-md active:cursor-grabbing",
                            isDragging && "opacity-50",
                            isResizing && "ring-2 ring-primary"
                          )}
                          style={style}
                          title={`${appointment.serviceName}\n${appointment.user.name}\n${appointment.user.phone}`}
                        >
                          {/* Drag handle indicator */}
                          {!isCancelled && (
                            <div className="absolute left-0 top-0 bottom-0 flex w-4 items-center justify-center opacity-0 transition-opacity group-hover:opacity-60">
                              <GripVertical className="size-3" />
                            </div>
                          )}

                          <div className="truncate pl-3 font-medium">
                            {new Date(appointment.startAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            - {appointment.serviceName}
                          </div>
                          <div className="truncate pl-3 text-[10px] opacity-80">
                            {appointment.user.name}
                          </div>

                          {/* Delete button */}
                          {!isCancelled && onAppointmentDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentDelete(appointment.id);
                              }}
                              className="absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-destructive/20 group-hover:opacity-100"
                              title="Excluir agendamento"
                            >
                              <Trash2 className="size-3 text-destructive" />
                            </button>
                          )}

                          {/* Resize handle */}
                          {!isCancelled && onAppointmentResize && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
                              onMouseDown={(e) => handleResizeStart(e, appointment)}
                            >
                              <div className="mx-auto h-0.5 w-8 rounded-full bg-foreground/40" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add button on hover (if empty or low on appointments) */}
                    {onSlotClick && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                        <Plus className="size-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="size-3 rounded border border-primary/20 bg-primary/20" />
          <span>Confirmado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-3 rounded border border-muted bg-muted" />
          <span>Cancelado</span>
        </div>
      </div>
    </div>
  );
}

export { getMonday };
export type { Appointment as WeeklyCalendarAppointment };
