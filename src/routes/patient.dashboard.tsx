import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { differenceInHours, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Video,
  Calendar as CalendarIcon,
  Target,
  Dumbbell,
  Utensils,
  ChevronRight,
  FileText,
  Clock3,
  Activity,
  FolderOpen,
  ArrowRight,
  Plus,
} from "lucide-react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <DashboardContent />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

type Status = "scheduled" | "completed" | "cancelled" | "refunded" | "no_show";
type PayStatus = "pending" | "paid" | "refunded" | "partial_refund" | "failed";

interface Consultation {
  id: string;
  scheduled_at: string | null;
  duration_min: number | null;
  status: Status;
  payment_status: PayStatus;
  amount_cents: number | null;
  room_url: string | null;
  pro_id: string;
}

interface PatientDoc {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  category: string;
  created_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Planifiée",
  completed: "Terminée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  no_show: "Absent",
};

function DashboardContent() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [upcoming, setUpcoming] = useState<Consultation | null | undefined>(undefined);
  const [past, setPast] = useState<Consultation[] | null>(null);
  const [proName, setProName] = useState<string>("");

  const [nutritionDocs, setNutritionDocs] = useState<PatientDoc[] | null>(null);
  const [sportDocs, setSportDocs] = useState<PatientDoc[] | null>(null);

  const [patientFirstName, setPatientFirstName] = useState<string>("");
  const [patientLastName, setPatientLastName] = useState<string>("");

  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      const nowIso = new Date().toISOString();

      const { data: patientRow } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const patientId = (patientRow as { id?: string } | null)?.id ?? null;

      setPatientFirstName((patientRow as { first_name?: string } | null)?.first_name ?? "");
      setPatientLastName((patientRow as { last_name?: string } | null)?.last_name ?? "");

      const [upRes, histRes, nutriDocsRes, sportDocsRes] = await Promise.all([
        supabase
          .from("visio_consultations")
          .select("id, scheduled_at, duration_min, status, payment_status, amount_cents, room_url, pro_id")
          .eq("patient_user_id", user.id)
          .eq("status", "scheduled")
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(1),

        supabase
          .from("visio_consultations")
          .select("id, scheduled_at, duration_min, status, payment_status, amount_cents, room_url, pro_id")
          .eq("patient_user_id", user.id)
          .in("status", ["completed", "cancelled", "refunded", "no_show"])
          .order("scheduled_at", { ascending: false })
          .limit(10),

        patientId
          ? supabase
              .from("patient_documents")
              .select("id, title, file_name, file_url, category, created_at")
              .eq("patient_id", patientId)
              .eq("category", "nutrition")
              .order("created_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] }),

        patientId
          ? supabase
              .from("patient_documents")
              .select("id, title, file_name, file_url, category, created_at")
              .eq("patient_id", patientId)
              .eq("category", "sport")
              .order("created_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] }),
      ]);

      const next = (upRes.data?.[0] as Consultation | undefined) ?? null;
      setUpcoming(next);

      if (next?.pro_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", next.pro_id)
          .maybeSingle();

        setProName((p as { full_name?: string } | null)?.full_name ?? "");
      } else {
        setProName("");
      }

      setPast((histRes.data ?? []) as Consultation[]);
      setNutritionDocs((nutriDocsRes.data ?? []) as PatientDoc[]);
      setSportDocs((sportDocsRes.data ?? []) as PatientDoc[]);
    })();
  }, [user]);

  const displayName = patientFirstName
    ? `${patientFirstName} ${patientLastName}`.trim()
    : profile?.full_name ?? user?.email ?? "";

  const firstName = patientFirstName || displayName.split(" ")[0] || "vous";

  const completedCount = useMemo(() => {
    return (past ?? []).filter((item) => item.status === "completed").length;
  }, [past]);

  const documentsCount = useMemo(() => {
    return (nutritionDocs?.length ?? 0) + (sportDocs?.length ?? 0);
  }, [nutritionDocs, sportDocs]);

  const nextConsultationLabel =
    upcoming?.scheduled_at
      ? format(new Date(upcoming.scheduled_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr })
      : null;

  const hoursBeforeUpcoming =
    upcoming?.scheduled_at
      ? differenceInHours(new Date(upcoming.scheduled_at), new Date())
      : null;

  const canCancelUpcoming =
    upcoming?.status === "scheduled" &&
    typeof hoursBeforeUpcoming === "number" &&
    hoursBeforeUpcoming >= 24;

  const latestNutritionDoc = nutritionDocs?.[0] ?? null;
  const latestSportDoc = sportDocs?.[0] ?? null;

  async function handleCancelUpcoming() {
    if (!upcoming?.id || !canCancelUpcoming) return;

    const confirmed = window.confirm(
      "Confirmez-vous l’annulation de ce rendez-vous ?"
    );

    if (!confirmed) return;

    setCancelling(true);

    const cancelledItem: Consultation = {
      ...upcoming,
      status: "cancelled",
    };

    const { error } = await supabase
      .from("visio_consultations")
      .update({ status: "cancelled" })
      .eq("id", upcoming.id);

    if (error) {
      setCancelling(false);
      window.alert("Impossible d’annuler le rendez-vous pour le moment.");
      return;
    }

    setUpcoming(null);
    setPast((prev) => [cancelledItem, ...(prev ?? [])]);
    setProName("");
    setCancelling(false);
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold">Bonjour {firstName}</h1>
                <p className="text-sm text-muted-foreground">
                  Voici un aperçu clair de votre suivi patient.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  <Activity className="h-4 w-4" />
                  Espace patient actif
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                  {documentsCount} document{documentsCount > 1 ? "s" : ""}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  {completedCount} consultation{completedCount > 1 ? "s" : ""} terminée{completedCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                {upcoming?.scheduled_at ? "Prochain rendez-vous programmé" : "Suivi prêt à continuer"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {upcoming?.scheduled_at
                  ? nextConsultationLabel
                  : "Ajoutez ou consultez vos prochains éléments de suivi."}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Prochaine consultation"
            value={upcoming?.scheduled_at ? "Planifiée" : "Aucune"}
            hint={
              upcoming?.scheduled_at
                ? format(new Date(upcoming.scheduled_at), "dd MMM yyyy", { locale: fr })
                : "Aucun créneau à venir"
            }
            icon={<CalendarIcon className="h-4 w-4 text-primary" />}
            highlight={Boolean(upcoming?.scheduled_at)}
          />

          <MetricCard
            label="Documents disponibles"
            value={`${documentsCount}`}
            hint="Nutrition et sport"
            icon={<FileText className="h-4 w-4 text-primary" />}
          />

          <MetricCard
            label="Consultations terminées"
            value={`${completedCount}`}
            hint="Historique récent"
            icon={<Clock3 className="h-4 w-4 text-primary" />}
          />
        </section>

        <Card className="rounded-3xl border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Prendre un rendez-vous consultation</p>
              <p className="text-sm text-muted-foreground">
                Choisissez un créneau disponible et fixez votre prochain échange en visio avec votre praticien.
              </p>
            </div>

            <Button
              className="shrink-0 rounded-2xl"
              onClick={() => navigate({ to: "/patient/feed" })}
            >
              <Plus className="h-4 w-4" />
              Prendre rendez-vous
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prochaine consultation</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming === undefined ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : !upcoming ? (
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">Aucune consultation planifiée</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Consultez votre espace pour planifier ou retrouver vos rendez-vous.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="rounded-2xl"
                      onClick={() => navigate({ to: "/patient/feed" })}
                    >
                      <Plus className="h-4 w-4" />
                      Prendre rendez-vous
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => navigate({ to: "/patient/consultations" })}
                    >
                      Voir mes consultations
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Video className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold">
                          {upcoming.scheduled_at
                            ? format(new Date(upcoming.scheduled_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr })
                            : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {proName ? `Avec ${proName}` : "Avec votre praticien"} · {upcoming.duration_min ?? 30} min
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Consultation visio prête à être rejointe.
                        </p>
                      </div>
                    </div>
                  </div>

                  {!canCancelUpcoming && upcoming?.scheduled_at ? (
                    <p className="text-xs text-muted-foreground">
                      Annulation indisponible à moins de 24h du rendez-vous.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Vous pouvez annuler ce rendez-vous jusqu’à 24h avant l’horaire prévu.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="rounded-2xl"
                      onClick={() => {
                        if (upcoming.room_url) {
                          window.open(upcoming.room_url, "_blank", "noopener");
                        } else {
                          navigate({ to: "/patient/consultations" });
                        }
                      }}
                    >
                      <Video className="h-4 w-4" />
                      Rejoindre
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => navigate({ to: "/patient/consultations" })}
                    >
                      Voir le détail
                    </Button>

                    <Button
                      variant="destructive"
                      className="rounded-2xl"
                      onClick={handleCancelUpcoming}
                      disabled={!canCancelUpcoming || cancelling}
                    >
                      Annuler le rendez-vous
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Accès rapides</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <QuickCard icon={Utensils} label="Mon plan nutritionnel" to="/patient/nutrition" />
              <QuickCard icon={Dumbbell} label="Mon programme sport" to="/patient/sport" />
              <QuickCard icon={Target} label="Mes objectifs" to="/patient/profil" />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Utensils className="h-4 w-4 text-primary" />
                Mon plan nutritionnel
              </CardTitle>
              <Link
                to="/patient/nutrition"
                className="flex items-center gap-0.5 text-xs text-primary hover:underline"
              >
                Voir tout <ChevronRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {nutritionDocs === null ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : nutritionDocs.length === 0 ? (
                <EmptyState
                  title="Aucun plan nutritionnel disponible"
                  text="Vos documents nutrition apparaîtront ici dès leur mise à disposition."
                />
              ) : (
                <div className="space-y-4">
                  {latestNutritionDoc && (
                    <div className="rounded-2xl bg-muted/40 p-4">
                      <p className="text-sm font-semibold">{latestNutritionDoc.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernière mise à disposition le{" "}
                        {format(new Date(latestNutritionDoc.created_at), "dd MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  )}

                  <ul className="divide-y">
                    {nutritionDocs.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(doc.created_at), "dd MMM yyyy", { locale: fr })}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          PDF
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Dumbbell className="h-4 w-4 text-primary" />
                Mon programme sport
              </CardTitle>
              <Link
                to="/patient/sport"
                className="flex items-center gap-0.5 text-xs text-primary hover:underline"
              >
                Voir tout <ChevronRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {sportDocs === null ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : sportDocs.length === 0 ? (
                <EmptyState
                  title="Aucun programme sport disponible"
                  text="Vos documents sport apparaîtront ici dès leur mise à disposition."
                />
              ) : (
                <div className="space-y-4">
                  {latestSportDoc && (
                    <div className="rounded-2xl bg-muted/40 p-4">
                      <p className="text-sm font-semibold">{latestSportDoc.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernière mise à disposition le{" "}
                        {format(new Date(latestSportDoc.created_at), "dd MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  )}

                  <ul className="divide-y">
                    {sportDocs.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(doc.created_at), "dd MMM yyyy", { locale: fr })}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          PDF
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historique des consultations</CardTitle>
          </CardHeader>
          <CardContent>
            {past === null ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : past.length === 0 ? (
              <EmptyState
                title="Aucune consultation passée"
                text="Votre historique apparaîtra ici dès que des consultations seront enregistrées."
              />
            ) : (
              <ul className="divide-y">
                {past.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-4 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {c.scheduled_at ? format(new Date(c.scheduled_at), "dd/MM/yyyy HH:mm", { locale: fr }) : "—"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {STATUS_LABEL[c.status]} · {c.duration_min ?? 30} min
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="mt-1">
                        <PaymentBadge status={c.payment_status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        highlight ? "border-primary/20 bg-primary/5" : "bg-card"
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("text-xl font-bold", highlight && "text-primary")}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function QuickCard({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof Video;
  label: string;
  to: string;
}) {
  return (
    <Link to={to} className="block">
      <div className="flex items-center justify-between rounded-2xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function PaymentBadge({ status }: { status: PayStatus }) {
  const label: Record<PayStatus, string> = {
    pending: "En attente",
    paid: "Payé",
    refunded: "Remboursé",
    partial_refund: "Remb. partiel",
    failed: "Échec",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "paid" && "bg-primary/10 text-primary",
        status === "pending" && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        (status === "refunded" || status === "partial_refund") &&
          "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        status === "failed" && "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      )}
    >
      {label[status]}
    </span>
  );
}