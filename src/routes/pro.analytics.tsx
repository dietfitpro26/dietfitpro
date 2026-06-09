import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, subWeeks, startOfWeek, endOfWeek, isWithinInterval, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users, CalendarCheck, TrendingUp, Ban, ArrowUpRight, ArrowDownRight, Euro, UserCheck,
} from "lucide-react";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pro/analytics")({
  head: () => ({ meta: [{ title: "Analytics — DietFitPro" }] }),
  component: Page,
});

type PaymentStatus = "pending" | "paid" | "refunded" | "partial_refund" | "failed";
type Status = "scheduled" | "completed" | "cancelled" | "refunded" | "no_show";

interface Consultation {
  id: string;
  scheduled_at: string | null;
  status: Status;
  payment_status: PaymentStatus;
  amount_cents: number | null;
  patient?: { first_name: string; last_name: string } | null;
}

interface AnalyticsData {
  activePatients: number;
  activeSubscribers: number;
  consultationsThisMonth: number;
  consultationsLastMonth: number;
  revenueThisMonthCents: number;
  totalConsultations: number;
  cancelledConsultations: number;
  weeklyData: { week: string; count: number }[];
  paymentDistribution: { name: string; value: number; color: string }[];
  recentPayments: Consultation[];
}

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><AnalyticsContent /></ProLayout>
    </ProtectedRoute>
  );
}

