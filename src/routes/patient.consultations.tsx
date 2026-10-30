import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Video,
  Plus,
  CalendarClock,
  History,
  Clock3,
  CalendarDays,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { startCheckout } from "@/lib/billing";

export const Route = createFileRoute("/patient/consultations")({
  head: () => ({
    meta: [{ title: "Mes consultations — DietFitPro" }],
  }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <Content />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

type Status =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "refunded"
  | "no_show";

type PayStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "partial_refund"
  | "failed";

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

function scheduledTime(row: Row): number | null {
  if (!row.scheduled_at) return null;

  const timestamp = new Date(row.scheduled_at).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isUpcoming(row: Row, now: number): boolean {
  const timestamp = scheduledTime(row);

  return (
    row.status === "scheduled" &&
    timestamp !== null &&
    timestamp >= now
  );
}

function displayDate(
  value: string | null,
  pattern: string,
): string {
  if (!value) return "Date à confirmer";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Date à confirmer";
  }

  return format(date, pattern, { locale: fr });
}

function Content() {
  const { user } = useAuth();
  const userId = user?.id;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const paymentInProgress = useRef(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    if (!userId) return;

    const version = ++requestVersion.current;

    setRefreshing(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from("visio_consultations")
        .select(
          "id, scheduled_at, duration_min, status, payment_status, amount_cents, room_url, pro_id",
        )
        .eq("patient_user_id", userId)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      if (version !== requestVersion.current) return;

      const list = ((data ?? []) as Row[]).map((row) => ({
        ...row,
      }));

      const proIds = Array.from(
        new Set(list.map((row) => row.pro_id)),
      );

      if (proIds.length > 0) {
        const { data: pros, error: proError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", proIds);

        if (version !== requestVersion.current) return;

        if (proError) {
          console.error(
            "[patient.consultations] Lecture des praticiens :",
            proError,
          );
        } else {
          const names = new Map<string, string>(
            (pros ?? []).map((pro) => [
              pro.id as string,
              (pro.full_name as string | null) ?? "",
            ]),
          );

          list.forEach((row) => {
            row.pro_name = names.get(row.pro_id) ?? "";
          });
        }
      }

      if (version !== requestVersion.current) return;

      setRows(list);
    } catch (error) {
      if (version !== requestVersion.current) return;

      console.error("[patient.consultations]", error);

      setLoadError(
        "Impossible de charger vos consultations. Réessayez dans quelques instants.",
      );
    } finally {
      if (version === requestVersion.current) {
        setRefreshing(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    setRows(null);
    setLoadError(null);

    if (userId) {
      void load();
    }

    return () => {
      requestVersion.current += 1;
    };
  }, [userId, load]);

  const now = Date.now();

  const upcoming = useMemo(() => {
    if (!rows) return null;

    return rows
      .filter((row) => isUpcoming(row, now))
      .sort(
        (a, b) =>
          (scheduledTime(a) ?? 0) -
          (scheduledTime(b) ?? 0),
      );
  }, [rows, now]);

  const past = useMemo(() => {
    if (!rows) return null;

    return rows
      .filter((row) => !isUpcoming(row, now))
      .sort(
        (a, b) =>
          (scheduledTime(b) ?? 0) -
          (scheduledTime(a) ?? 0),
      );
  }, [rows, now]);

  const handlePayment = async (row: Row) => {
    if (paymentInProgress.current) return;

    const canPay =
      isUpcoming(row, Date.now()) &&
      (row.payment_status === "pending" ||
        row.payment_status === "failed");

    if (!canPay) return;

    paymentInProgress.current = true;
    setPayingId(row.id);

    try {
      await startCheckout({
        kind: "visio",
        consultationId: row.id,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d'ouvrir le paiement.",
      );

      paymentInProgress.current = false;
      setPayingId(null);
    }
  };

  const nextConsultation = upcoming?.[0] ?? null;
  const completedCount = (rows ?? []).filter(
    (row) => row.status === "completed",
  ).length;
  const upcomingCount = upcoming?.length ?? 0;

  const initialLoading = rows === null;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold">
                  Mes consultations
                </h1>
                <p className="text-sm text-muted-foreground">
                  Retrouvez vos rendez-vous à venir et
                  l’historique de votre suivi.
                </p>
              </div>

              {!initialLoading && (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                    <CalendarClock className="h-4 w-4" />
                    {upcomingCount} rendez-vous à venir
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                    <History className="h-4 w-4" />
                    {completedCount} consultation
                    {completedCount > 1 ? "s" : ""} terminée
                    {completedCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={refreshing || payingId !== null}
                onClick={() => void load()}
              >
                <RefreshCw
                  className={cn(
                    "mr-2 h-4 w-4",
                    refreshing && "animate-spin",
                  )}
                />
                Actualiser
              </Button>

              <Button
                className="rounded-2xl"
                onClick={() =>
                  toast.info(
                    "Contactez votre praticien pour planifier un rendez-vous.",
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Prendre rendez-vous
              </Button>
            </div>
          </div>
        </section>

        {loadError && (
          <Card className="rounded-3xl border-destructive/40">
            <CardContent className="space-y-3 p-5" role="alert">
              <p className="text-sm text-destructive">
                {loadError}
              </p>

              {rows !== null && (
                <p className="text-xs text-muted-foreground">
                  Les informations affichées ci-dessous
                  proviennent du dernier chargement réussi.
                </p>
              )}

              <Button
                variant="outline"
                disabled={refreshing}
                onClick={() => void load()}
              >
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {initialLoading ? (
          !loadError && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-24 rounded-2xl"
                  />
                ))}
              </div>
              <Skeleton className="h-48 rounded-3xl" />
              <Skeleton className="h-32 rounded-3xl" />
            </div>
          )
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Prochain rendez-vous"
                value={nextConsultation ? "Programmé" : "Aucun"}
                hint={
                  nextConsultation
                    ? displayDate(
                        nextConsultation.scheduled_at,
                        "dd MMM yyyy",
                      )
                    : "Aucun créneau à venir"
                }
                icon={
                  <CalendarDays className="h-4 w-4 text-primary" />
                }
                highlight={Boolean(nextConsultation)}
              />

              <MetricCard
                label="Consultations à venir"
                value={`${upcomingCount}`}
                hint="Créneaux planifiés"
                icon={
                  <CalendarClock className="h-4 w-4 text-primary" />
                }
              />

              <MetricCard
                label="Consultations terminées"
                value={`${completedCount}`}
                hint="Historique disponible"
                icon={
                  <Clock3 className="h-4 w-4 text-primary" />
                }
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Prochain rendez-vous
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  {!nextConsultation ? (
                    <EmptyState
                      title="Aucune consultation programmée"
                      text="Prenez contact avec votre praticien pour fixer votre prochain rendez-vous."
                    />
                  ) : (
                    <FeaturedUpcoming
                      row={nextConsultation}
                      payingId={payingId}
                      paymentDisabled={Boolean(loadError)}
                      onPay={handlePayment}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Informations utiles
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  <InfoTile
                    title="Accès visio"
                    text="Le bouton de connexion devient actif peu avant le rendez-vous."
                  />
                  <InfoTile
                    title="Paiement en ligne"
                    text="Lorsqu'un paiement est en attente, utilisez le bouton de paiement sécurisé. Après votre retour de Stripe, actualisez la page pour vérifier son statut."
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
                <CardTitle className="text-base">
                  Consultations à venir
                </CardTitle>
              </CardHeader>

              <CardContent>
                {!upcoming?.length ? (
                  <EmptyState
                    title="Aucune consultation à venir"
                    text="Vos prochains rendez-vous s’afficheront ici dès qu’ils seront planifiés."
                  />
                ) : (
                  <ul className="divide-y">
                    {upcoming.map((row) => (
                      <UpcomingItem
                        key={row.id}
                        row={row}
                        payingId={payingId}
                        paymentDisabled={Boolean(loadError)}
                        onPay={handlePayment}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Historique
                </CardTitle>
              </CardHeader>

              <CardContent>
                {!past?.length ? (
                  <EmptyState
                    title="Aucune consultation passée"
                    text="Votre historique apparaîtra ici au fil de votre suivi."
                  />
                ) : (
                  <ul className="divide-y">
                    {past.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 py-4 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">
                            {displayDate(
                              row.scheduled_at,
                              "dd/MM/yyyy HH:mm",
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.pro_name || "Praticien"} ·{" "}
                            {STATUS_LABEL[row.status]} ·{" "}
                            {row.duration_min ?? 30} min
                          </div>
                        </div>

                        <div className="text-right">
                          <PayBadge status={row.payment_status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

interface ConsultationActionsProps {
  row: Row;
  payingId: string | null;
  paymentDisabled: boolean;
  onPay: (row: Row) => Promise<void>;
}

function ConsultationActions({
  row,
  payingId,
  paymentDisabled,
  onPay,
}: ConsultationActionsProps) {
  const timestamp = scheduledTime(row);
  const startsIn =
    timestamp === null ? Infinity : timestamp - Date.now();

  const canJoin =
    startsIn <= 15 * 60 * 1000 &&
    startsIn >= -60 * 60 * 1000;

  const canPay =
    isUpcoming(row, Date.now()) &&
    (row.payment_status === "pending" ||
      row.payment_status === "failed");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPay && (
        <Button
          size="sm"
          className="rounded-2xl"
          disabled={payingId !== null || paymentDisabled}
          onClick={() => void onPay(row)}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          {payingId === row.id
            ? "Ouverture de Stripe…"
            : row.payment_status === "failed"
              ? "Réessayer le paiement"
              : "Payer la consultation"}
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        disabled={!canJoin}
        className="rounded-2xl disabled:bg-muted disabled:text-muted-foreground"
        onClick={() => {
          if (row.room_url) {
            window.open(row.room_url, "_blank", "noopener");
          } else {
            toast.info("Lien visio bientôt disponible.");
          }
        }}
      >
        <Video className="mr-2 h-4 w-4" />
        {canJoin ? "Rejoindre la visio" : "Bientôt disponible"}
      </Button>
    </div>
  );
}

function FeaturedUpcoming({
  row,
  payingId,
  paymentDisabled,
  onPay,
}: ConsultationActionsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold">
              {displayDate(
                row.scheduled_at,
                "EEEE dd MMMM 'à' HH:mm",
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {row.pro_name || "Praticien"} ·{" "}
              {row.duration_min ?? 30} min
            </p>
            <div className="pt-1">
              <PayBadge status={row.payment_status} />
            </div>
          </div>
        </div>
      </div>

      <ConsultationActions
        row={row}
        payingId={payingId}
        paymentDisabled={paymentDisabled}
        onPay={onPay}
      />
    </div>
  );
}

function UpcomingItem({
  row,
  payingId,
  paymentDisabled,
  onPay,
}: ConsultationActionsProps) {
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {displayDate(
            row.scheduled_at,
            "EEEE dd MMMM 'à' HH:mm",
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {row.pro_name || "Praticien"} ·{" "}
          {row.duration_min ?? 30} min
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PayBadge status={row.payment_status} />

        <ConsultationActions
          row={row}
          payingId={payingId}
          paymentDisabled={paymentDisabled}
          onPay={onPay}
        />
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
  icon?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        highlight
          ? "border-primary/20 bg-primary/5"
          : "bg-card",
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "text-xl font-bold",
          highlight && "text-primary",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {hint}
      </div>
    </div>
  );
}

function InfoTile({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function PayBadge({ status }: { status: PayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "paid" && "bg-primary/10 text-primary",
        status === "pending" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        (status === "refunded" ||
          status === "partial_refund") &&
          "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        status === "failed" &&
          "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      )}
    >
      {PAY_LABEL[status]}
    </span>
  );
}