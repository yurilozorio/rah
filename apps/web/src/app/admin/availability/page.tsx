"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, X, CalendarOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  WeeklyHoursEditor,
  WeekSchedule,
  DaySchedule,
  createDefaultSchedule,
} from "@/components/availability";

type BlockedDate = {
  id: string;
  date: string;
  reason?: string;
};

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const formatDateBR = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

export default function AdminAvailabilityPage() {
  const { token, user } = useAuth();

  // Global schedule state
  const [globalSchedule, setGlobalSchedule] = useState<WeekSchedule>(
    createDefaultSchedule()
  );
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSaving, setGlobalSaving] = useState(false);

  // Blocked dates state
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedSaving, setBlockedSaving] = useState(false);
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // Calendar state for blocked dates
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Load global schedule
  const loadGlobalSchedule = useCallback(async () => {
    if (!token) return;
    setGlobalLoading(true);
    try {
      const data = await apiFetch<{ days: DaySchedule[] }>(
        "/admin/availability/global",
        {},
        token
      );
      if (data.days.length > 0) {
        setGlobalSchedule(data.days);
      }
    } catch {
      setGlobalSchedule(createDefaultSchedule());
    } finally {
      setGlobalLoading(false);
    }
  }, [token]);

  // Load blocked dates
  const loadBlockedDates = useCallback(async () => {
    if (!token) return;
    setBlockedLoading(true);
    try {
      const data = await apiFetch<{ blockedDates: BlockedDate[] }>(
        "/admin/availability/blocked-dates",
        {},
        token
      );
      setBlockedDates(data.blockedDates);
    } catch {
      setBlockedDates([]);
    } finally {
      setBlockedLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadGlobalSchedule();
    loadBlockedDates();
  }, [loadGlobalSchedule, loadBlockedDates]);

  // Save global schedule
  const handleSaveGlobal = async () => {
    if (!token) return;
    setGlobalSaving(true);
    try {
      await apiFetch(
        "/admin/availability/global",
        {
          method: "POST",
          body: JSON.stringify({ days: globalSchedule }),
        },
        token
      );
    } finally {
      setGlobalSaving(false);
    }
  };

  // Add blocked date
  const handleAddBlockedDate = async (dateStr: string) => {
    if (!token) return;
    setBlockedSaving(true);
    try {
      await apiFetch(
        "/admin/availability/blocked-dates",
        {
          method: "POST",
          body: JSON.stringify({ date: dateStr, reason: newBlockedReason || undefined }),
        },
        token
      );
      await loadBlockedDates();
      setNewBlockedReason("");
    } finally {
      setBlockedSaving(false);
    }
  };

  // Remove blocked date
  const handleRemoveBlockedDate = async (id: string) => {
    if (!token) return;
    setBlockedSaving(true);
    try {
      await apiFetch(
        `/admin/availability/blocked-dates/${id}`,
        { method: "DELETE" },
        token
      );
      await loadBlockedDates();
    } finally {
      setBlockedSaving(false);
    }
  };

  // Calendar logic
  const blockedDateSet = useMemo(
    () => new Set(blockedDates.map((bd) => bd.date)),
    [blockedDates]
  );

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const endPadding = 6 - lastDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [calendarMonth]);

  const goToPreviousMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Sort blocked dates by date
  const sortedBlockedDates = useMemo(
    () => [...blockedDates].sort((a, b) => a.date.localeCompare(b.date)),
    [blockedDates]
  );

  // Future blocked dates only
  const futureBlockedDates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return sortedBlockedDates.filter((bd) => bd.date >= today);
  }, [sortedBlockedDates]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <Card>
          <CardContent className="space-y-2 p-6">
            <h1 className="text-xl font-semibold">Disponibilidade</h1>
            <p className="text-muted-foreground text-sm">
              Entre como administrador para acessar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Disponibilidade</h1>
      <p className="text-muted-foreground mt-1">
        Configure quando os agendamentos podem ser feitos
      </p>

      <div className="mt-8 space-y-8">
        {/* Weekly Hours Section */}
        {globalLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-sm">Carregando...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <WeeklyHoursEditor
              schedule={globalSchedule}
              onChange={setGlobalSchedule}
              title="Horários de funcionamento"
              description="Configure os horários disponíveis para cada dia da semana"
            />
            <Button onClick={handleSaveGlobal} disabled={globalSaving}>
              {globalSaving ? "Salvando..." : "Salvar horários"}
            </Button>
          </>
        )}

        {/* Blocked Dates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="size-5" />
              Dias indisponíveis
            </CardTitle>
            <CardDescription>
              Selecione datas específicas em que não haverá atendimento (feriados, férias, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {blockedLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Calendar */}
                <div>
                  {/* Optional reason input */}
                  <div className="mb-4">
                    <Label htmlFor="reason" className="text-sm font-medium">
                      Motivo (opcional)
                    </Label>
                    <Input
                      id="reason"
                      placeholder="Ex: Feriado, Férias..."
                      value={newBlockedReason}
                      onChange={(e) => setNewBlockedReason(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      Clique em uma data para bloqueá-la
                    </p>
                  </div>

                  {/* Month navigation */}
                  <div className="mb-4 flex items-center justify-center gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPreviousMonth}
                      className="size-8"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="min-w-[160px] text-center font-medium">
                      {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
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
                      const isBlocked = blockedDateSet.has(dateKey);
                      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={!isCurrentMonth || isPast || blockedSaving}
                          onClick={() => {
                            if (isBlocked) {
                              const bd = blockedDates.find((b) => b.date === dateKey);
                              if (bd) handleRemoveBlockedDate(bd.id);
                            } else {
                              handleAddBlockedDate(dateKey);
                            }
                          }}
                          className={cn(
                            "flex h-10 w-full items-center justify-center rounded-md text-sm transition-colors",
                            !isCurrentMonth && "text-muted-foreground/30",
                            isCurrentMonth && isPast && "text-muted-foreground/50 cursor-not-allowed",
                            isCurrentMonth && !isPast && !isBlocked && "hover:bg-muted",
                            isCurrentMonth && !isPast && isBlocked && "bg-destructive text-destructive-foreground font-medium"
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Blocked dates list */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Datas bloqueadas</h4>
                  {futureBlockedDates.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhuma data bloqueada
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {futureBlockedDates.map((bd) => (
                        <div
                          key={bd.id}
                          className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2"
                        >
                          <div>
                            <span className="font-medium">{formatDateBR(bd.date)}</span>
                            {bd.reason && (
                              <span className="text-muted-foreground ml-2 text-sm">
                                ({bd.reason})
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBlockedDate(bd.id)}
                            disabled={blockedSaving}
                            className="text-muted-foreground hover:text-destructive size-8"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
