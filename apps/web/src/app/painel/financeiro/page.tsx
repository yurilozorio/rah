"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type SummaryData = {
  totalRevenue: number;
  totalCost: number;
  profit: number;
  appointmentCount: number;
};

type ByServiceItem = {
  serviceName: string;
  revenue: number;
  cost: number;
  count: number;
};

type ByPaymentMethodItem = {
  method: string;
  total: number;
  count: number;
};

type DailyItem = {
  date: string;
  revenue: number;
  cost: number;
  count: number;
};

type DatePreset = "this_month" | "last_month" | "custom";

const CHART_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#ef4444", // red
];

const PIE_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c"];

const METHOD_LABELS: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

function getMonthRange(date: Date): { from: string; to: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export default function FinanceiroPage() {
  const { token, user } = useAuth();

  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [byService, setByService] = useState<ByServiceItem[]>([]);
  const [byPaymentMethod, setByPaymentMethod] = useState<ByPaymentMethodItem[]>([]);
  const [daily, setDaily] = useState<DailyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateRange = useMemo(() => {
    if (preset === "this_month") {
      return getMonthRange(new Date());
    }
    if (preset === "last_month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return getMonthRange(d);
    }
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    if (!token || !dateRange.from || !dateRange.to) return;
    setIsLoading(true);

    try {
      const params = `from=${dateRange.from}&to=${dateRange.to}`;
      const [summaryData, serviceData, methodData, dailyData] = await Promise.all([
        apiFetch<SummaryData>(`/admin/financial/summary?${params}`, {}, token),
        apiFetch<{ data: ByServiceItem[] }>(`/admin/financial/by-service?${params}`, {}, token),
        apiFetch<{ data: ByPaymentMethodItem[] }>(`/admin/financial/by-payment-method?${params}`, {}, token),
        apiFetch<{ data: DailyItem[] }>(`/admin/financial/daily?${params}`, {}, token),
      ]);

      setSummary(summaryData);
      setByService(serviceData.data);
      setByPaymentMethod(methodData.data);
      setDaily(dailyData.data);
    } catch (error) {
      console.error("Failed to fetch financial data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <Card>
          <CardContent className="space-y-2 p-6">
            <h1 className="text-xl font-semibold">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Entre como administrador para acessar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Financeiro</h1>

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={preset === "this_month" ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset("this_month")}
          >
            Este mês
          </Button>
          <Button
            variant={preset === "last_month" ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset("last_month")}
          >
            Mês anterior
          </Button>
          <Button
            variant={preset === "custom" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPreset("custom");
              if (!customFrom) {
                const r = getMonthRange(new Date());
                setCustomFrom(r.from);
                setCustomTo(r.to);
              }
            }}
          >
            Personalizado
          </Button>
          {preset === "custom" && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              />
              <span className="text-sm text-muted-foreground">a</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                  <DollarSign className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receita</p>
                  <p className="text-lg font-bold">{formatPrice(summary?.totalRevenue ?? 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                  <TrendingDown className="size-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custos</p>
                  <p className="text-lg font-bold">{formatPrice(summary?.totalCost ?? 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                  <TrendingUp className="size-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lucro</p>
                  <p className={cn("text-lg font-bold", (summary?.profit ?? 0) < 0 && "text-red-600")}>
                    {formatPrice(summary?.profit ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                  <CalendarCheck className="size-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Atendimentos</p>
                  <p className="text-lg font-bold">{summary?.appointmentCount ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Daily revenue chart */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-4 font-semibold">Receita Diária</h3>
                {daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDateLabel}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={(v) => `R$${v}`}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value) => formatPrice(Number(value))}
                        labelFormatter={(label) => formatDateLabel(String(label))}
                      />
                      <Bar dataKey="revenue" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Nenhum dado para o período selecionado
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment method breakdown */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-4 font-semibold">Formas de Pagamento</h3>
                {byPaymentMethod.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={byPaymentMethod.map((item) => ({
                          ...item,
                          name: METHOD_LABELS[item.method] || item.method,
                        }))}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {byPaymentMethod.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatPrice(Number(value))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Nenhum dado para o período selecionado
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue by service */}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-4 font-semibold">Receita por Serviço</h3>
              {byService.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, byService.length * 50)}>
                  <BarChart data={byService} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }} />
                    <YAxis
                      dataKey="serviceName"
                      type="category"
                      width={140}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip formatter={(value) => formatPrice(Number(value))} />
                    <Bar dataKey="revenue" name="Receita" radius={[0, 4, 4, 0]}>
                      {byService.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum dado para o período selecionado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Daily table */}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-4 font-semibold">Detalhamento Diário</h3>
              {daily.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Data</th>
                        <th className="pb-2 pr-4 text-right">Atendimentos</th>
                        <th className="pb-2 pr-4 text-right">Receita</th>
                        <th className="pb-2 pr-4 text-right">Custo</th>
                        <th className="pb-2 text-right">Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.map((row) => (
                        <tr key={row.date} className="border-b last:border-0">
                          <td className="py-2 pr-4">{formatDateLabel(row.date)}</td>
                          <td className="py-2 pr-4 text-right">{row.count}</td>
                          <td className="py-2 pr-4 text-right">{formatPrice(row.revenue)}</td>
                          <td className="py-2 pr-4 text-right">{formatPrice(row.cost)}</td>
                          <td
                            className={cn(
                              "py-2 text-right font-medium",
                              row.revenue - row.cost < 0 && "text-red-600"
                            )}
                          >
                            {formatPrice(row.revenue - row.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum dado para o período selecionado
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
