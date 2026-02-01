"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

type Appointment = {
  id: string;
  serviceName: string;
  serviceId: number;
  serviceDurationMin: number;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED";
  notes?: string;
  user: { name: string; phone: string };
};

type AppointmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  initialDate?: Date | null;
  services: Service[];
  users: User[];
  onSave: (data: {
    id?: string;
    serviceId?: number;
    name: string;
    phone: string;
    startAt: string;
    endAt?: string;
    durationMinutes?: number;
    notes?: string;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

const formatDateTimeLocal = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: 75, label: "1h 15min" },
  { value: 90, label: "1h 30min" },
  { value: 105, label: "1h 45min" },
  { value: 120, label: "2 horas" },
  { value: 150, label: "2h 30min" },
  { value: 180, label: "3 horas" },
];

export function AppointmentModal({
  open,
  onOpenChange,
  appointment,
  initialDate,
  services,
  users,
  onSave,
  onDelete,
}: AppointmentModalProps) {
  const isEditing = !!appointment;
  
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [startAt, setStartAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUserFromSuggestion, setSelectedUserFromSuggestion] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter users based on search query (name or phone)
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.phone.includes(query)
    ).slice(0, 8); // Limit to 8 suggestions
  }, [searchQuery, users]);

  // Reset form when modal opens/closes or appointment changes
  useEffect(() => {
    if (open) {
      if (appointment) {
        // Editing mode
        setSelectedServiceId(appointment.serviceId?.toString() || "");
        setName(appointment.user.name);
        setPhone(appointment.user.phone);
        setStartAt(formatDateTimeLocal(new Date(appointment.startAt)));
        setDurationMinutes(appointment.serviceDurationMin || 60);
        setNotes(appointment.notes || "");
        setSearchQuery("");
        setSelectedUserFromSuggestion(false);
      } else {
        // Creating mode
        setSelectedServiceId("");
        setName("");
        setPhone("");
        setStartAt(initialDate ? formatDateTimeLocal(initialDate) : "");
        setDurationMinutes(60);
        setNotes("");
        setSearchQuery("");
        setSelectedUserFromSuggestion(false);
      }
      setShowDeleteConfirm(false);
      setShowSuggestions(false);
    }
  }, [open, appointment, initialDate]);

  // When service changes, update duration to service default
  useEffect(() => {
    if (selectedServiceId && !isEditing) {
      const service = services.find((s) => s.id.toString() === selectedServiceId);
      if (service) {
        setDurationMinutes(service.durationMinutes);
      }
    }
  }, [selectedServiceId, services, isEditing]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    // If user is typing, clear the selected user flag
    setSelectedUserFromSuggestion(false);
    // Update name field as they type (so they can manually enter a new user)
    setName(value);
  };

  // Handle selecting a user from suggestions
  const handleSelectUser = (user: User) => {
    setName(user.name);
    setPhone(user.phone);
    setSearchQuery(user.name);
    setSelectedUserFromSuggestion(true);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const startDate = new Date(startAt);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      await onSave({
        id: appointment?.id,
        serviceId: selectedServiceId ? parseInt(selectedServiceId, 10) : undefined,
        name,
        phone,
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        durationMinutes,
        notes: notes || undefined,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save appointment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment || !onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(appointment.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete appointment:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Agendamento" : "Novo Agendamento"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do agendamento abaixo."
              : "Preencha os dados para criar um novo agendamento."}
          </DialogDescription>
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir este agendamento? 
              O ponto de fidelidade será removido do cliente.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Name with autocomplete (only when creating) */}
              {!isEditing ? (
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome do Cliente</Label>
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      id="name"
                      value={searchQuery || name}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => searchQuery && setShowSuggestions(true)}
                      placeholder="Digite o nome ou telefone para buscar..."
                      required
                      autoComplete="off"
                    />
                    {/* Suggestions dropdown */}
                    {showSuggestions && filteredUsers.length > 0 && (
                      <div
                        ref={suggestionsRef}
                        className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
                      >
                        <div className="max-h-60 overflow-auto py-1">
                          {filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleSelectUser(user)}
                              className={cn(
                                "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent",
                                "focus:bg-accent focus:outline-none"
                              )}
                            >
                              <span className="font-medium">{user.name}</span>
                              <span className="text-muted-foreground">{user.phone}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Helper text */}
                    {!selectedUserFromSuggestion && searchQuery && filteredUsers.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Novo cliente será criado
                      </p>
                    )}
                    {selectedUserFromSuggestion && (
                      <p className="mt-1 text-xs text-green-600">
                        Cliente existente selecionado
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}

              {/* Phone */}
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    // If user manually changes phone after selecting a suggestion, unflag it
                    if (selectedUserFromSuggestion) {
                      setSelectedUserFromSuggestion(false);
                    }
                  }}
                  placeholder="11999999999"
                  required
                  disabled={isEditing}
                  className={isEditing ? "bg-muted" : ""}
                />
                {!isEditing && !selectedUserFromSuggestion && phone && (
                  <p className="text-xs text-muted-foreground">
                    Se o telefone já existir, o agendamento será vinculado ao cliente existente
                  </p>
                )}
              </div>

              {/* Service selection (only when creating) */}
              {!isEditing && (
                <div className="grid gap-2">
                  <Label htmlFor="service">Serviço</Label>
                  <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id.toString()}>
                          {service.name} ({service.durationMinutes}min - R${service.price})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date/Time */}
              <div className="grid gap-2">
                <Label htmlFor="startAt">Data e Hora</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </div>

              {/* Duration */}
              <div className="grid gap-2">
                <Label htmlFor="duration">Duração</Label>
                <Select
                  value={durationMinutes.toString()}
                  onValueChange={(v) => setDurationMinutes(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="grid gap-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações opcionais"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full sm:w-auto"
                >
                  Excluir
                </Button>
              )}
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
