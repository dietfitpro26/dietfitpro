import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell, UserPlus, Users, CalendarCheck,
  ClipboardList, MessageSquare, ArrowRight, Video,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pro/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — DietFitPro" }] }),
  component: ProDashboardPage,
});

interface Kpis {
  patients: number;
  todayConsultations: number;
  activePrograms: number;
  unreadMessages: number;
}

interface UpcomingConsultation {
  id: string;
  scheduled_at: string;
  duration_min: number | null;
  status: string;
  patient_name: string;
  room_url: string | null;
}

interface RecentPatient {
  id: string;
  first_name: string;
  last_name: string;
  goal: string | null;
  is_active: boolean;
  updated_at: string;
}

const GOAL_LABEL: Record<string, string> = {
  perte_de_poids: "Perte de poids",
  prise_de_masse: "Prise de masse",
  maintien: "Maintien",
  autre: "Autre",
};

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
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingConsultation[] | null>(null);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const next7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [patientsRes, visioTodayRes, nutritionRes, sportRes, messagesRes, upcomingRes, recentRes] =
        await Promise.all([
          supabase
            .from("patients")
            .select("*", { count: "exact", head: true })
            .eq("pro_id", user.id)
            .eq("is_active", true),
          // ✅ Corrigé : on utilise visio_consultations, pas appointments
          supabase
            .from("visio_consultations")
            .select("*", { count: "exact", head: true })
            .eq("pro_id", user.id)
            .eq("status", "scheduled")
            .gte("scheduled_at", startOfDay)
            .lt("scheduled_at", endOfDay),
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
          // Prochaines consultations sur 7 jours
          supabase
            .from("visio_consultations")
            .select("id, scheduled_at, duration_min, status, room_url, patient_id")
            .eq("pro_id", user.id)
            .eq("status", "scheduled")
            .gte("scheduled_at", now.toISOString())
            .lte("scheduled_at", next7days)
            .order("scheduled_at", { ascending: true })
            .limit(5),
          // 5 derniers patients
          supabase
            .from("patients")
            .select("id, first_name, last_name, goal, is_active, updated_at")
            .eq("pro_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(5),
        ]);

      const firstError =
        patientsRes.error || visioTodayRes.error || nutritionRes.error ||
        sportRes.error || messagesRes.error;
      if (firstError) {
        setError(firstError.message);
        return;
      }

      setKpis({
        patients: patientsRes.count ?? 0,
        todayConsultations: visioTodayRes.count ?? 0,
        activePrograms: (nutritionRes.count ?? 0) + (sportRes.count ?? 0),
        unreadMessages: messagesRes.count ?? 0,
      });

      // Enrichir les consultations avec les noms patients
      const rawUpcoming = (upcomingRes.data ?? []) as Array<{
        id: string; scheduled_at: string; duration_min: number | null;
        status: string; room_url: string | null; patient_id: string | null;
      }>;
      const patientIds = rawUpcoming
        .map((c) => c.patient_id)
        .filter((x): x is string => Boolean(x));
      let patientNames: Record<string, string> = {};
      if (patientIds.length) {
        const { data: pts } = await supabase
          .from("patients")
          .select("id, first_name, last_name")
          .in("id", patientIds);
        for (const p of pts ?? []) {
          patientNames[(p as { id: string; first_name: string; last_name: string }).id] =
            `${(p as { first_name: string }).first_name} ${(p as { last_name: string }).last_name}`;
        }
      }
      setUpcoming(
        rawUpcoming.map((c) => ({
          ...c,
          patient_name: c.patient_id ? (patientNames[c.patient_id] ?? "Patient") : "Patient",
        }))
      );
      setRecentPatients((recentRes.data ?? []) as RecentPatient[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [user]);

  // Chargement initial
  useEffect(() => {
    void load();
  }, [load]);

  // ✅ Rafraîchissement auto toutes les 60 secondes
  useEffect(() => {
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "Docteur";
  const isLoading = !kpis && !error;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Bonjour {firstName} 👋 —{" "}
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ✅ Cloche avec badge et lien */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
            onClick={() => void navigate({ to: "/pro/notifications" })}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
          {/* ✅ Bouton fonctionnel avec navigation */}
          <Button
            className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white"
            onClick={() => void navigate({ to: "/pro/patients" })}
          >
            <UserPlus className="h-4 w-4" />
            Nouveau patient
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Erreur */}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Patients actifs"
            value={kpis?.patients}
            icon={<Users className="h-5 w-5 text-[#6DB33F]" />}
            loading={isLoading}
            onClick={() => void navigate({ to: "/pro/patients" })}
          />
          <KpiCard
            label="Consultations aujourd'hui"
            value={kpis?.todayConsultations}
            icon={<CalendarCheck className="h-5 w-5 text-[#6DB33F]" />}
            loading={isLoading}
            onClick={() => void navigate({ to: "/pro/consultations" })}
          />
          <KpiCard
            label="Programmes actifs"
            value={kpis?.activePrograms}
            icon={<ClipboardList className="h-5 w-5 text-[#6DB33F]" />}
            loading={isLoading}
            onClick={() => void navigate({ to: "/pro/nutrition" })}
          />
          <KpiCard
            label="Messages non lus"
            value={kpis?.unreadMessages}
            icon={<MessageSquare className="h-5 w-5 text-[#6DB33F]" />}
            loading={isLoading}
            highlight={!!kpis?.unreadMessages}
            onClick={() => void navigate({ to: "/pro/messages" })}
          />
        </div>

        {/* Grille basse : Consultations à venir + Derniers patients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prochaines consultations */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Video className="h-4 w-4 text-[#6DB33F]" />
                Prochaines consultations
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1"
                onClick={() => void navigate({ to: "/pro/consultations" })}
              >
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))
              ) : upcoming?.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground text-sm gap-2">
                  <CalendarCheck className="h-8 w-8 text-muted-foreground/40" />
                  <span>Aucune consultation planifiée sur 7 jours</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void navigate({ to: "/pro/consultations" })}
                  >
                    Planifier une consultation
                  </Button>
                </div>
              ) : (
                upcoming?.map((c) => <ConsultationRow key={c.id} consult={c} />)
              )}
            </CardContent>
          </Card>

          {/* Derniers patients */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-[#6DB33F]" />
                Derniers patients
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1"
                onClick={() => void navigate({ to: "/pro/patients" })}
              >
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))
              ) : recentPatients?.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground text-sm gap-2">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                  <span>Aucun patient pour l'instant</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void navigate({ to: "/pro/patients" })}
                  >
                    Ajouter un patient
                  </Button>
                </div>
              ) : (
                recentPatients?.map((p) => <PatientRow key={p.id} patient={p} />)
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sous-composants ---------- */

function KpiCard({
  label, value, icon, loading, highlight, onClick,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "border-border/60 transition-shadow",
        onClick && "cursor-pointer hover:shadow-md",
        highlight && "border-[#6DB33F]/40 bg-[#6DB33F]/5",
      )}
      onClick={onClick}
    >
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

function ConsultationRow({ consult }: { consult: UpcomingConsultation }) {
  const date = new Date(consult.scheduled_at);
  const dayLabel = isToday(date)
    ? "Aujourd'hui"
    : isTomorrow(date)
    ? "Demain"
    : format(date, "EEE d MMM", { locale: fr });

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{consult.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {dayLabel} à {format(date, "HH:mm")}
          {consult.duration_min ? ` · ${consult.duration_min} min` : ""}
        </p>
      </div>
      {consult.room_url && (
        <a
          href={consult.room_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="sm" className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white h-7 px-2 text-xs gap-1">
            <Video className="h-3 w-3" /> Rejoindre
          </Button>
        </a>
      )}
    </div>
  );
}

function PatientRow({ patient }: { patient: RecentPatient }) {
  const navigate = useNavigate();
  const initials = `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase();
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => void navigate({ to: "/pro/patients" })}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-[#6DB33F]/20 text-[#2D7A1F] text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {patient.first_name} {patient.last_name}
        </p>
        <p className="text-xs text-muted-foreground">
          {(patient.goal && GOAL_LABEL[patient.goal]) ?? "Objectif non défini"}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] shrink-0",
          patient.is_active
            ? "border-green-500/40 text-green-700 bg-green-50"
            : "border-gray-300 text-gray-500",
        )}
      >
        {patient.is_active ? "Actif" : "Inactif"}
      </Badge>
    </div>
  );
}