"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, X, CalendarOff, Clock, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  WeeklyHoursEditor,
  WeekSchedule,
  DaySchedule,
  createDefaultSchedule,
} from "@/components/availability";
import { TimeWindow, minutesToTime } from "@/components/availability/types";
import { TimeWindowInput } from "@/components/availability/TimeWindowInput";

type BlockedDate = {
  id: string;
  date: string;
  reason?: string;
};

type TimeOverride = {
  id: string;
  date: string;
  timeWindows: TimeWindow[];
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
  const [selectedBlockedDates, setSelectedBlockedDates] = useState<Set<string>>(new Set());

  // Time overrides state
  const [timeOverrides, setTimeOverrides] = useState<TimeOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [selectedOverrideDates, setSelectedOverrideDates] = useState<Set<string>>(new Set());
  const [overrideTimeWindows, setOverrideTimeWindows] = useState<TimeWindow[]>([
    { startMinute: 540, endMinute: 1080 }
  ]);
  const [overrideReason, setOverrideReason] = useState("");

  // Calendar state for blocked dates
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Calendar state for overrides
  const [overrideCalendarMonth, setOverrideCalendarMonth] = useState(() => {
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

  // Load time overrides
  const loadTimeOverrides = useCallback(async () => {
    if (!token) return;
    setOverridesLoading(true);
    try {
      const data = await apiFetch<{ overrides: TimeOverride[] }>(
        "/admin/availability/time-overrides",
        {},
        token
      );
      setTimeOverrides(data.overrides);
    } catch {
      setTimeOverrides([]);
    } finally {
      setOverridesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadGlobalSchedule();
    loadBlockedDates();
    loadTimeOverrides();
  }, [loadGlobalSchedule, loadBlockedDates, loadTimeOverrides]);

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

  // Toggle blocked date selection (multi-select)
  const toggleBlockedDateSelection = (dateKey: string) => {
    setSelectedBlockedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Confirm batch blocked dates
  const handleConfirmBlockedDates = async () => {
    if (!token || selectedBlockedDates.size === 0) return;
    setBlockedSaving(true);
    try {
      await apiFetch(
        "/admin/availability/blocked-dates/batch",
        {
          method: "POST",
          body: JSON.stringify({
            dates: Array.from(selectedBlockedDates),
            reason: newBlockedReason || undefined,
          }),
        },
        token
      );
      await loadBlockedDates();
      setSelectedBlockedDates(new Set());
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

  // Toggle override date selection
  const toggleOverrideDateSelection = (dateKey: string) => {
    setSelectedOverrideDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Confirm time overrides
  const handleConfirmOverrides = async () => {
    if (!token || selectedOverrideDates.size === 0) return;
    setOverridesSaving(true);
    try {
      await apiFetch(
        "/admin/availability/time-overrides",
        {
          method: "POST",
          body: JSON.stringify({
            dates: Array.from(selectedOverrideDates),
            timeWindows: overrideTimeWindows,
            reason: overrideReason || undefined,
          }),
        },
        token
      );
      await loadTimeOverrides();
      setSelectedOverrideDates(new Set());
      setOverrideReason("");
    } finally {
      setOverridesSaving(false);
    }
  };

  // Time window helpers for overrides
  const handleOverrideWindowChange = (index: number, tw: TimeWindow) => {
    setOverrideTimeWindows((prev) => prev.map((w, i) => (i === index ? tw : w)));
  };

  const handleAddOverrideWindow = () => {
    const last = overrideTimeWindows[overrideTimeWindows.length - 1];
    const newStart = last ? last.endMinute + 60 : 540;
    const newEnd = Math.min(newStart + 240, 1380);
    setOverrideTimeWindows((prev) => [...prev, { startMinute: newStart, endMinute: newEnd }]);
  };

  const handleRemoveOverrideWindow = (index: number) => {
    setOverrideTimeWindows((prev) => prev.filter((_, i) => i !== index));
  };

  // Remove time override
  const handleRemoveOverride = async (id: string) => {
    if (!token) return;
    setOverridesSaving(true);
    try {
      await apiFetch(
        `/admin/availability/time-overrides/${id}`,
        { method: "DELETE" },
        token
      );
      await loadTimeOverrides();
    } finally {
      setOverridesSaving(false);
    }
  };

  // Calendar logic
  const blockedDateSet = useMemo(
    () => new Set(blockedDates.map((bd) => bd.date)),
    [blockedDates]
  );

  const overrideDateSet = useMemo(
    () => new Set(timeOverrides.map((o) => o.date)),
    [timeOverrides]
  );

  const buildCalendarDays = (month: Date) => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0);
    const startPadding = firstDay.getDay();
    const endPadding = 6 - lastDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ date: new Date(year, m, -i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, m, i), isCurrentMonth: true });
    }
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, m + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const overrideCalendarDays = useMemo(() => buildCalendarDays(overrideCalendarMonth), [overrideCalendarMonth]);

  const sortedBlockedDates = useMemo(
    () => [...blockedDates].sort((a, b) => a.date.localeCompare(b.date)),
    [blockedDates]
  );

  const futureBlockedDates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return sortedBlockedDates.filter((bd) => bd.date >= today);
  }, [sortedBlockedDates]);

  const futureOverrides = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...timeOverrides]
      .filter((o) => o.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [timeOverrides]);

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
              Selecione uma ou mais datas em que não haverá atendimento (feriados, férias, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {blockedLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Calendar */}
                <div>
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
                      Selecione as datas e clique em confirmar
                    </p>
                  </div>

                  {/* Month navigation */}
                  <div className="mb-4 flex items-center justify-center gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                      }
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
                      onClick={() =>
                        setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                      }
                      className="size-8"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>

                  {/* Weekday headers */}
                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((day) => (
                      <div key={day} className="text-muted-foreground py-2 text-center text-xs font-medium">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map(({ date, isCurrentMonth }, index) => {
                      const dateKey = toDateKey(date);
                      const isBlocked = blockedDateSet.has(dateKey);
                      const isSelected = selectedBlockedDates.has(dateKey);
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
                              toggleBlockedDateSelection(dateKey);
                            }
                          }}
                          className={cn(
                            "flex h-10 w-full items-center justify-center rounded-md text-sm transition-colors",
                            !isCurrentMonth && "text-muted-foreground/30",
                            isCurrentMonth && isPast && "text-muted-foreground/50 cursor-not-allowed",
                            isCurrentMonth && !isPast && !isBlocked && !isSelected && "hover:bg-muted",
                            isCurrentMonth && !isPast && isSelected && "bg-primary text-primary-foreground font-medium",
                            isCurrentMonth && !isPast && isBlocked && "bg-destructive text-destructive-foreground font-medium"
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Confirm batch button */}
                  {selectedBlockedDates.size > 0 && (
                    <div className="mt-4">
                      <Button
                        onClick={handleConfirmBlockedDates}
                        disabled={blockedSaving}
                        size="sm"
                        className="w-full"
                      >
                        {blockedSaving
                          ? "Salvando..."
                          : `Bloquear ${selectedBlockedDates.size} data${selectedBlockedDates.size > 1 ? "s" : ""}`}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Blocked dates list */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Datas bloqueadas</h4>
                  {futureBlockedDates.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma data bloqueada</p>
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
                              <span className="text-muted-foreground ml-2 text-sm">({bd.reason})</span>
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

        {/* Time Overrides Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Horários Especiais
            </CardTitle>
            <CardDescription>
              Configure horários diferentes para datas específicas sem afetar os horários recorrentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overridesLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Override calendar */}
                <div>
                  <div className="mb-4 space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Horários</Label>
                      <div className="mt-1 flex flex-col gap-2">
                        {overrideTimeWindows.map((tw, index) => (
                          <TimeWindowInput
                            key={index}
                            timeWindow={tw}
                            onChange={(updated) => handleOverrideWindowChange(index, updated)}
                            onRemove={() => handleRemoveOverrideWindow(index)}
                            canRemove={overrideTimeWindows.length > 1}
                          />
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddOverrideWindow}
                        className="text-muted-foreground hover:text-foreground mt-1 gap-1"
                      >
                        <Plus className="size-3.5" />
                        Adicionar faixa
                      </Button>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Motivo (opcional)</Label>
                      <Input
                        placeholder="Ex: Horário reduzido..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Selecione as datas e clique em confirmar
                    </p>
                  </div>

                  {/* Month navigation */}
                  <div className="mb-4 flex items-center justify-center gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setOverrideCalendarMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                        )
                      }
                      className="size-8"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="min-w-[160px] text-center font-medium">
                      {MONTHS[overrideCalendarMonth.getMonth()]} {overrideCalendarMonth.getFullYear()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setOverrideCalendarMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                        )
                      }
                      className="size-8"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>

                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((day) => (
                      <div key={day} className="text-muted-foreground py-2 text-center text-xs font-medium">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {overrideCalendarDays.map(({ date, isCurrentMonth }, index) => {
                      const dateKey = toDateKey(date);
                      const hasOverride = overrideDateSet.has(dateKey);
                      const isSelected = selectedOverrideDates.has(dateKey);
                      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={!isCurrentMonth || isPast || overridesSaving}
                          onClick={() => toggleOverrideDateSelection(dateKey)}
                          className={cn(
                            "flex h-10 w-full items-center justify-center rounded-md text-sm transition-colors",
                            !isCurrentMonth && "text-muted-foreground/30",
                            isCurrentMonth && isPast && "text-muted-foreground/50 cursor-not-allowed",
                            isCurrentMonth && !isPast && !hasOverride && !isSelected && "hover:bg-muted",
                            isCurrentMonth && !isPast && isSelected && "bg-blue-500 text-white font-medium",
                            isCurrentMonth && !isPast && hasOverride && !isSelected && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium"
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOverrideDates.size > 0 && (
                    <div className="mt-4">
                      <Button
                        onClick={handleConfirmOverrides}
                        disabled={overridesSaving}
                        size="sm"
                        className="w-full"
                      >
                        {overridesSaving
                          ? "Salvando..."
                          : `Definir horário para ${selectedOverrideDates.size} data${selectedOverrideDates.size > 1 ? "s" : ""}`}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Overrides list */}
                <div>
                  <h4 className="mb-3 text-sm font-medium">Horários especiais configurados</h4>
                  {futureOverrides.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum horário especial</p>
                  ) : (
                    <div className="space-y-2">
                      {futureOverrides.map((o) => (
                        <div
                          key={o.id}
                          className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2"
                        >
                          <div>
                            <span className="font-medium">{formatDateBR(o.date)}</span>
                            <span className="text-muted-foreground ml-2 text-sm">
                              {o.timeWindows
                                .map((tw) => `${minutesToTime(tw.startMinute)} - ${minutesToTime(tw.endMinute)}`)
                                .join(", ")}
                            </span>
                            {o.reason && (
                              <span className="text-muted-foreground ml-1 text-sm">({o.reason})</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOverride(o.id)}
                            disabled={overridesSaving}
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
