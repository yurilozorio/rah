"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

type Appointment = {
  id: string;
  serviceName: string;
  startAt: string;
  status: "BOOKED" | "CANCELLED";
  user: {
    name: string;
  };
};

const getCalendarDays = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, idx) => {
    const dayNumber = idx - startWeekday + 1;
    const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    return {
      date: new Date(year, month, dayNumber),
      dayNumber: isCurrentMonth ? dayNumber : null,
      isCurrentMonth
    };
  });
};

export default function AdminCalendarPage() {
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ appointments: Appointment[] }>("/admin/calendar", {}, token)
      .then((data) => setAppointments(data.appointments))
      .catch(() => setAppointments([]));
  }, [token]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <Card>
          <CardContent className="space-y-2 p-6">
            <h1 className="text-xl font-semibold">Calendário</h1>
            <p className="text-sm text-muted-foreground">Entre como administrador para acessar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendário</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
          >
            Próximo
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="overflow-x-auto">
            <div className="min-w-[600px] space-y-4">
              <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                  <span key={day} className="text-center">
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const dayAppointments = appointments.filter((appointment) => {
                    const appointmentDate = new Date(appointment.startAt);
                    return (
                      day.dayNumber &&
                      appointmentDate.getDate() === day.dayNumber &&
                      appointmentDate.getMonth() === calendarMonth.getMonth() &&
                      appointmentDate.getFullYear() === calendarMonth.getFullYear()
                    );
                  });
                  return (
                    <div
                      key={`${day.dayNumber ?? "x"}-${index}`}
                      className={`min-h-[72px] rounded border p-2 text-xs ${
                        day.isCurrentMonth ? "bg-background" : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="font-semibold">{day.dayNumber}</div>
                      <div className="mt-1 space-y-1">
                        {dayAppointments.map((appointment) => (
                          <div
                            key={appointment.id}
                            className={`rounded px-1 py-0.5 truncate ${
                              appointment.status === "CANCELLED" ? "bg-muted line-through" : "bg-secondary"
                            }`}
                            title={`${appointment.user.name} - ${appointment.serviceName}`}
                          >
                            {new Date(appointment.startAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                            {" - "}
                            <span className="font-medium">{appointment.user.name.split(" ")[0]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
