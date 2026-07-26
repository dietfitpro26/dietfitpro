import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Video,
  Plus,
  CalendarClock,
  History,
  Clock3,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/consultations")({
  head: () => ({ meta: [{ title: "Mes consultations — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <Content />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

type Status = "scheduled" | "completed" | "cancelled" | "refunded" | "no_show";
type PayStatus = "pending" | "paid" | "refunded" | "partial_refund" | "failed";

interface Row {
  id: string;
  scheduled_at: string | null;
  duration_min: number | null;
  status: Status;
  payment_status: PayStatus;
  amount_cents: number | null;
  room_url: string | null;
  pro_id: string;
  pro_name?: string;
}

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Planifiée",
  completed: "Terminée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  no_show: "Absent",
};

const PAY_LABEL: Record<PayStatus, string> = {
  pending: "En attente",
  paid: "Payé",
  refunded: "Remboursé",
  partial_refund: "Remb. partiel",
  failed: "Échec",
};

function Content() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      const { data } = await supabase
        .from("visio_consultations")
        .select("id, scheduled_at, duration_min, status, payment_status, amount_cents, room_url, pro_id")
        .eq("patient_user_id", user.id)
        .order("scheduled_at", { ascending: false });

      const list = (data ?? []) as Row[];
      const proIds = Array.from(new Set(list.map((r) => r.pro_id)));

      if (proIds.length) {
        const { data: pros } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", proIds);

        const map = new Map(
          (pros ?? []).map((p) => [p.id as string, (p as { full_name?: string }).full_name ?? ""])
        );

        list.forEach((r) => {
          r.pro_name = map.get(r.pro_id) ?? "";
        });
      }

      setRows(list);
    })();
  }, [user]);

  const now = Date.now();

  const upcoming = useMemo(() => {
    if (!rows) return null;
    return rows.filter(
      (r) => r.status === "scheduled" && r.scheduled_at && new Date(r.scheduled_at).getTime() >= now
    );
  }, [rows, now]);

  const past = useMemo(() => {
    if (!rows) return null;
    return rows.filter(
      (r) => !(r.status === "scheduled" && r.scheduled_at && new Date(r.scheduled_at).getTime() >= now)
    );
  }, [rows, now]);

  const nextConsultation = upcoming?.[0] ?? null;
  const completedCount = (rows ?? []).filter((r) => r.status === "completed").length;
  const upcomingCount = upcoming?.length ?? 0;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold">Mes consultations</h1>
                <p className="text-sm text-muted-foreground">
                  Retrouvez vos rendez-vous à venir et l’historique de votre suivi.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  <CalendarClock className="h-4 w-4" />
                  {upcomingCount} rendez-vous à venir
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <History className="h-4 w-4" />
                  {completedCount} consultation{completedCount > 1 ? "s" : ""} terminée{completedCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <Button
              className="rounded-2xl"
              onClick={() => toast.info("Contactez votre praticien pour planifier un rendez-vous.")}
            >
              <Plus className="h-4 w-4" />
              Prendre rendez-vous
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Prochain rendez-vous"
            value={nextConsultation ? "Programmé" : "Aucun"}
            hint={
              nextConsultation?.scheduled_at
                ? format(new Date(nextConsultation.scheduled_at), "dd MMM yyyy", { locale: fr })
                : "Aucun créneau à venir"
            }
            icon={<CalendarDays className="h-4 w-4 text-primary" />}
            highlight={Boolean(nextConsultation)}
          />

          <MetricCard
            label="Consultations à venir"
            value={`${upcomingCount}`}
            hint="Créneaux planifiés"
            icon={<CalendarClock className="h-4 w-4 text-primary" />}
          />

          <MetricCard
            label="Consultations terminées"
            value={`${completedCount}`}
            hint="Historique disponible"
            icon={<Clock3 className="h-4 w-4 text-primary" />}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prochain rendez-vous</CardTitle>
            </CardHeader>
            <CardContent>
              {rows === null ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : !nextConsultation ? (
                <EmptyState
                  title="Aucune consultation programmée"
                  text="Prenez contact avec votre praticien pour fixer votre prochain rendez-vous."
                />
              ) : (
                <FeaturedUpcoming row={nextConsultation} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informations utiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoTile
                title="Accès visio"
                text="Le bouton de connexion devient actif peu avant le rendez-vous."
              />
              <InfoTile
                title="Organisation"
                text="Préparez un endroit calme, une bonne connexion et vos questions importantes."
              />
              <InfoTile
                title="Planification"
                text="La prise de rendez-vous se fait directement avec votre praticien."
              />
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Consultations à venir</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming === null ? (
              <Skeleton className="h-24 w-full rounded-2xl" />
            ) : upcoming.length === 0 ? (
              <EmptyState
                title="Aucune consultation à venir"
                text="Vos prochains rendez-vous s’afficheront ici dès qu’ils seront planifiés."
              />
            ) : (
              <ul className="divide-y">
                {upcoming.map((r) => (
                  <UpcomingItem key={r.id} row={r} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historique</CardTitle>
          </CardHeader>
          <CardContent>
            {past === null ? (
              <Skeleton className="h-24 w-full rounded-2xl" />
            ) : past.length === 0 ? (
              <EmptyState
                title="Aucune consultation passée"
                text="Votre historique apparaîtra ici au fil de votre suivi."
              />
            ) : (
              <ul className="divide-y">
                {past.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-4 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {r.scheduled_at
                          ? format(new Date(r.scheduled_at), "dd/MM/yyyy HH:mm", { locale: fr })
                          : "—"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.pro_name || "Praticien"} · {STATUS_LABEL[r.status]} · {r.duration_min ?? 30} min
                      </div>
                    </div>

                    <div className="text-right">
                      <PayBadge status={r.payment_status} />
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

function FeaturedUpcoming({ row }: { row: Row }) {
  const startsIn = row.scheduled_at ? new Date(row.scheduled_at).getTime() - Date.now() : Infinity;
  const canJoin = startsIn <= 15 * 60 * 1000 && startsIn >= -60 * 60 * 1000;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold">
              {row.scheduled_at
                ? format(new Date(row.scheduled_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr })
                : "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              {row.pro_name || "Praticien"} · {row.duration_min ?? 30} min
            </p>
            <div className="pt-1">
              <PayBadge status={row.payment_status} />
            </div>
          </div>
        </div>
      </div>

      <Button
        className="rounded-2xl"
        disabled={!canJoin}
        onClick={() => {
          if (row.room_url) window.open(row.room_url, "_blank", "noopener");
          else toast.info("Lien visio bientôt disponible.");
        }}
      >
        <Video className="h-4 w-4" />
        {canJoin ? "Rejoindre la visio" : "Bientôt disponible"}
      </Button>
    </div>
  );
}

function UpcomingItem({ row }: { row: Row }) {
  const startsIn = row.scheduled_at ? new Date(row.scheduled_at).getTime() - Date.now() : Infinity;
  const canJoin = startsIn <= 15 * 60 * 1000 && startsIn >= -60 * 60 * 1000;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-medium text-sm">
          {row.scheduled_at
            ? format(new Date(row.scheduled_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr })
            : "—"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {row.pro_name || "Praticien"} · {row.duration_min ?? 30} min
        </div>
      </div>

      <div className="flex items-center gap-2">
        <PayBadge status={row.payment_status} />
        <Button
          size="sm"
          disabled={!canJoin}
          className="rounded-2xl disabled:bg-muted disabled:text-muted-foreground"
          onClick={() => {
            if (row.room_url) window.open(row.room_url, "_blank", "noopener");
            else toast.info("Lien visio bientôt disponible.");
          }}
        >
          <Video className="h-4 w-4" />
          {canJoin ? "Rejoindre" : "Bientôt disponible"}
        </Button>
      </div>
    </li>
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

function InfoTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
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

function PayBadge({ status }: { status: PayStatus }) {
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
      {PAY_LABEL[status]}
    </span>
  );
}