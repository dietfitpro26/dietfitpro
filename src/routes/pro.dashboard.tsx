import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, UserPlus, Users, CalendarCheck, ClipboardList, MessageSquare } from "lucide-react";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — DietFitPro" }] }),
  component: ProDashboardPage,
});

interface Kpis {
  patients: number;
  todayAppointments: number;
  activePrograms: number;
  unreadMessages: number;
}

function ProDashboardPage() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <DashboardContent />
      </ProLayout>
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

        const [patientsRes, apptRes, nutritionRes, sportRes, messagesRes] = await Promise.all([
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .eq("pro_id", user.id),
          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("pro_id", user.id)
            .gte("starts_at", startOfDay)
            .lt("starts_at", endOfDay),
          supabase
            .from("nutrition_programs")
            .select("*", { count: "exact", head: true })
            .eq("pro_id", user.id)
            .eq("is_active", true),
          supabase
            .from("sport_programs")
            .select("*", { count: "exact", head: true })
            .eq("pro_id", user.id)
            .eq("is_active", true),
          supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("recipient_id", user.id)
            .is("read_at", null),
        ]);

        if (cancelled) return;

        const firstError =
          patientsRes.error ||
          apptRes.error ||
          nutritionRes.error ||
          sportRes.error ||
          messagesRes.error;
        if (firstError) {
          console.error("[ProDashboard] kpi error", firstError);
          setError(firstError.message);
          return;
        }

        setKpis({
          patients: patientsRes.count ?? 0,
          todayAppointments: apptRes.count ?? 0,
          activePrograms: (nutritionRes.count ?? 0) + (sportRes.count ?? 0),
          unreadMessages: messagesRes.count ?? 0,
        });
      } catch (err) {
        console.error("[ProDashboard] catch", err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
            <UserPlus className="h-4 w-4" />
            Nouveau patient
          </Button>
        </div>
      </header>

      {/* KPI grid */}
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Patients actifs"
            value={kpis?.patients}
            icon={<Users className="h-5 w-5 text-[#6DB33F]" />}
            loading={!kpis && !error}
          />
          <KpiCard
            label="Consultations du jour"
            value={kpis?.todayAppointments}
            icon={<CalendarCheck className="h-5 w-5 text-[#6DB33F]" />}
            loading={!kpis && !error}
          />
          <KpiCard
            label="Programmes actifs"
            value={kpis?.activePrograms}
            icon={<ClipboardList className="h-5 w-5 text-[#6DB33F]" />}
            loading={!kpis && !error}
          />
          <KpiCard
            label="Messages non lus"
            value={kpis?.unreadMessages}
            icon={<MessageSquare className="h-5 w-5 text-[#6DB33F]" />}
            loading={!kpis && !error}
          />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
}) {
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
          <p className="text-3xl font-bold text-foreground">{value ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
}
