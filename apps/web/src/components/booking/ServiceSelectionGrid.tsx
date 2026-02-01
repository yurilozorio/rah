"use client";

import Image from "next/image";
import { Check, Clock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Service = {
  id: number;
  name: string;
  price: number;
  durationMinutes: number;
  coverImage?: string | null;
};

type ServiceSelectionGridProps = {
  services: Service[];
  selectedIds: number[];
  onToggleService: (serviceId: number) => void;
  onContinue: () => void;
};

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                className={`selection-card h-full transition-all duration-200 ${
                  isSelected ? "selected" : ""
                }`}
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
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-100 to-rose-100">
                      <Sparkles className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                  
                  {/* Selection indicator */}
                  <div className={`check-overlay ${isSelected ? "!bg-primary !opacity-100" : ""}`}>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  
                  {/* Selected overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/10" />
                  )}
                </div>
                
                {/* Content */}
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground">{service.name}</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{service.durationMinutes} min</span>
                    </div>
                    <span className="font-semibold text-primary">{formatPrice(service.price)}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Summary and Continue */}
      {selectedIds.length > 0 && (
        <Card className="sticky bottom-4 border-0 bg-gradient-to-r from-primary to-accent-warm p-1 shadow-2xl">
          <CardContent className="flex flex-col items-center gap-4 rounded-xl bg-white p-6 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap items-center justify-center gap-6 text-center sm:text-left">
              <div>
                <p className="text-sm text-muted-foreground">Selecionados</p>
                <p className="text-xl font-bold text-foreground">
                  {selectedIds.length} {selectedIds.length === 1 ? "serviço" : "serviços"}
                </p>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div>
                <p className="text-sm text-muted-foreground">Duração total</p>
                <p className="text-xl font-bold text-foreground">~{totalDuration} min</p>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-primary">{formatPrice(totalPrice)}</p>
              </div>
            </div>
            <Button
              onClick={onContinue}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-accent-warm text-white shadow-lg sm:w-auto"
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state hint */}
      {selectedIds.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Selecione pelo menos um serviço para continuar
        </p>
      )}
    </div>
  );
}
