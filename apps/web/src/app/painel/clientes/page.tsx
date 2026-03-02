"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Client = {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  appointmentsCount: number;
  createdAt: string;
  updatedAt: string;
};

type ClientsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

type ClientsResponse = {
  clients: Client[];
  pagination: ClientsPagination;
};

type FetchClientsParams = {
  search: string;
  page: number;
  showInitialLoader?: boolean;
};

const DEFAULT_PAGE_SIZE = 12;

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Erro inesperado.";
  }

  const raw = error.message.trim();
  if (!raw) {
    return "Erro inesperado.";
  }

  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Ignore parsing errors and fallback to raw message
  }

  return raw;
};

export default function AdminClientsPage() {
  const { token, user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ClientsPagination>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const isEditing = editingId !== null;
  const hasLoadedRef = useRef(false);
  const requestCounterRef = useRef(0);

  const fetchClients = useCallback(
    async ({ search, page, showInitialLoader = false }: FetchClientsParams) => {
      if (!token) return;
      const requestId = ++requestCounterRef.current;

      if (showInitialLoader) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
      try {
        const params = new URLSearchParams();
        if (search) {
          params.set("q", search);
        }
        params.set("page", String(page));
        params.set("pageSize", String(DEFAULT_PAGE_SIZE));

        const suffix = params.toString() ? `?${params.toString()}` : "";
        const data = await apiFetch<ClientsResponse>(`/admin/clients${suffix}`, {}, token);

        if (requestId !== requestCounterRef.current) return;

        setClients(data.clients);
        setPagination(data.pagination);

        if (data.pagination.page !== page) {
          setPage(data.pagination.page);
        }
      } catch (error) {
        if (requestId !== requestCounterRef.current) return;
        setStatus({ type: "error", message: getErrorMessage(error) });
      } finally {
        if (requestId !== requestCounterRef.current) return;
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!token || !user || user.role !== "ADMIN") return;
    const showInitialLoader = !hasLoadedRef.current;
    hasLoadedRef.current = true;

    fetchClients({
      search: debouncedQuery,
      page,
      showInitialLoader
    });
  }, [token, user, debouncedQuery, page, fetchClients]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setLoyaltyPoints(0);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setStatus(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setPhone(client.phone);
    setLoyaltyPoints(client.loyaltyPoints);
    setStatus(null);
    setIsModalOpen(true);
  };

  const handleSearchChange = (value: string) => {
    setStatus(null);
    setQuery(value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !name.trim() || !phone.trim()) return;

    setStatus(null);
    setIsSaving(true);
    try {
      if (isEditing && editingId) {
        await apiFetch(
          `/admin/clients/${editingId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: name.trim(),
              phone: phone.trim(),
              loyaltyPoints
            })
          },
          token
        );
        setStatus({ type: "success", message: "Cliente atualizado com sucesso." });
      } else {
        await apiFetch(
          "/admin/clients",
          {
            method: "POST",
            body: JSON.stringify({
              name: name.trim(),
              phone: phone.trim(),
              loyaltyPoints
            })
          },
          token
        );
        setStatus({ type: "success", message: "Cliente criado com sucesso." });
      }

      setIsModalOpen(false);
      resetForm();
      await fetchClients({
        search: query.trim(),
        page,
        showInitialLoader: false
      });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!token) return;
    const confirmed = window.confirm(`Excluir cliente "${client.name}"?`);
    if (!confirmed) return;

    setStatus(null);
    setDeletingId(client.id);
    try {
      await apiFetch(`/admin/clients/${client.id}`, { method: "DELETE" }, token);
      setStatus({ type: "success", message: "Cliente excluido com sucesso." });

      if (editingId === client.id) {
        setIsModalOpen(false);
        resetForm();
      }

      await fetchClients({
        search: query.trim(),
        page,
        showInitialLoader: false
      });
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  };

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <Card>
          <CardContent className="space-y-2 p-6">
            <h1 className="text-xl font-semibold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Entre como administrador para acessar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie clientes sem depender do CMS.</p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          <Plus className="mr-1 size-4" />
          Novo cliente
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" />
                Lista de clientes
              </CardTitle>
              <CardDescription>Tabela com busca em tempo real, edicao e exclusao.</CardDescription>
            </div>
            <Badge variant="outline">{pagination.total} clientes</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou telefone"
                value={query}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={handleClearSearch} disabled={isRefreshing || !query}>
              Limpar
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Busca automatica ao digitar.</span>
            {isRefreshing ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                Atualizando...
              </span>
            ) : null}
          </div>

          {status ? (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                status.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {status.message}
            </div>
          ) : null}

          {isInitialLoading ? (
            <p className="text-sm text-muted-foreground">Carregando clientes...</p>
          ) : clients.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Telefone</th>
                    <th className="px-4 py-3 font-medium">Pontos</th>
                    <th className="px-4 py-3 font-medium">Agendamentos</th>
                    <th className="px-4 py-3 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-t transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{client.name}</td>
                      <td className="px-4 py-3 font-mono text-xs sm:text-sm">{client.phone}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{client.loyaltyPoints}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{client.appointmentsCount}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditModal(client)}>
                            <Pencil className="mr-1 size-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingId === client.id}
                            onClick={() => handleDelete(client)}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            {deletingId === client.id ? "Excluindo..." : "Excluir"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Pagina {pagination.page} de {pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!pagination.hasPrev || isRefreshing}
                    onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!pagination.hasNext || isRefreshing}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                  >
                    Proxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => (open ? setIsModalOpen(true) : closeModal())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>
              Informe os dados do cliente. O telefone e normalizado automaticamente no backend.
            </DialogDescription>
          </DialogHeader>

          <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Nome</Label>
              <Input
                id="client-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone">Telefone</Label>
              <Input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Ex: 27997794889 ou 5527997794889"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-loyalty-points">Pontos</Label>
              <Input
                id="client-loyalty-points"
                type="number"
                min={0}
                step={1}
                value={loyaltyPoints}
                onChange={(event) => setLoyaltyPoints(Math.max(0, Number(event.target.value) || 0))}
                placeholder="0"
              />
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
              Cancelar
            </Button>
            <Button form="client-form" type="submit" disabled={!name.trim() || !phone.trim() || isSaving}>
              {isSaving ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Criar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
