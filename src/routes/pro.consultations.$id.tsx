import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Video, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export const Route = createFileRoute("/pro/consultations/$id")({
  head: () => ({ meta: [{ title: "Consultation — DietFitPro" }] }),
  component: Page,
});

type Status = "scheduled" | "completed" | "cancelled" | "refunded" | "no_show";
type PaymentStatus = "pending" | "paid" | "refunded" | "partial_refund" | "failed";

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Planifiée", completed: "Terminée", cancelled: "Annulée",
  refunded: "Remboursée", no_show: "Absent",
};
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "En attente", paid: "Payé", refunded: "Remboursé",
  partial_refund: "Remboursement partiel", failed: "Échec",
};

interface Consultation {
  id: string;
  patient_id: string | null;
  patient_user_id: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
  status: Status;
  payment_status: PaymentStatus;
  amount_cents: number | null;
  cancellation_fee_cents: number;
  room_url: string | null;
  notes: string | null;
  patient?: { first_name: string; last_name: string; email: string | null } | null;
}

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><Content /></ProLayout>
    </ProtectedRoute>
  );
}

function Content() {
  const { user } = useAuth();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("visio_consultations")
      .select("id, patient_id, patient_user_id, scheduled_at, duration_min, status, payment_status, amount_cents, cancellation_fee_cents, room_url, notes")
      .eq("id", id).eq("pro_id", user.id).maybeSingle();
    if (!data) { setLoading(false); return; }
    const cons = data as Consultation;
    if (cons.patient_id) {
      const { data: p } = await supabase
        .from("patients").select("first_name, last_name, email")
        .eq("id", cons.patient_id).maybeSingle();
      cons.patient = (p as Consultation["patient"]) ?? null;
    }
    setC(cons);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user, id]);

  const markCompleted = async () => {
    if (!c) return;
    setBusy(true);
    const { error } = await supabase.from("visio_consultations")
      .update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", c.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Consultation marquée comme terminée");
    void load();
  };

  const cancel = async () => {
    if (!c || !c.scheduled_at) return;
    const hoursUntil = (new Date(c.scheduled_at).getTime() - Date.now()) / 3600000;
    const within24h = hoursUntil < 24;
    const confirmMsg = within24h
      ? "Moins de 24h avant la consultation : 5 € de frais retenus, remboursement partiel via Stripe. Confirmer ?"
      : "Plus de 24h avant : remboursement total automatique via Stripe. Confirmer l'annulation ?";
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      if (c.payment_status === "paid") {
        const { error } = await supabase.functions.invoke("refund-consultation", {
          body: { consultation_id: c.id },
        });
        if (error) throw error;
        toast.success(within24h ? "Annulée — remboursement partiel effectué" : "Annulée — remboursement total effectué");
      } else {
        const { error } = await supabase.from("visio_consultations").update({
          status: "cancelled",
          cancellation_fee_cents: within24h ? 500 : 0,
        }).eq("id", c.id);
        if (error) throw error;
        toast.success("Consultation annulée");
      }
      const patientName = c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : "le patient";
      const dateLabel = new Date(c.scheduled_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
      if (user) {
        await createNotification({
          userId: user.id,
          type: "consultation_cancelled",
          title: "Consultation annulée",
          body: `Consultation avec ${patientName} du ${dateLabel} annulée.`,
          link: `/pro/consultations/${c.id}`,
        });
      }
      if (c.patient_user_id) {
        await createNotification({
          userId: c.patient_user_id,
          type: "consultation_cancelled",
          title: "Consultation annulée",
          body: `Votre consultation du ${dateLabel} a été annulée.`,
          link: "/patient/consultations",
        });
      }
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startVideo = () => {
    const url = c?.room_url || "https://whereby.com/dietfitpro-placeholder";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!c) {
    return <div className="p-6">
      <Button variant="ghost" onClick={() => navigate({ to: "/pro/consultations" })}><ArrowLeft className="h-4 w-4" /> Retour</Button>
      <p className="mt-4 text-destructive">Consultation introuvable.</p>
    </div>;
  }

  const isFinal = c.status === "completed" || c.status === "cancelled" || c.status === "refunded";

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pro/consultations" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : "Consultation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {c.scheduled_at ? format(new Date(c.scheduled_at), "dd/MM/yyyy 'à' HH:mm") : "—"}
          </p>
        </div>
        <span className={cn(
          "rounded-full px-3 py-1 text-xs font-medium",
          c.status === "scheduled" && "bg-blue-100 text-blue-700",
          c.status === "completed" && "bg-[#6DB33F]/15 text-[#2D7A1F]",
          c.status === "cancelled" && "bg-muted text-muted-foreground",
          c.status === "refunded" && "bg-amber-100 text-amber-700",
          c.status === "no_show" && "bg-red-100 text-red-700",
        )}>{STATUS_LABEL[c.status]}</span>
      </header>

      <div className="p-6 space-y-4 max-w-3xl">
        <Card><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <Row label="Patient" value={c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : "—"} />
          <Row label="Email" value={c.patient?.email ?? "—"} />
          <Row label="Date / heure" value={c.scheduled_at ? format(new Date(c.scheduled_at), "dd/MM/yyyy HH:mm") : "—"} />
          <Row label="Durée" value={c.duration_min ? `${c.duration_min} min` : "—"} />
          <Row label="Montant" value={c.amount_cents != null ? `${(c.amount_cents / 100).toFixed(2)} €` : "—"} />
          <Row label="Statut paiement" value={PAYMENT_LABEL[c.payment_status]} />
          {c.cancellation_fee_cents > 0 && (
            <Row label="Frais d'annulation" value={`${(c.cancellation_fee_cents / 100).toFixed(2)} €`} />
          )}
        </CardContent></Card>

        {c.notes && (
          <Card><CardContent className="p-4">
            <h2 className="font-semibold mb-1">Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
          </CardContent></Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={startVideo} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
            <Video className="h-4 w-4" /> Démarrer la visio
          </Button>
          {!isFinal && (
            <>
              <Button variant="outline" onClick={markCompleted} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" /> Marquer comme terminée
              </Button>
              <Button variant="outline" onClick={cancel} disabled={busy} className="text-destructive">
                <XCircle className="h-4 w-4" /> Annuler
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
