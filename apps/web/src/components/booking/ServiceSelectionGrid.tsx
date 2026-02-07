"use client";

import Image from "next/image";
import { Check, Clock, Sparkles, Tag, Timer, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Service = {
  id: number;
  name: string;
  price: number;
  durationMinutes: number;
  coverImage?: string | null;
  promotion?: {
    promotionalPrice: number;
    endDate: string;
    validPaymentMethods?: string[];
  } | null;
  originalPrice?: number;
};

type ServiceSelectionGridProps = {
  services: Service[];
  selectedIds: number[];
  onToggleService: (serviceId: number) => void;
  onContinue: () => void;
};

const formatPrice = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function ServiceSelectionGrid({
  services,
  selectedIds,
  onToggleService,
  onContinue,
}: ServiceSelectionGridProps) {
  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold font-display md:text-3xl">Selecione os Serviços</h1>
        <p className="mt-2 text-muted-foreground">Escolha um ou mais serviços para agendar</p>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        {services.map((service) => {
          const isSelected = selectedIds.includes(service.id);
          
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onToggleService(service.id)}
              className="text-left"
            >
              <Card 
                className={`selection-card h-full transition-all duration-200 !p-0 !gap-0 ${
                  isSelected ? "selected" : ""
                } ${service.promotion ? "ring-2 ring-red-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]" : ""}`}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl">
                  {service.coverImage ? (
                    <Image
                      src={service.coverImage}
                      alt={service.name}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-secondary to-accent/50">
                      <Sparkles className="h-8 w-8 sm:h-12 sm:w-12 text-primary/40" />
                    </div>
                  )}
                  
                  {/* Selection indicator */}
                  <div className={`check-overlay ${isSelected ? "!bg-primary !opacity-100" : ""}`}>
                    {isSelected ? (
                      <Check className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                    ) : (
                      <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  
                  {/* Selected overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/10" />
                  )}
                </div>
                
                {/* Promotion badge */}
                {service.promotion && (
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-white shadow-lg">
                    <Tag className="h-3 w-3" />
                    Promoção
                  </div>
                )}

                {/* Content */}
                <CardContent className="p-2 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2">{service.name}</h3>
                  <div className="mt-1 sm:mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>{service.durationMinutes} min</span>
                    </div>
                    {service.promotion ? (
                      <div className="text-right">
                        <span className="block text-[10px] sm:text-xs text-muted-foreground line-through">
                          {formatPrice(service.originalPrice ?? service.promotion.promotionalPrice)}
                        </span>
                        <span className="text-xs sm:text-base font-bold text-red-600">
                          {formatPrice(service.price)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs sm:text-base font-semibold text-primary">{formatPrice(service.price)}</span>
                    )}
                  </div>
                  {service.promotion && (
                    <div className="mt-2 rounded-md bg-gradient-to-r from-red-50 to-orange-50 p-1.5 sm:p-2 border border-red-100">
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-red-600 font-semibold">
                        <Timer className="h-3 w-3 shrink-0" />
                        <span>
                          Até {new Date(service.promotion.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}
                          {" às "}
                          {new Date(service.promotion.endDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                        </span>
                      </div>
                      {service.promotion.validPaymentMethods && service.promotion.validPaymentMethods.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-xs text-muted-foreground">
                          <CreditCard className="h-3 w-3 shrink-0" />
                          <span>{service.promotion.validPaymentMethods.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Empty state hint */}
      {selectedIds.length === 0 && (
        <p className="text-center text-sm text-muted-foreground pb-4">
          Selecione pelo menos um serviço para continuar
        </p>
      )}

      {/* Spacer for fixed bottom bar */}
      {selectedIds.length > 0 && <div className="h-32 sm:h-24" />}

      {/* Summary and Continue - Fixed at bottom */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 bg-white/80 backdrop-blur-md border-t border-accent/30">
          <div className="mx-auto max-w-6xl">
            <Card className="border-0 bg-gradient-to-r from-primary to-accent-sage p-0.5 sm:p-1 shadow-2xl">
              <CardContent className="flex flex-col items-center gap-3 sm:gap-4 rounded-xl bg-white p-3 sm:p-4 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-center sm:text-left">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Selecionados</p>
                    <p className="text-base sm:text-xl font-bold text-foreground">
                      {selectedIds.length} {selectedIds.length === 1 ? "serviço" : "serviços"}
                    </p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-border hidden sm:block" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Duração total</p>
                    <p className="text-base sm:text-xl font-bold text-foreground">~{totalDuration} min</p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-border hidden sm:block" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                    <p className="text-base sm:text-xl font-bold text-primary">{formatPrice(totalPrice)}</p>
                  </div>
                </div>
                <Button
                  onClick={onContinue}
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-accent-sage text-white shadow-lg sm:w-auto"
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