function AnalyticsContent() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const now = new Date();
        const thisMonthStart = startOfMonth(now);
        const thisMonthEnd = endOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));

        const [patientsRes, subscribersRes, consultsRes] = await Promise.all([
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .eq("pro_id", user.id)
            .eq("is_active", true),
          // Abonnés actifs liés au pro via invitation_codes
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "subscriber")
            .in(
              "id",
              supabase
                .from("invitation_codes")
                .select("used_by")
                .eq("pro_id", user.id)
                .not("used_by", "is", null)
            ),
          supabase
            .from("visio_consultations")
            .select("id, scheduled_at, status, payment_status, amount_cents, patients(first_name, last_name)")
            .eq("pro_id", user.id)
            .order("scheduled_at", { ascending: false }),
        ]);

        if (cancelled) return;

        if (patientsRes.error || consultsRes.error) {
          setError(patientsRes.error?.message || consultsRes.error?.message || "Erreur de chargement");
          setLoading(false);
          return;
        }

        const consultations = (consultsRes.data ?? []) as Consultation[];
        const activePatients = patientsRes.count ?? 0;
        const activeSubscribers = subscribersRes.count ?? 0;

        const thisMonthConsults = consultations.filter((c) => {
          if (!c.scheduled_at) return false;
          const d = new Date(c.scheduled_at);
          return isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd });
        });

        const lastMonthConsults = consultations.filter((c) => {
          if (!c.scheduled_at) return false;
          const d = new Date(c.scheduled_at);
          return isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd });
        });

        const revenueThisMonthCents = thisMonthConsults
          .filter((c) => c.payment_status === "paid")
          .reduce((sum, c) => sum + (c.amount_cents ?? 0), 0);

        const totalConsultations = consultations.length;
        const cancelledConsultations = consultations.filter((c) => c.status === "cancelled").length;

        const weeks: { week: string; count: number }[] = [];
        for (let i = 3; i >= 0; i--) {
          const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
          const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
          const label = format(weekStart, "d MMM", { locale: fr });
          const count = consultations.filter((c) => {
            if (!c.scheduled_at) return false;
            const d = new Date(c.scheduled_at);
            return isWithinInterval(d, { start: weekStart, end: weekEnd });
          }).length;
          weeks.push({ week: label, count });
        }

        const paymentCounts: Record<PaymentStatus, number> = {
          pending: 0, paid: 0, refunded: 0, partial_refund: 0, failed: 0,
        };
        consultations.forEach((c) => {
          paymentCounts[c.payment_status] = (paymentCounts[c.payment_status] ?? 0) + 1;
        });

        const PAYMENT_COLORS: Record<PaymentStatus, string> = {
          pending: "#94a3b8", paid: "#6DB33F", refunded: "#f59e0b",
          partial_refund: "#f97316", failed: "#ef4444",
        };
        const PAYMENT_LABELS: Record<PaymentStatus, string> = {
          pending: "En attente", paid: "Payé", refunded: "Remboursé",
          partial_refund: "Remb. partiel", failed: "Échec",
        };

        const paymentDistribution = (Object.keys(paymentCounts) as PaymentStatus[])
          .filter((k) => paymentCounts[k] > 0)
          .map((k) => ({ name: PAYMENT_LABELS[k], value: paymentCounts[k], color: PAYMENT_COLORS[k] }));

        const recentPayments = consultations.filter((c) => c.payment_status === "paid").slice(0, 5);

        setData({
          activePatients,
          activeSubscribers,
          consultationsThisMonth: thisMonthConsults.length,
          consultationsLastMonth: lastMonthConsults.length,
          revenueThisMonthCents,
          totalConsultations,
          cancelledConsultations,
          weeklyData: weeks,
          paymentDistribution,
          recentPayments,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const cancellationRate = useMemo(() => {
    if (!data || data.totalConsultations === 0) return 0;
    return Math.round((data.cancelledConsultations / data.totalConsultations) * 100);
  }, [data]);

  const consultationEvolution = useMemo(() => {
    if (!data || data.consultationsLastMonth === 0) return null;
    return Math.round(
      ((data.consultationsThisMonth - data.consultationsLastMonth) / data.consultationsLastMonth) * 100
    );
  }, [data]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Statistiques</h1>
      </header>

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* KPI Cards — 5 cartes sur 2 rangées */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KpiCard
            label="Patients actifs"
            value={data?.activePatients}
            icon={<Users className="h-5 w-5 text-[#6DB33F]" />}
            loading={loading}
          />
          <KpiCard
            label="Abonnés actifs"
            value={data?.activeSubscribers}
            icon={<UserCheck className="h-5 w-5 text-[#6DB33F]" />}
            loading={loading}
          />
          <KpiCard
            label="Consultations ce mois"
            value={data?.consultationsThisMonth}
            icon={<CalendarCheck className="h-5 w-5 text-[#6DB33F]" />}
            loading={loading}
            evolution={consultationEvolution}
          />
          <KpiCard
            label="Revenus ce mois"
            value={data ? `${(data.revenueThisMonthCents / 100).toFixed(2)} €` : undefined}
            icon={<Euro className="h-5 w-5 text-[#6DB33F]" />}
            loading={loading}
          />
          <KpiCard
            label="Taux d'annulation"
            value={`${cancellationRate}%`}
            icon={<Ban className="h-5 w-5 text-red-500" />}
            loading={loading}
            trend={cancellationRate > 15 ? "negative" : "positive"}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Consultations par semaine (4 dernières semaines)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data?.weeklyData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [`${value} consultation${value > 1 ? "s" : ""}`, ""]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <Bar dataKey="count" fill="#6DB33F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Répartition des statuts de paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : !data || data.paymentDistribution.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée de paiement
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.paymentDistribution}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={90}
                      paddingAngle={4} dataKey="value"
                    >
                      {data.paymentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value}`, name]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent payments */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              5 derniers paiements reçus
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !data || data.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucun paiement reçu.</p>
            ) : (
              <div className="space-y-2">
                {data.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#6DB33F]/10 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-[#6DB33F]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {p.patient ? `${p.patient.first_name} ${p.patient.last_name}` : "Patient"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.scheduled_at ? format(new Date(p.scheduled_at), "dd MMM yyyy", { locale: fr }) : "—"}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#2D7A1F]">
                      +{(p.amount_cents ?? 0) / 100} €
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon, loading, evolution, trend,
}: {
  label: string;
  value: string | number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  evolution?: number | null;
  trend?: "positive" | "negative" | "neutral";
}) {
  const isPositive = evolution !== undefined && evolution !== null && evolution >= 0;
  const isNegative = evolution !== undefined && evolution !== null && evolution < 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="rounded-md bg-[#6DB33F]/10 p-2">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-foreground">{value ?? 0}</p>
            {evolution !== undefined && evolution !== null && (
              <span className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                isPositive && "bg-[#6DB33F]/15 text-[#2D7A1F]",
                isNegative && "bg-red-100 text-red-700"
              )}>
                {isPositive && <ArrowUpRight className="h-3 w-3 mr-0.5" />}
                {isNegative && <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                {Math.abs(evolution)}%
              </span>
            )}
            {trend && evolution === undefined && (
              <span className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                trend === "positive" && "bg-[#6DB33F]/15 text-[#2D7A1F]",
                trend === "negative" && "bg-red-100 text-red-700"
              )}>
                {trend === "positive"
                  ? <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                {trend === "positive" ? "Bon" : "À surveiller"}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}