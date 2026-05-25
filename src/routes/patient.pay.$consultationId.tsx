import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { toast } from "sonner";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CreditCard, Calendar, Clock } from "lucide-react";

export const Route = createFileRoute("/patient/pay/$consultationId")({
  component: PayPage,
});

interface Consultation {
  id: string;
  scheduled_at: string;
  duration_min: number;
  amount_cents: number;
  payment_status: string | null;
  status: string;
  pro_id: string;
}

interface ProInfo {
  first_name: string | null;
  last_name: string | null;
}

function PayPage() {
  return (
    <ProtectedRoute allow={["patient"]}>
      <PayInner />
    </ProtectedRoute>
  );
}

function PayInner() {
  const { consultationId } = useParams({ from: "/patient/pay/$consultationId" });
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [pro, setPro] = useState<ProInfo | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("visio_consultations")
          .select("id, scheduled_at, duration_min, amount_cents, payment_status, status, pro_id")
          .eq("id", consultationId)
          .single();
        if (error) throw error;
        if (cancelled) return;
        setConsultation(data as Consultation);

        const { data: proData } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", (data as Consultation).pro_id)
          .maybeSingle();
        if (!cancelled) setPro((proData as ProInfo) ?? null);

        if ((data as Consultation).payment_status === "paid") {
          setSuccess(true);
          setLoading(false);
          return;
        }

        // Crée le PaymentIntent
        const resp = await supabase.functions.invoke("create-payment-intent", {
          body: {
            consultation_id: consultationId,
            amount_cents: (data as Consultation).amount_cents,
            patient_email: user.email,
          },
        });
        if (resp.error) throw resp.error;
        if (!cancelled) {
          setClientSecret(resp.data.client_secret);
          setPublishableKey(resp.data.publishable_key);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setInitError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [consultationId, user]);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (initError || !consultation) {
    return (
      <CenteredCard>
        <h2 className="text-lg font-semibold">Impossible de charger le paiement</h2>
        <p className="mt-2 text-sm text-muted-foreground">{initError ?? "Consultation introuvable."}</p>
        <Button asChild className="mt-4"><Link to="/patient/home">Retour</Link></Button>
      </CenteredCard>
    );
  }

  if (success) {
    return <SuccessView consultation={consultation} pro={pro} />;
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_1.2fr]">
        <RecapCard consultation={consultation} pro={pro} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-primary" /> Paiement sécurisé
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stripePromise && clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: { theme: "stripe" } }}
              >
                <CheckoutForm
                  amountCents={consultation.amount_cents}
                  consultationId={consultation.id}
                  onSuccess={() => setSuccess(true)}
                />
              </Elements>
            ) : (
              <p className="text-sm text-muted-foreground">Initialisation du paiement…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CheckoutForm({
  amountCents,
  consultationId,
  onSuccess,
}: {
  amountCents: number;
  consultationId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        toast.error(error.message ?? "Paiement refusé");
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        const { data: cons, error: updateErr } = await supabase
          .from("visio_consultations")
          .update({ payment_status: "paid" })
          .eq("id", consultationId)
          .select("pro_id, patient_user_id, amount_cents")
          .single();
        if (updateErr) console.error(updateErr);
        if (cons) {
          const amount = `${((cons.amount_cents ?? 0) / 100).toFixed(2)} €`;
          const { createNotification } = await import("@/lib/notifications");
          if (cons.patient_user_id) {
            await createNotification({
              userId: cons.patient_user_id,
              type: "payment_confirmed",
              title: "Paiement confirmé",
              body: `Votre paiement de ${amount} a été confirmé.`,
              link: "/patient/consultations",
            });
          }
          if (cons.pro_id) {
            await createNotification({
              userId: cons.pro_id,
              type: "payment_received",
              title: "Paiement reçu",
              body: `Vous avez reçu un paiement de ${amount}.`,
              link: `/pro/consultations/${consultationId}`,
            });
          }
        }
        toast.success("Paiement confirmé");
        onSuccess();
      } else {
        toast.message("Paiement en cours de traitement");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? "Traitement…" : `Payer ${(amountCents / 100).toFixed(2)} €`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Paiement sécurisé par Stripe. Aucune donnée bancaire n'est stockée sur nos serveurs.
      </p>
    </form>
  );
}

function RecapCard({
  consultation,
  pro,
}: {
  consultation: Consultation;
  pro: ProInfo | null;
}) {
  const date = new Date(consultation.scheduled_at);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Récapitulatif</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row icon={<Calendar className="h-4 w-4" />} label="Date" value={date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
        <Row icon={<Clock className="h-4 w-4" />} label="Heure" value={date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} />
        <Row label="Durée" value={`${consultation.duration_min} min`} />
        {pro && (
          <Row label="Professionnel" value={`${pro.first_name ?? ""} ${pro.last_name ?? ""}`.trim() || "—"} />
        )}
        <div className="my-3 h-px bg-border" />
        <div className="flex items-center justify-between text-base font-semibold">
          <span>Total</span>
          <span>{(consultation.amount_cents / 100).toFixed(2)} €</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SuccessView({
  consultation,
  pro,
}: {
  consultation: Consultation;
  pro: ProInfo | null;
}) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <CardTitle className="mt-2">Paiement confirmé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Votre téléconsultation est réservée. Un email de confirmation vous a été envoyé.
            </p>
            <div className="rounded-lg border bg-background p-4 text-left">
              <RecapCardInner consultation={consultation} pro={pro} />
            </div>
            <Button asChild className="w-full">
              <Link to="/patient/home">Retour à mon espace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecapCardInner({ consultation, pro }: { consultation: Consultation; pro: ProInfo | null }) {
  const date = new Date(consultation.scheduled_at);
  return (
    <div className="space-y-2 text-sm">
      <Row label="Date" value={date.toLocaleString("fr-FR")} />
      <Row label="Durée" value={`${consultation.duration_min} min`} />
      {pro && <Row label="Professionnel" value={`${pro.first_name ?? ""} ${pro.last_name ?? ""}`.trim()} />}
      <Row label="Montant payé" value={`${(consultation.amount_cents / 100).toFixed(2)} €`} />
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="max-w-md p-6 text-center">{children}</Card>
    </div>
  );
}
