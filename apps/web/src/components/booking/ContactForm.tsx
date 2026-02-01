"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContactFormProps = {
  serviceName: string;
  date: string;
  time: string;
  onSubmit: (data: { name: string; phone: string }) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
};

const formatDateDisplay = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
};

// Format phone as (XX) XXXXX-XXXX
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export function ContactForm({
  serviceName,
  date,
  time,
  onSubmit,
  isSubmitting = false,
  error = null,
}: ContactFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Get raw phone digits
    const rawPhone = phone.replace(/\D/g, "");
    await onSubmit({ name: name.trim(), phone: rawPhone });
  };

  const isValid = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Booking summary */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="font-semibold">{serviceName}</h3>
        <p className="text-muted-foreground mt-1 text-sm capitalize">
          {formatDateDisplay(date)} às {time}
        </p>
      </div>

      {/* Contact fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            type="text"
            placeholder="Seu nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            required
            minLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={handlePhoneChange}
            disabled={isSubmitting}
            required
          />
          <p className="text-muted-foreground text-xs">
            Usaremos este número para enviar a confirmação
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full"
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? "Confirmando..." : "Confirmar agendamento"}
      </Button>
    </form>
  );
}
