"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export default function AdminPage() {
  const { token, setToken, user, setUser, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: { role: "USER" | "ADMIN" } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      window.localStorage.setItem("authToken", data.token);
      setToken(data.token);
      setUser(data.user as any);
    } catch (loginError) {
      setError("Email ou senha inválidos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token || !user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Card className="mt-6">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Entrar como administrador</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button onClick={handleLogin} disabled={!email || !password || isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Button variant="outline" onClick={logout}>
          Sair
        </Button>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-5">
            <h2 className="text-sm sm:text-lg font-semibold">Agenda</h2>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Visualize todos os agendamentos.</p>
            <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-10">
              <Link href="/painel/agenda">Abrir agenda</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-5">
            <h2 className="text-sm sm:text-lg font-semibold">Calendário</h2>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Visão mensal da agenda.</p>
            <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-10">
              <Link href="/painel/calendar">Abrir calendário</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-5">
            <h2 className="text-sm sm:text-lg font-semibold">Disponibilidade</h2>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Gerencie horários por serviço.</p>
            <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-10">
              <Link href="/painel/availability">Configurar horários</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-5">
            <h2 className="text-sm sm:text-lg font-semibold">Fidelidade</h2>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Ajuste de pontos.</p>
            <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-10">
              <Link href="/painel/loyalty">Gerenciar pontos</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-5">
            <h2 className="text-sm sm:text-lg font-semibold">Conteúdo (Strapi)</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Gerencie serviços, depoimentos, equipe e fotos.</p>
            <Button asChild size="sm" className="text-xs sm:text-sm h-8 sm:h-10">
              <a href="/admin" target="_blank" rel="noreferrer">
                Abrir Strapi Admin
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
