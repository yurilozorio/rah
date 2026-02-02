"use client";

import { Clock } from "lucide-react";

type ServiceCardProps = {
  name: string;
  durationMinutes: number;
  price: number;
};

const formatPrice = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function ServiceCard({ name, durationMinutes, price }: ServiceCardProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">{name}</h2>
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Clock className="size-4" />
        <span>{durationMinutes} min</span>
      </div>
      <p className="text-lg font-medium">{formatPrice(price)}</p>
    </div>
  );
}
