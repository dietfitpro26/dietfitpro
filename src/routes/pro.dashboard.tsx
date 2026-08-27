import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  UserPlus,
  Users,
  CalendarCheck,
  ClipboardList,
  MessageSquare,
  ArrowRight,
  Video,
  UserCheck,
  Trash2,
  RefreshCw,
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
  subscribers: number;
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

type SubscriberPlan = "basic" | "premium" | null;

interface RecentSubscriber {
  id: string;
  full_name: string | null;
  email: string;
  plan: SubscriberPlan;
  created_at: string;
}

type FeatureKey =
  | "access_recipes"
  | "access_sport_programs"
  | "access_nutrition_programs"
  | "access_messaging"
  | "access_visio"
  | "access_ai_coach"
  | "access_premium_content";

const GOAL_LABEL: Record<string, string> = {
  perte_de_poids: "Perte de poids",
  prise_de_masse: "Prise de masse",
  maintien: "Maintien",
  autre: "Autre",
};

const PLAN_LABEL: Record<string, string> = {
  basic: "Basic",
  premium: "Premium",
};

const PLAN_FEATURES: Record<"basic" | "premium", Record<FeatureKey, boolean>> = {
  basic: {
    access_recipes: false,
    access_sport_programs: true,
    access_nutrition_programs: false,
    access_messaging: false,
    access_visio: false,
    access_ai_coach: false,
    access_premium_content: false,
  },
  premium: {
    access_recipes: true,
    access_sport_programs: true,
    access_nutrition_programs: true,
    access_messaging: true,
    access_visio: false,
    access_ai_coach: true,
    access_premium_content: true,
  },
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
  const [recentSubscribers, setRecentSubscribers] = useState<RecentSubscriber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingSubscriberId, setUpdatingSubscriberId] = useState<string | null>(null);
  const [deletingSubscriberId, setDeletingSubscriberId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
          supabase
            .from("visio_consultations")
            .select("id, scheduled_at, duration_min, status, room_url, patient_id")
            .eq("pro_id", user.id)
            .eq("status", "scheduled")
            .gte("scheduled_at", now.toISOString())
            .lte("scheduled_at", next7days)
            .order("scheduled_at", { ascending: true })
            .limit(5),
          supabase
            .from("patients")
            .select("id, first_name, last_name, goal, is_active, updated_at")
            .eq("pro_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(5),
        ]);

      const { count: subsCount, error: subsCountError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("pro_id", user.id)
        .eq("role", "subscriber");

      const { data: recentSubsData, error: recentSubsError } = await supabase
        .from("profiles")
        .select("id, full_name, email, plan, created_at")
        .eq("pro_id", user.id)
        .eq("role", "subscriber")
        .order("created_at", { ascending: false })
        .limit(5);

      const firstError =
        patientsRes.error ||
        visioTodayRes.error ||
        nutritionRes.error ||
        sportRes.error ||
        messagesRes.error ||
        upcomingRes.error ||
        recentRes.error ||
        subsCountError ||
        recentSubsError;

      if (firstError) {
        setError(firstError.message);
        return;
      }

      setKpis({
        patients: patientsRes.count ?? 0,
        subscribers: subsCount ?? 0,
        todayConsultations: visioTodayRes.count ?? 0,
        activePrograms: (nutritionRes.count ?? 0) + (sportRes.count ?? 0),
        unreadMessages: messagesRes.count ?? 0,
      });

      const rawUpcoming = (upcomingRes.data ?? []) as Array<{
        id: string;
        scheduled_at: string;
        duration_min: number | null;
        status: string;
        room_url: string | null;
        patient_id: string | null;
      }>;

      const patientIds = rawUpcoming
        .map((consultation) => consultation.patient_id)
        .filter((id): id is string => Boolean(id));

      const patientNames: Record<string, string> = {};

      if (patientIds.length) {
        const { data: patients } = await supabase
          .from("patients")
          .select("id, first_name, last_name")
          .in("id", patientIds);

        for (const patient of patients ?? []) {
          const row = patient as {
            id: string;
            first_name: string;
            last_name: string;
          };
          patientNames[row.id] = `${row.first_name} ${row.last_name}`.trim();
        }
      }

      setUpcoming(
        rawUpcoming.map((consultation) => ({
          ...consultation,
          patient_name: consultation.patient_id
            ? patientNames[consultation.patient_id] ?? "Patient"
            : "Patient",
        })),
      );
      setRecentPatients((recentRes.data ?? []) as RecentPatient[]);
      setRecentSubscribers((recentSubsData ?? []) as RecentSubscriber[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleToggleSubscriberPlan(subscriber: RecentSubscriber) {
    if (!user) return;

    const currentPlan = subscriber.plan ?? "basic";
    const nextPlan: "basic" | "premium" = currentPlan === "premium" ? "basic" : "premium";
    const displayName = subscriber.full_name ?? subscriber.email;
    const confirmed = window.confirm(
      nextPlan === "premium"
        ? `Passer ${displayName} en Premium ?`
        : `Repasser ${displayName} en Basic ?`,
    );

    if (!confirmed) return;
    setUpdatingSubscriberId(subscriber.id);

    try {
      const rights = PLAN_FEATURES[nextPlan];
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ plan: nextPlan })
        .eq("id", subscriber.id)
        .eq("pro_id", user.id);

      if (profileError) throw profileError;

      const overrideRows = Object.entries(rights).map(([feature_key, enabled]) => ({
        user_id: subscriber.id,
        feature_key,
        enabled,
      }));

      const { error: overridesError } = await supabase
        .from("subscriber_overrides")
        .upsert(overrideRows, { onConflict: "user_id,feature_key" });

      if (overridesError) throw overridesError;

      setRecentSubscribers((previous) =>
        (previous ?? []).map((item) =>
          item.id === subscriber.id ? { ...item, plan: nextPlan } : item,
        ),
      );
      await load();
      window.alert(
        nextPlan === "premium"
          ? "Abonné passé en Premium avec succès."
          : "Abonné repassé en Basic avec succès.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue lors de la mise à jour";
      window.alert(`Impossible de mettre à jour l'abonné : ${message}`);
    } finally {
      setUpdatingSubscriberId(null);
    }
  }

  async function handleDeleteSubscriber(subscriber: RecentSubscriber) {
    if (!user) return;

    const displayName = subscriber.full_name ?? subscriber.email;
    const confirmed = window.confirm(
      `Supprimer définitivement l'abonné ${displayName} ?\n\nCette action est irréversible et supprimera toutes ses données.`,
    );

    if (!confirmed) return;
    setDeletingSubscriberId(subscriber.id);

    try {
      const { error } = await supabase.rpc("delete_subscriber_by_user_id", {
        p_user_id: subscriber.id,
      });

      if (error) throw error;
      await load();
      window.alert("Abonné supprimé avec succès.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue lors de la suppression";
      window.alert(`Impossible de supprimer l'abonné : ${message}`);
    } finally {
      setDeletingSubscriberId(null);
    }
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Docteur";
  const isLoading = !kpis && !error;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Votre espace professionnel</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  Bonjour {firstName}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Voici les éléments importants à traiter dans votre activité.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void navigate({ to: "/pro/notifications" })}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
                </Button>
                <Button
                  className="rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                  onClick={() => void navigate({ to: "/pro/patients" })}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Nouveau patient
                </Button>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>Impossible de charger le tableau de bord : {error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Patients actifs"
            value={kpis?.patients}
            icon={<Users className="h-5 w-5 text-[#6DB33F]" />}
            loading={isLoading}
            onClick={() => void navigate({ to: "/pro/patients" })}
          />
          <KpiCard
            label="Abonnés actifs"
            value={kpis?.subscribers}
            icon={<UserCheck className="h-5 w-5 text-[#6DB33F]" />}
            loading={isLoading}
            onClick={() => void navigate({ to: "/pro/subscribers" })}
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
            highlight={Boolean(kpis?.unreadMessages)}
            onClick={() => void navigate({ to: "/pro/messages" })}
          />
        </section>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Votre activité</h2>
            <p className="text-sm text-muted-foreground">
              Mises à jour automatiques toutes les minutes.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Video className="h-4 w-4 text-[#6DB33F]" />
                Prochaines consultations
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => void navigate({ to: "/pro/consultations" })}>
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-md" />)
              ) : upcoming?.length === 0 ? (
                <EmptyPanel icon={<CalendarCheck className="h-8 w-8" />} text="Aucune consultation planifiée sur 7 jours" action="Planifier une consultation" onClick={() => void navigate({ to: "/pro/consultations" })} />
              ) : (
                upcoming?.map((consultation) => <ConsultationRow key={consultation.id} consult={consultation} />)
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-4 w-4 text-[#6DB33F]" />
                Derniers patients
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => void navigate({ to: "/pro/patients" })}>
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full rounded-md" />)
              ) : recentPatients?.length === 0 ? (
                <EmptyPanel icon={<Users className="h-8 w-8" />} text="Aucun patient pour l'instant" action="Ajouter un patient" onClick={() => void navigate({ to: "/pro/patients" })} />
              ) : (
                recentPatients?.map((patient) => <PatientRow key={patient.id} patient={patient} />)
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <UserCheck className="h-4 w-4 text-[#6DB33F]" />
                Derniers abonnés
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => void navigate({ to: "/pro/subscribers" })}>
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-full rounded-md" />)}
                </div>
              ) : recentSubscribers?.length === 0 ? (
                <EmptyPanel icon={<UserCheck className="h-8 w-8" />} text="Aucun abonné pour l'instant" action="Gérer les abonnés" onClick={() => void navigate({ to: "/pro/subscribers" })} />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {recentSubscribers?.map((subscriber) => (
                    <SubscriberRow
                      key={subscriber.id}
                      subscriber={subscriber}
                      updating={updatingSubscriberId === subscriber.id}
                      deleting={deletingSubscriberId === subscriber.id}
                      onTogglePlan={handleToggleSubscriberPlan}
                      onDelete={handleDeleteSubscriber}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, loading, highlight, onClick }: { label: string; value: number | undefined; icon: React.ReactNode; loading: boolean; highlight?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="text-left" onClick={onClick} disabled={!onClick}>
      <Card className={cn("h-full rounded-3xl border-border/60 text-left transition-shadow", onClick && "cursor-pointer hover:shadow-md", highlight && "border-[#6DB33F]/40 bg-[#6DB33F]/5")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <div className="rounded-xl bg-[#6DB33F]/10 p-2">{icon}</div>
        </CardHeader>
        <CardContent>{loading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold text-foreground">{value ?? 0}</p>}</CardContent>
      </Card>
    </button>
  );
}

function EmptyPanel({ icon, text, action, onClick }: { icon: React.ReactNode; text: string; action: string; onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <span className="text-muted-foreground/40">{icon}</span>
      <span>{text}</span>
      <Button variant="outline" size="sm" onClick={onClick}>{action}</Button>
    </div>
  );
}

function ConsultationRow({ consult }: { consult: UpcomingConsultation }) {
  const date = new Date(consult.scheduled_at);
  const dayLabel = isToday(date) ? "Aujourd'hui" : isTomorrow(date) ? "Demain" : format(date, "EEE d MMM", { locale: fr });

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{consult.patient_name}</p>
        <p className="text-xs text-muted-foreground">{dayLabel} à {format(date, "HH:mm")}{consult.duration_min ? ` · ${consult.duration_min} min` : ""}</p>
      </div>
      {consult.room_url ? <a href={consult.room_url} target="_blank" rel="noopener noreferrer"><Button size="sm" className="h-7 gap-1 rounded-xl bg-[#6DB33F] px-2 text-xs text-white hover:bg-[#2D7A1F]"><Video className="h-3 w-3" /> Rejoindre</Button></a> : null}
    </div>
  );
}

function PatientRow({ patient }: { patient: RecentPatient }) {
  const navigate = useNavigate();
  const initials = `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`.toUpperCase();

  return (
    <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-muted/50" onClick={() => void navigate({ to: "/pro/patients/$patientId", params: { patientId: patient.id } })}>
      <Avatar className="h-8 w-8"><AvatarFallback className="bg-[#6DB33F]/20 text-xs font-semibold text-[#2D7A1F]">{initials}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{patient.first_name} {patient.last_name}</p><p className="text-xs text-muted-foreground">{(patient.goal && GOAL_LABEL[patient.goal]) ?? "Objectif non défini"}</p></div>
      <Badge variant="outline" className={cn("shrink-0 text-[10px]", patient.is_active ? "border-green-500/40 bg-green-50 text-green-700" : "border-gray-300 text-gray-500")}>{patient.is_active ? "Actif" : "Inactif"}</Badge>
    </button>
  );
}

function SubscriberRow({ subscriber, updating, deleting, onTogglePlan, onDelete }: { subscriber: RecentSubscriber; updating?: boolean; deleting?: boolean; onTogglePlan: (subscriber: RecentSubscriber) => void; onDelete: (subscriber: RecentSubscriber) => void }) {
  const navigate = useNavigate();
  const name = subscriber.full_name ?? subscriber.email;
  const initials = name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const plan = subscriber.plan ?? "basic";
  const planLabel = PLAN_LABEL[plan] ?? "Basic";
  const isPremium = plan === "premium";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 px-3 py-3 transition-colors hover:bg-muted/40">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void navigate({ to: "/pro/subscribers" })}>
        <Avatar className="h-8 w-8"><AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-700">{initials}</AvatarFallback></Avatar>
        <div className="min-w-0"><p className="truncate text-sm font-medium">{name}</p><p className="truncate text-xs text-muted-foreground">{subscriber.email}</p><Badge variant="outline" className={cn("mt-1 shrink-0 text-[10px]", isPremium ? "border-amber-500/40 bg-amber-50 text-amber-700" : "border-green-500/40 bg-green-50 text-green-700")}>{planLabel}</Badge></div>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant={isPremium ? "outline" : "default"} className={cn("h-8 rounded-xl", !isPremium && "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]")} onClick={() => onTogglePlan(subscriber)} disabled={updating}>{updating ? "..." : isPremium ? "Basic" : "Premium"}</Button>
        <Button size="sm" variant="destructive" className="h-8 rounded-xl" onClick={() => onDelete(subscriber)} disabled={deleting}>{deleting ? "..." : <Trash2 className="h-4 w-4" />}</Button>
      </div>
    </div>
  );
}