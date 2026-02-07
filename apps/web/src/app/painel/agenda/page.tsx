"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, CalendarDays, LayoutList } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { WeeklyCalendar, getMonday, AppointmentModal } from "@/components/admin";
import type { Appointment as CalendarAppointment } from "@/components/admin/WeeklyCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Payment = {
  id: string;
  method: string;
  amount: number;
  installments: number;
};

type Appointment = {
  id: string;
  serviceName: string;
  serviceId: number;
  serviceDurationMin: number;
  servicePrice: number;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "DONE";
  notes?: string;
  amountReceived?: number;
  payments?: Payment[];
  user: { id: string; name: string; phone: string; strapiClientId?: string };
};

type Service = {
  id: number;
  name: string;
  durationMinutes: number;
  price: number;
};

type User = {
  id: string;
  name: string;
  phone: string;
};

type ViewMode = "week" | "month";

const getStrapiBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_STRAPI_URL;
  if (process.env.NODE_ENV === "production") {
    if (url && !url.includes("placeholder")) return url;
    return ""; // Use relative URLs via /cms/
  }
  return url || "http://localhost:1337";
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
      isCurrentMonth,
    };
  });
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function AdminAgendaPage() {
  const { token, user, logout } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMonday(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("week");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mark as done modal
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [doneAppointment, setDoneAppointment] = useState<Appointment | null>(null);
  const [doneAmount, setDoneAmount] = useState("");
  const [donePayments, setDonePayments] = useState<Array<{ method: string; amount: string; installments: string }>>([
    { method: "PIX", amount: "", installments: "1" },
  ]);
  const [isMarkingDone, setIsMarkingDone] = useState(false);

  // Cancel confirmation modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Month view data
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ appointments: Appointment[] }>("/admin/agenda", {}, token);
      setAppointments(data.appointments);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      setAppointments([]);
    }
  }, [token]);

  // Fetch services from Strapi (only published services are returned)
  const fetchServices = useCallback(async () => {
    try {
      const baseUrl = getStrapiBaseUrl();
      const url = baseUrl ? `${baseUrl}/api/services?sort=order:asc` : "/cms/api/services?sort=order:asc";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch services");
      const data = await response.json();
      const serviceList: Service[] = (data.data || []).map((item: any) => ({
        id: item.id,
        name: item.name || item.attributes?.name || "Serviço",
        durationMinutes: item.durationMinutes || item.attributes?.durationMinutes || 60,
        price: item.price || item.attributes?.price || 0,
      }));
      setServices(serviceList);
    } catch (error) {
      console.error("Failed to fetch services:", error);
      setServices([]);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ users: User[] }>("/admin/users", {}, token);
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
    }
  }, [token]);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchAppointments(), fetchServices(), fetchUsers()]);
      setIsLoading(false);
    };
    if (token) {
      loadData();
    }
  }, [token, fetchAppointments, fetchServices, fetchUsers]);

  const handlePreviousWeek = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  }, []);

  const handleToday = useCallback(() => {
    setCurrentWeekStart(getMonday(new Date()));
  }, []);

  // Open modal to create new appointment
  const handleSlotClick = useCallback((date: Date) => {
    setSelectedAppointment(null);
    setInitialDate(date);
    setModalOpen(true);
  }, []);

  // Open modal to edit appointment
  const handleAppointmentClick = useCallback(
    (appointment: CalendarAppointment) => {
      const fullAppointment = appointments.find((a) => a.id === appointment.id);
      if (fullAppointment) {
        setSelectedAppointment(fullAppointment);
        setInitialDate(null);
        setModalOpen(true);
      }
    },
    [appointments]
  );

  // Handle drag-and-drop reschedule
  const handleAppointmentDrop = useCallback(
    async (appointmentId: string, newStartAt: Date, newEndAt: Date) => {
      if (!token) return;
      try {
        await apiFetch(
          `/admin/appointments/${appointmentId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              startAt: newStartAt.toISOString(),
              endAt: newEndAt.toISOString(),
            }),
          },
          token
        );
        await fetchAppointments();
      } catch (error) {
        console.error("Failed to reschedule appointment:", error);
        alert("Erro ao reagendar. Verifique se não há conflito de horário.");
      }
    },
    [token, fetchAppointments]
  );

  // Handle resize (duration change)
  const handleAppointmentResize = useCallback(
    async (appointmentId: string, newEndAt: Date) => {
      if (!token) return;
      try {
        await apiFetch(
          `/admin/appointments/${appointmentId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              endAt: newEndAt.toISOString(),
            }),
          },
          token
        );
        await fetchAppointments();
      } catch (error) {
        console.error("Failed to resize appointment:", error);
        alert("Erro ao alterar duração.");
      }
    },
    [token, fetchAppointments]
  );

  // Show delete confirmation
  const handleAppointmentDeleteClick = useCallback((appointmentId: string) => {
    setAppointmentToDelete(appointmentId);
    setDeleteConfirmOpen(true);
  }, []);

  // Confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!token || !appointmentToDelete) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/admin/appointments/${appointmentToDelete}`, { method: "DELETE" }, token);
      await fetchAppointments();
      setDeleteConfirmOpen(false);
      setAppointmentToDelete(null);
    } catch (error) {
      console.error("Failed to delete appointment:", error);
      alert("Erro ao excluir agendamento.");
    } finally {
      setIsDeleting(false);
    }
  }, [token, appointmentToDelete, fetchAppointments]);

  // Save appointment (create or update)
  const handleSaveAppointment = useCallback(
    async (data: {
      id?: string;
      serviceId?: number;
      name: string;
      phone: string;
      startAt: string;
      endAt?: string;
      durationMinutes?: number;
      notes?: string;
    }) => {
      if (!token) return;

      if (data.id) {
        await apiFetch(
          `/admin/appointments/${data.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              startAt: data.startAt,
              endAt: data.endAt,
              notes: data.notes,
            }),
          },
          token
        );
      } else {
        if (!data.serviceId) throw new Error("Service is required");
        await apiFetch(
          "/admin/appointments",
          {
            method: "POST",
            body: JSON.stringify({
              serviceId: data.serviceId,
              startAt: data.startAt,
              name: data.name,
              phone: data.phone,
              durationMinutes: data.durationMinutes,
              notes: data.notes,
            }),
          },
          token
        );
      }
      await fetchAppointments();
    },
    [token, fetchAppointments]
  );

  // Delete from modal
  const handleDeleteFromModal = useCallback(
    async (appointmentId: string) => {
      if (!token) return;
      await apiFetch(`/admin/appointments/${appointmentId}`, { method: "DELETE" }, token);
      await fetchAppointments();
    },
    [token, fetchAppointments]
  );

  // Mark as done
  const openDoneModal = useCallback((appointment: Appointment) => {
    setDoneAppointment(appointment);
    setDoneAmount(String(appointment.servicePrice));
    setDonePayments([{ method: "PIX", amount: String(appointment.servicePrice), installments: "1" }]);
    setDoneModalOpen(true);
  }, []);

  const handleMarkDone = useCallback(async () => {
    if (!token || !doneAppointment) return;
    setIsMarkingDone(true);
    try {
      const amountReceived = parseFloat(doneAmount);
      const payments = donePayments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          method: p.method,
          amount: parseFloat(p.amount),
          installments: parseInt(p.installments) || 1,
        }));

      await apiFetch(
        `/admin/appointments/${doneAppointment.id}/done`,
        {
          method: "PATCH",
          body: JSON.stringify({ amountReceived, payments }),
        },
        token
      );
      await fetchAppointments();
      setDoneModalOpen(false);
      setModalOpen(false);
    } catch (error) {
      console.error("Failed to mark as done:", error);
      alert("Erro ao marcar como concluído.");
    } finally {
      setIsMarkingDone(false);
    }
  }, [token, doneAppointment, doneAmount, donePayments, fetchAppointments]);

  const addPaymentRow = useCallback(() => {
    setDonePayments((prev) => [...prev, { method: "PIX", amount: "", installments: "1" }]);
  }, []);

  const removePaymentRow = useCallback((index: number) => {
    setDonePayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updatePaymentRow = useCallback((index: number, field: string, value: string) => {
    setDonePayments((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }, []);

  // Cancel appointment
  const openCancelModal = useCallback((appointment: Appointment) => {
    setCancelAppointment(appointment);
    setCancelModalOpen(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!token || !cancelAppointment) return;
    setIsCancelling(true);
    try {
      await apiFetch(
        `/admin/appointments/${cancelAppointment.id}/cancel`,
        { method: "PATCH" },
        token
      );
      await fetchAppointments();
      setCancelModalOpen(false);
      setModalOpen(false);
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      alert("Erro ao cancelar agendamento.");
    } finally {
      setIsCancelling(false);
    }
  }, [token, cancelAppointment, fetchAppointments]);

  // Revert appointment to BOOKED
  const handleRevert = useCallback(async (appointment: Appointment) => {
    if (!token) return;
    try {
      await apiFetch(
        `/admin/appointments/${appointment.id}/revert`,
        { method: "PATCH" },
        token
      );
      await fetchAppointments();
      setModalOpen(false);
    } catch (error) {
      console.error("Failed to revert appointment:", error);
      alert("Erro ao reverter agendamento.");
    }
  }, [token, fetchAppointments]);

  // Month view: click day to switch to week view
  const handleMonthDayClick = useCallback((date: Date) => {
    setCurrentWeekStart(getMonday(date));
    setViewMode("week");
  }, []);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <Card>
          <CardContent className="space-y-2 p-6">
            <h1 className="text-xl font-semibold">Agenda administrativa</h1>
            <p className="text-sm text-muted-foreground">Entre como administrador para acessar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-r-none"
            >
              <LayoutList className="mr-1 size-4" />
              Semana
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-l-none"
            >
              <CalendarDays className="mr-1 size-4" />
              Mês
            </Button>
          </div>
          <Button onClick={() => handleSlotClick(new Date())} size="sm">
            <Plus className="mr-1 size-4" />
            Novo
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            Sair
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : viewMode === "week" ? (
        <WeeklyCalendar
          appointments={appointments}
          currentWeekStart={currentWeekStart}
          onPreviousWeek={handlePreviousWeek}
          onNextWeek={handleNextWeek}
          onToday={handleToday}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentDrop={handleAppointmentDrop}
          onAppointmentResize={handleAppointmentResize}
          onAppointmentDelete={handleAppointmentDeleteClick}
          onAppointmentMarkDone={(id) => {
            const apt = appointments.find((a) => a.id === id);
            if (apt && apt.status === "BOOKED") openDoneModal(apt);
          }}
          onAppointmentCancel={(id) => {
            const apt = appointments.find((a) => a.id === id);
            if (apt && apt.status === "BOOKED") openCancelModal(apt);
          }}
          onSlotClick={handleSlotClick}
        />
      ) : (
        /* Month View */
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="text-lg font-medium capitalize">
              {calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            >
              Próximo
              <ChevronRight className="size-4" />
            </Button>
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
                        const aptDate = new Date(appointment.startAt);
                        return (
                          day.dayNumber &&
                          aptDate.getDate() === day.dayNumber &&
                          aptDate.getMonth() === calendarMonth.getMonth() &&
                          aptDate.getFullYear() === calendarMonth.getFullYear()
                        );
                      });
                      const isToday =
                        day.dayNumber &&
                        day.date.toDateString() === new Date().toDateString();
                      return (
                        <div
                          key={`${day.dayNumber ?? "x"}-${index}`}
                          className={cn(
                            "min-h-[72px] cursor-pointer rounded border p-2 text-xs transition-colors hover:bg-accent",
                            day.isCurrentMonth ? "bg-background" : "bg-muted/40 text-muted-foreground",
                            isToday && "ring-2 ring-primary"
                          )}
                          onClick={() => day.dayNumber && handleMonthDayClick(day.date)}
                        >
                          <div className="font-semibold">{day.dayNumber}</div>
                          <div className="mt-1 space-y-1">
                            {dayAppointments.slice(0, 3).map((appointment) => (
                              <div
                                key={appointment.id}
                                className={cn(
                                  "truncate rounded px-1 py-0.5",
                                  appointment.status === "CANCELLED"
                                    ? "bg-muted line-through"
                                    : appointment.status === "DONE"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                    : "bg-secondary"
                                )}
                                title={`${appointment.user.name} - ${appointment.serviceName}`}
                              >
                                {new Date(appointment.startAt).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {" - "}
                                <span className="font-medium">{appointment.user.name.split(" ")[0]}</span>
                              </div>
                            ))}
                            {dayAppointments.length > 3 && (
                              <div className="text-[10px] text-muted-foreground">
                                +{dayAppointments.length - 3} mais
                              </div>
                            )}
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
      )}

      {/* Appointment Create/Edit Modal */}
      <AppointmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        appointment={selectedAppointment}
        initialDate={initialDate}
        services={services}
        users={users}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteFromModal}
        onMarkDone={
          selectedAppointment?.status === "BOOKED"
            ? () => openDoneModal(selectedAppointment)
            : undefined
        }
        onCancel={
          selectedAppointment?.status === "BOOKED"
            ? () => openCancelModal(selectedAppointment)
            : undefined
        }
        onRevert={
          selectedAppointment && (selectedAppointment.status === "DONE" || selectedAppointment.status === "CANCELLED")
            ? () => handleRevert(selectedAppointment)
            : undefined
        }
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Agendamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este agendamento? O ponto de fidelidade será removido do
              cliente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Done Modal */}
      <Dialog open={doneModalOpen} onOpenChange={setDoneModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Marcar como Concluído</DialogTitle>
            <DialogDescription>
              {doneAppointment
                ? `${doneAppointment.serviceName} - ${doneAppointment.user.name}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(() => {
              if (!doneAppointment) return null;
              const originalService = services.find((s) => s.id === doneAppointment.serviceId);
              const originalPrice = originalService?.price ?? doneAppointment.servicePrice;
              const isPromo = originalPrice > doneAppointment.servicePrice;
              return (
                <div className="space-y-2">
                  <Label>Valor referência do serviço</Label>
                  {isPromo ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Promoção aplicada
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground line-through">{formatPrice(originalPrice)}</span>
                        <span className="font-semibold text-green-700">{formatPrice(doneAppointment.servicePrice)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(doneAppointment.servicePrice)}
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label htmlFor="doneAmount">Valor recebido</Label>
              <Input
                id="doneAmount"
                type="number"
                step="0.01"
                min="0"
                value={doneAmount}
                onChange={(e) => setDoneAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pagamentos</Label>
              {donePayments.map((payment, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={payment.method}
                    onValueChange={(v) => updatePaymentRow(index, "method", v)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">Pix</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Valor"
                    value={payment.amount}
                    onChange={(e) => updatePaymentRow(index, "amount", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Parcelas"
                    value={payment.installments}
                    onChange={(e) => updatePaymentRow(index, "installments", e.target.value)}
                    className="w-[80px]"
                  />
                  {donePayments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePaymentRow(index)}
                      className="h-8 px-2"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPaymentRow}>
                + Adicionar forma de pagamento
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDoneModalOpen(false)} disabled={isMarkingDone}>
              Voltar
            </Button>
            <Button onClick={handleMarkDone} disabled={isMarkingDone || !doneAmount}>
              {isMarkingDone ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Agendamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este agendamento?
              {cancelAppointment && (
                <>
                  <br />
                  <strong>
                    {cancelAppointment.serviceName} - {cancelAppointment.user.name}
                  </strong>
                </>
              )}
              <br />O agendamento será mantido no histórico como cancelado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)} disabled={isCancelling}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={isCancelling}>
              {isCancelling ? "Cancelando..." : "Cancelar Agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
