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
import { Pencil, RotateCcw } from "lucide-react";

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
  servicePrice?: number;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "DONE";
  notes?: string;
  amountReceived?: number;
  payments?: Payment[];
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
  onMarkDone?: () => void;
  onCancel?: () => void;
  onRevert?: () => void;
};

const formatDateTimeLocal = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }) + ", " + d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h}h ${m}min`;
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
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
  onMarkDone,
  onCancel,
  onRevert,
}: AppointmentModalProps) {
  const isEditing = !!appointment;
  const [mode, setMode] = useState<"view" | "edit">("view");

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
    ).slice(0, 8);
  }, [searchQuery, users]);

  // Reset form when modal opens/closes or appointment changes
  useEffect(() => {
    if (open) {
      if (appointment) {
        setMode("view"); // Always open in view mode for existing appointments
        setSelectedServiceId(appointment.serviceId?.toString() || "");
        setName(appointment.user.name);
        setPhone(appointment.user.phone);
        setStartAt(formatDateTimeLocal(new Date(appointment.startAt)));
        setDurationMinutes(appointment.serviceDurationMin || 60);
        setNotes(appointment.notes || "");
        setSearchQuery("");
        setSelectedUserFromSuggestion(false);
      } else {
        setMode("edit"); // New appointments go straight to edit mode
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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    setSelectedUserFromSuggestion(false);
    setName(value);
  };

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

  const statusLabel = appointment?.status === "DONE"
    ? "Concluído"
    : appointment?.status === "CANCELLED"
    ? "Cancelado"
    : "Confirmado";

  const statusColor = appointment?.status === "DONE"
    ? "bg-green-100 text-green-800 border-green-300"
    : appointment?.status === "CANCELLED"
    ? "bg-muted text-muted-foreground border-muted"
    : "bg-primary/10 text-primary border-primary/30";

  // ─── VIEW MODE ───────────────────────────────────────────
  if (isEditing && mode === "view") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle>Agendamento</DialogTitle>
                <DialogDescription className="sr-only">Detalhes do agendamento</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", statusColor)}>
                  {statusLabel}
                </span>
                {appointment.status === "BOOKED" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setMode("edit")}
                    title="Editar"
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client info */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{appointment.user.name}</p>
              <p className="text-sm text-muted-foreground">{appointment.user.phone}</p>
            </div>

            {/* Service & Price */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Serviço</p>
              <p className="font-medium">{appointment.serviceName}</p>
              {(() => {
                const originalService = services.find((s) => s.id === appointment.serviceId);
                const originalPrice = originalService?.price ?? appointment.servicePrice;
                const isPromo = originalPrice != null && appointment.servicePrice != null && originalPrice > appointment.servicePrice;
                if (isPromo) {
                  return (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(originalPrice)}</span>
                      <span className="text-sm font-semibold text-green-700">{formatPrice(appointment.servicePrice!)}</span>
                      <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Promoção
                      </span>
                    </div>
                  );
                }
                if (appointment.servicePrice != null) {
                  return <p className="text-sm text-muted-foreground">{formatPrice(appointment.servicePrice)}</p>;
                }
                return null;
              })()}
            </div>

            {/* Date & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Data e Hora</p>
                <p className="font-medium">{formatDateTime(appointment.startAt)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Duração</p>
                <p className="font-medium">{formatDuration(appointment.serviceDurationMin)}</p>
              </div>
            </div>

            {/* Notes */}
            {appointment.notes && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="text-sm whitespace-pre-line">{appointment.notes}</p>
              </div>
            )}

            {/* Payment info for DONE appointments */}
            {appointment.status === "DONE" && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-green-800">Pagamento</p>
                {appointment.amountReceived != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Valor recebido</span>
                    <span className="font-semibold text-green-800">{formatPrice(Number(appointment.amountReceived))}</span>
                  </div>
                )}
                {appointment.payments && appointment.payments.length > 0 && (
                  <div className="space-y-1">
                    {appointment.payments.map((p, i) => (
                      <div key={p.id || i} className="flex items-center justify-between text-sm text-green-700">
                        <span>
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                          {p.installments > 1 && ` (${p.installments}x)`}
                        </span>
                        <span>{formatPrice(Number(p.amount))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-col">
            {/* Status action buttons for BOOKED */}
            {(onMarkDone || onCancel) && (
              <div className="flex gap-2 w-full">
                {onMarkDone && (
                  <Button
                    type="button"
                    onClick={onMarkDone}
                    size="sm"
                    className="flex-1 bg-green-600 text-white hover:bg-green-700"
                  >
                    Concluir
                  </Button>
                )}
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    Cancelar Agend.
                  </Button>
                )}
                {onDelete && appointment.status === "BOOKED" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-1 border-red-200 text-destructive hover:bg-destructive/10"
                  >
                    Excluir
                  </Button>
                )}
              </div>
            )}

            {/* Revert for DONE/CANCELLED */}
            {onRevert && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRevert}
                className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Reverter para Confirmado
              </Button>
            )}

            {/* Close */}
            <div className="flex gap-2 w-full border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Fechar
              </Button>
              {appointment.status === "BOOKED" && (
                <Button
                  type="button"
                  onClick={() => setMode("edit")}
                  className="flex-1"
                >
                  <Pencil className="mr-1.5 size-3.5" />
                  Editar
                </Button>
              )}
            </div>
          </DialogFooter>

          {/* Delete confirm inline */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/95 p-6">
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Tem certeza que deseja excluir este agendamento?
                  O ponto de fidelidade será removido do cliente.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? "Excluindo..." : "Excluir"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // ─── EDIT / CREATE MODE ──────────────────────────────────
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
                  <Input id="name" value={name} disabled className="bg-muted" />
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
                    if (selectedUserFromSuggestion) setSelectedUserFromSuggestion(false);
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

              {/* Service */}
              {!isEditing ? (
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
              ) : (
                <div className="grid gap-2">
                  <Label>Serviço</Label>
                  <Input value={appointment?.serviceName || ""} disabled className="bg-muted" />
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

            <DialogFooter className="flex-col gap-3 pt-2 sm:flex-col">
              <div className="flex gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (isEditing) {
                      setMode("view");
                    } else {
                      onOpenChange(false);
                    }
                  }}
                  className="flex-1"
                >
                  {isEditing ? "Cancelar" : "Voltar"}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
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
