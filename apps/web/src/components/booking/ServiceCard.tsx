"use client";

import { Clock, Tag, Timer, CreditCard } from "lucide-react";

type ServiceCardProps = {
  name: string;
  durationMinutes: number;
  price: number;
  promotion?: {
    promotionalPrice: number;
    originalPrice: number;
    endDate: string;
    validPaymentMethods?: string[];
    paymentMethodsLabel?: string;
  } | null;
};

const formatPrice = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function ServiceCard({ name, durationMinutes, price, promotion }: ServiceCardProps) {
  return (
    <div className="space-y-3">
      {promotion && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
          <Tag className="size-3" />
          Promoção
        </div>
      )}
      <h2 className="text-xl font-semibold">{name}</h2>
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Clock className="size-4" />
        <span>{durationMinutes} min</span>
      </div>
      {promotion ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <p className="text-sm text-muted-foreground line-through">{formatPrice(promotion.originalPrice)}</p>
            <p className="text-lg font-bold text-red-600">{formatPrice(price)}</p>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-red-50 to-orange-50 p-2.5 border border-red-100 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
              <Timer className="h-3.5 w-3.5 shrink-0" />
              <span>
                Até {new Date(promotion.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}
                {" às "}
                {new Date(promotion.endDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </span>
            </div>
            {promotion.validPaymentMethods && promotion.validPaymentMethods.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span>{promotion.paymentMethodsLabel ? `${promotion.paymentMethodsLabel} ` : ""}{promotion.validPaymentMethods.join(", ")}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-lg font-medium">{formatPrice(price)}</p>
      )}
    </div>
  );
}
