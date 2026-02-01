"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export default function AdminLoyaltyPage() {
  const { token, user } = useAuth();
  const [phone, setPhone] = useState("");
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("Ajuste manual");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <Card>
          <CardContent className="space-y-2 p-6">
            <h1 className="text-xl font-semibold">Fidelidade</h1>
            <p className="text-sm text-muted-foreground">Entre como administrador para acessar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!token || !phone) return;
    setStatus(null);
    setIsSubmitting(true);
    try {
      await apiFetch(
        "/admin/loyalty/adjust",
        {
          method: "POST",
          body: JSON.stringify({
            phone: phone.replace(/\D/g, ""),
            points,
            reason
          })
        },
        token
      );
      setStatus("Ajuste aplicado com sucesso!");
      setPhone("");
      setPoints(1);
      setReason("Ajuste manual");
    } catch (error) {
      setStatus("Erro ao ajustar pontos. Verifique se o telefone está correto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Fidelidade</h1>
      <Card className="mt-6">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <Label>Telefone do cliente</Label>
            <Input 
              type="tel" 
              placeholder="Ex: 27999999999"
              value={phone} 
              onChange={(event) => setPhone(event.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label>Novos pontos</Label>
            <Input 
              type="number" 
              min={0}
              placeholder="Total de pontos"
              value={points} 
              onChange={(event) => setPoints(Number(event.target.value))} 
            />
            <p className="text-xs text-muted-foreground">Este valor substituirá os pontos atuais</p>
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={!phone || isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar ajuste"}
          </Button>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
