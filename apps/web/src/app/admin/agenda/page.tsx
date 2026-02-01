"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

type Appointment = {
  id: string;
  serviceName: string;
  serviceId: number;
  serviceDurationMin: number;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED";
  notes?: string;
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

const strapiBaseUrl =
  process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

export default function AdminAgendaPage() {
  const { token, user, logout } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMonday(new Date()));
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Fetch services from Strapi
  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch(`${strapiBaseUrl}/api/services?sort=order:asc`);
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
  const handleAppointmentClick = useCallback((appointment: CalendarAppointment) => {
    const fullAppointment = appointments.find((a) => a.id === appointment.id);
    if (fullAppointment) {
      setSelectedAppointment(fullAppointment);
      setInitialDate(null);
      setModalOpen(true);
    }
  }, [appointments]);

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
      await apiFetch(
        `/admin/appointments/${appointmentToDelete}`,
        { method: "DELETE" },
        token
      );
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
        // Update existing appointment
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
        // Create new appointment
        if (!data.serviceId) {
          throw new Error("Service is required");
        }
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

      await apiFetch(
        `/admin/appointments/${appointmentId}`,
        { method: "DELETE" },
        token
      );
      await fetchAppointments();
    },
    [token, fetchAppointments]
  );

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
          <Button onClick={() => handleSlotClick(new Date())} size="sm">
            <Plus className="mr-1 size-4" />
            Novo Agendamento
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
      ) : (
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
          onSlotClick={handleSlotClick}
        />
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
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Agendamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este agendamento? 
              O ponto de fidelidade será removido do cliente.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
