"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import {
  BookingCalendar,
  TimeSlotsPanel,
  ContactForm,
  ServiceSelectionGrid,
} from "@/components/booking";
import { CheckCircle, Clock, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Service = {
  id: number;
  name: string;
  price: number;
  durationMinutes: number;
  coverImage?: string | null;
};

type Slot = {
  startAt: string;
  endAt: string;
  label: string;
};

const strapiBaseUrl =
  process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

const getStrapiMediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${strapiBaseUrl}${url}`;
};

const fetchServices = async (): Promise<Service[]> => {
  const response = await fetch(`${strapiBaseUrl}/api/services?sort=order:asc&populate=coverImage`);
  const json = await response.json();
  return (json?.data ?? []).map((item: any) => {
    const normalized = item?.attributes
      ? { id: item.id, ...item.attributes }
      : item;
    const coverImageUrl = normalized.coverImage?.data?.attributes?.url 
      || normalized.coverImage?.url 
      || null;
    return {
      id: normalized.id,
      name: normalized.name,
      price: Number(normalized.price ?? 0),
      durationMinutes: Number(normalized.durationMinutes ?? 0),
      coverImage: getStrapiMediaUrl(coverImageUrl),
    };
  });
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

type BookingState =
  | { step: "select-services" }
  | { step: "select-date" }
  | { step: "select-time"; date: string }
  | { step: "contact"; date: string; slot: Slot }
  | { step: "success"; date: string; slot: Slot };

export default function AgendaPage() {
  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);

  // Calendar availability
  const [availableDates, setAvailableDates] = useState<Map<string, Slot[]>>(
    new Map()
  );
  const [blockedDates, setBlockedDates] = useState<Array<{ date: string; reason?: string | null }>>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [currentMonthStart, setCurrentMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Booking state
  const [bookingState, setBookingState] = useState<BookingState>({
    step: "select-services",
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Computed values
  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds]
  );

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.price, 0),
    [selectedServices]
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
    [selectedServices]
  );

  // Use the first selected service for availability (simplification)
  const primaryServiceId = selectedServiceIds[0];

  const availableDateSet = useMemo(
    () => new Set(availableDates.keys()),
    [availableDates]
  );

  const selectedDateSlots = useMemo(
    () => (selectedDate ? availableDates.get(selectedDate) ?? [] : []),
    [availableDates, selectedDate]
  );

  // Load services on mount
  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  // Toggle service selection
  const handleToggleService = (serviceId: number) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Continue from service selection to calendar
  const handleContinueToCalendar = () => {
    if (selectedServiceIds.length > 0) {
      setBookingState({ step: "select-date" });
      loadAvailability();
    }
  };

  // Load availability when service or month changes
  const loadAvailability = useCallback(async () => {
    if (!primaryServiceId) return;

    setIsLoadingAvailability(true);

    try {
      const year = currentMonthStart.getFullYear();
      const month = currentMonthStart.getMonth();

      // Get date range: current month and next month
      const today = new Date();
      const fromDate = new Date(Math.max(
        new Date(year, month, 1).getTime(),
        today.setHours(0, 0, 0, 0)
      ));
      const toDate = new Date(year, month + 2, 0); // Last day of next month

      const from = toDateKey(fromDate);
      const to = toDateKey(toDate);

      // Pass total duration for multi-service bookings
      const durationParam = totalDuration > 0 ? `&duration=${totalDuration}` : "";

      // Single request for all availability in range
      const data = await apiFetch<{
        availability: Array<{ date: string; slots: Slot[]; blocked?: boolean; blockedReason?: string | null }>;
        blockedDates: Array<{ date: string; reason?: string | null }>;
      }>(`/services/${primaryServiceId}/availability/range?from=${from}&to=${to}${durationParam}`);

      const newAvailability = new Map<string, Slot[]>();
      for (const day of data.availability) {
        if (day.slots.length > 0) {
          newAvailability.set(day.date, day.slots);
        }
      }

      setAvailableDates(newAvailability);
      setBlockedDates(data.blockedDates ?? []);
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      setAvailableDates(new Map());
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [primaryServiceId, currentMonthStart, totalDuration]);

  useEffect(() => {
    if (bookingState.step !== "select-services" && primaryServiceId) {
      loadAvailability();
    }
  }, [primaryServiceId, currentMonthStart, bookingState.step, loadAvailability]);

  // Handle date selection
  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedSlot(null);
    setSubmitError(null);
    setBookingState({ step: "select-time", date: dateKey });
  };

  // Handle slot selection
  const handleSelectSlot = (slotStart: string) => {
    const slot = selectedDateSlots.find((s) => s.startAt === slotStart);
    if (slot && selectedDate) {
      setSelectedSlot(slot);
      setSubmitError(null);
      setBookingState({ step: "contact", date: selectedDate, slot });
    }
  };

  // Handle booking submission - create appointments for all selected services
  const handleSubmit = async (data: { name: string; phone: string }) => {
    if (selectedServiceIds.length === 0 || !selectedSlot) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (selectedServiceIds.length === 1) {
        // Single service - use regular endpoint
        await apiFetch("/appointments", {
          method: "POST",
          body: JSON.stringify({
            serviceId: selectedServiceIds[0],
            startAt: selectedSlot.startAt,
            name: data.name,
            phone: data.phone,
          }),
        });
      } else {
        // Multiple services - use batch endpoint
        await apiFetch("/appointments/batch", {
          method: "POST",
          body: JSON.stringify({
            serviceIds: selectedServiceIds,
            startAt: selectedSlot.startAt,
            name: data.name,
            phone: data.phone,
          }),
        });
      }

      // Success!
      if (selectedDate) {
        setBookingState({
          step: "success",
          date: selectedDate,
          slot: selectedSlot,
        });
      }

      // Refresh availability
      loadAvailability();
    } catch (error) {
      setSubmitError(
        "Não foi possível confirmar o agendamento. Por favor, tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back to service selection
  const handleBackToServices = () => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setSubmitError(null);
    setBookingState({ step: "select-services" });
  };

  // Reset to start
  const handleNewBooking = () => {
    setSelectedServiceIds([]);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSubmitError(null);
    setBookingState({ step: "select-services" });
  };

  // Success screen
  if (bookingState.step === "success") {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-12">
        <Card className="border-0 bg-gradient-to-br from-white to-pink-50/50 shadow-xl overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-bold font-display">Agendamento confirmado!</h1>
            <p className="text-muted-foreground mt-2">
              {selectedServiceIds.length > 1 ? "Seus horários foram reservados" : "Seu horário foi reservado"} com sucesso.
            </p>

            <div className="mt-8 space-y-3 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 p-6 text-left">
              {selectedServices.map((service) => (
                <div key={service.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.durationMinutes} min</p>
                  </div>
                </div>
              ))}
              <div className="mt-4 border-t border-pink-200 pt-4">
                <p className="text-sm text-muted-foreground capitalize">
                  {new Intl.DateTimeFormat("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date(`${bookingState.date}T12:00:00`))}{" "}
                  às {bookingState.slot.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Duração total: ~{totalDuration} minutos
                </p>
                <p className="mt-2 text-lg font-bold text-primary">
                  Total: {formatPrice(totalPrice)}
                </p>
              </div>
            </div>

            <p className="text-muted-foreground mt-6 text-sm">
              Você receberá uma confirmação no seu telefone.
            </p>

            <Button 
              onClick={handleNewBooking} 
              className="mt-6 bg-gradient-to-r from-primary to-accent-warm text-white shadow-lg"
            >
              Fazer novo agendamento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob blob-pink absolute -top-32 -left-32 h-96 w-96" />
      <div className="blob blob-coral absolute -bottom-32 -right-32 h-80 w-80" />
      
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8">
        {/* Service selection */}
        {bookingState.step === "select-services" && (
          <ServiceSelectionGrid
            services={services}
            selectedIds={selectedServiceIds}
            onToggleService={handleToggleService}
            onContinue={handleContinueToCalendar}
          />
        )}

        {/* Calendar and time selection */}
        {bookingState.step !== "select-services" && selectedServices.length > 0 && (
          <Card className="border-0 bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[320px_1fr_320px]">
                {/* Left panel - Selected services */}
                <div className="border-b bg-gradient-to-br from-pink-50 to-white p-6 lg:border-b-0 lg:border-r">
                  <button
                    type="button"
                    onClick={handleBackToServices}
                    className="mb-6 flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Alterar serviços
                  </button>
                  
                  <h3 className="text-lg font-semibold text-foreground mb-4">Serviços Selecionados</h3>
                  
                  <div className="space-y-3">
                    {selectedServices.map((service) => (
                      <div key={service.id} className="rounded-xl bg-white p-4 shadow-sm">
                        <p className="font-medium text-foreground">{service.name}</p>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {service.durationMinutes} min
                          </span>
                          <span className="font-semibold text-primary">{formatPrice(service.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold text-primary">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Duração</span>
                      <span className="font-medium text-foreground">~{totalDuration} min</span>
                    </div>
                  </div>
                </div>

                {/* Center panel - Calendar */}
                <div className="border-b p-6 lg:border-b-0 lg:border-r">
                  <h3 className="mb-4 text-center text-lg font-semibold text-foreground">
                    Selecione uma data
                  </h3>
                  <BookingCalendar
                    availableDates={availableDateSet}
                    blockedDates={blockedDates}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                    isLoading={isLoadingAvailability}
                  />
                </div>

                {/* Right panel - Time slots or Contact form */}
                <div className="p-6">
                  {bookingState.step === "select-date" && (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
                        <Clock className="h-8 w-8 text-primary/50" />
                      </div>
                      <p className="text-muted-foreground">
                        Selecione uma data para ver os horários disponíveis
                      </p>
                    </div>
                  )}

                  {bookingState.step === "select-time" && selectedDate && (
                    <TimeSlotsPanel
                      date={selectedDate}
                      slots={selectedDateSlots}
                      selectedSlot={selectedSlot?.startAt ?? null}
                      onSelectSlot={handleSelectSlot}
                    />
                  )}

                  {bookingState.step === "contact" && selectedDate && selectedSlot && (
                    <ContactForm
                      serviceName={selectedServices.map(s => s.name).join(", ")}
                      date={selectedDate}
                      time={selectedSlot.label}
                      onSubmit={handleSubmit}
                      isSubmitting={isSubmitting}
                      error={submitError}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
