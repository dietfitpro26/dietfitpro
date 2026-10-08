import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, FileText, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAccessState, useBillingEnabled, useMyBilling } from "@/hooks/useAccessState";
import { BILLING_PRICES, formatEuro, openCustomerPortal, startCheckout } from "@/lib/billing";


function longDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMMM yyyy", { locale: fr });
}


export function SubscriptionOfferCard() {
  const { profile } = useAuth();
  const { state } = useAccessState();
  const { billingEnabled } = useBillingEnabled();
  const { billing } = useMyBilling();
  const [busy, setBusy] = useState<string | null>(null);


  const currentPlan: "basic" | "premium" = profile?.plan === "premium" ? "premium" : "basic";
  const hasSubscription =
    Boolean(billing?.stripe_subscription_id) &&
    ["trialing", "active", "past_due"].includes(billing?.status ?? "");
  const neverSubscribed = !billing?.stripe_subscription_id;
  const isManaged = state === "managed";
  const planName = currentPlan === "premium" ? "Premium" : "Basic";


  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
      setBusy(null);
    }
  };


  let summary: string;
  if (isManaged) {
    summary = `Votre formule ${planName} est gérée par votre professionnel.`;
  } else if (state === "trial") {
    summary = `Essai gratuit en cours jusqu'au ${longDate(billing?.trial_end ?? null)}. Le premier prélèvement aura lieu ensuite.`;
  } else if (state === "active") {
    summary = billing?.cancel_at_period_end
      ? `Abonnement ${planName} actif. Résiliation prévue le ${longDate(billing?.current_period_end ?? null)}.`
      : `Abonnement ${planName} actif. Prochain renouvellement le ${longDate(billing?.current_period_end ?? null)}.`;
  } else if (state === "past_due") {
    summary = "Votre dernier paiement n'a pas abouti. Mettez à jour votre moyen de paiement.";
  } else if (state === "suspended") {
    summary = "Votre abonnement est suspendu. Vos données sont conservées jusqu'à sa réactivation.";
  } else {
    summary = `Formule actuelle : ${planName}.`;
  }


  const canBuy = billingEnabled && !isManaged && busy === null;
  const trialNote = neverSubscribed ? ` · ${BILLING_PRICES.trialDays} jours d'essai gratuits` : "";


  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Mon abonnement</CardTitle>
            <CardDescription className="mt-1">{summary}</CardDescription>
          </div>
        </div>
      </CardHeader>


      <CardContent className="space-y-5">
        {isManaged ? (
          <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Pour modifier votre formule, contactez votre professionnel.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className={cn(
                "rounded-2xl border p-4",
                currentPlan === "basic" && hasSubscription && "border-[#6DB33F] bg-[#6DB33F]/5",
              )}
            >
              <p className="text-sm font-semibold">Basic</p>
              <p className="mt-1 text-2xl font-bold">
                {formatEuro(BILLING_PRICES.basicMonthly)}
                <span className="text-sm font-normal text-muted-foreground"> / mois</span>
              </p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>3 programmes nutrition adaptés à vos besoins</li>
                <li>Journal alimentaire, historique 1 mois</li>
                <li>Séances de sport incluses</li>
              </ul>
              <Button
                variant="outline"
                className="mt-4 w-full rounded-2xl"
                disabled={!canBuy || (hasSubscription && currentPlan === "basic")}
                onClick={() =>
                  void run("basic", () => startCheckout({ kind: "subscription", plan: "basic" }))
                }
              >
                {hasSubscription && currentPlan === "basic"
                  ? "Formule actuelle"
                  : busy === "basic"
                    ? "Redirection…"
                    : billingEnabled
                      ? `Choisir Basic${trialNote}`
                      : "Bientôt disponible"}
              </Button>
            </div>


            <div
              className={cn(
                "rounded-2xl border p-4",
                currentPlan === "premium" && hasSubscription
                  ? "border-[#6DB33F] bg-[#6DB33F]/5"
                  : "border-primary/30 bg-primary/5",
              )}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                Premium
                <CheckCircle className="h-4 w-4 text-[#6DB33F]" />
              </p>
              <p className="mt-1 text-2xl font-bold">
                {formatEuro(BILLING_PRICES.premiumMonthly)}
                <span className="text-sm font-normal text-muted-foreground"> / mois</span>
              </p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>12 programmes nutrition (3 Basic + 9 Premium)</li>
                <li>Journal alimentaire, historique 3 mois</li>
                <li>PDF et notes de votre diététicien</li>
                <li>Messagerie, recettes, coach IA</li>
              </ul>
              <Button
                className="mt-4 w-full rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                disabled={!canBuy || (hasSubscription && currentPlan === "premium")}
                onClick={() =>
                  void run("premium", () => startCheckout({ kind: "subscription", plan: "premium" }))
                }
              >
                {hasSubscription && currentPlan === "premium"
                  ? "Formule actuelle"
                  : busy === "premium"
                    ? "Redirection…"
                    : billingEnabled
                      ? `Choisir Premium${trialNote}`
                      : "Bientôt disponible"}
              </Button>
            </div>
          </div>
        )}


        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              Programme personnalisé
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Un programme construit pour vous par votre diététicien :{" "}
              {formatEuro(BILLING_PRICES.customProgramOnce)}, une seule fois. Réservé aux
              abonnés Premium.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full rounded-xl"
              disabled={!canBuy || currentPlan !== "premium" || state === "suspended"}
              onClick={() => void run("custom", () => startCheckout({ kind: "custom_program" }))}
            >
              {busy === "custom"
                ? "Redirection…"
                : !billingEnabled
                  ? "Bientôt disponible"
                  : currentPlan !== "premium"
                    ? "Réservé à Premium"
                    : "Commander"}
            </Button>
          </div>


          <div className="rounded-2xl border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Video className="h-4 w-4 text-primary" />
              Consultation en visio
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ouverte à tous, Basic comme Premium : {formatEuro(BILLING_PRICES.visioPerConsultation)}{" "}
              par consultation, réglés au moment de la réservation.
            </p>
          </div>
        </div>


        {billingEnabled && billing?.stripe_customer_id ? (
          <Button
            variant="outline"
            className="w-full rounded-2xl"
            disabled={busy !== null}
            onClick={() => void run("portal", openCustomerPortal)}
          >
            {busy === "portal" ? "Redirection…" : "Gérer mon abonnement et mes factures"}
          </Button>
        ) : null}


        <p className="text-xs text-muted-foreground">
          Paiement sécurisé par Stripe. Résiliable à tout moment. Prix TTC.
        </p>
      </CardContent>
    </Card>
  );
}