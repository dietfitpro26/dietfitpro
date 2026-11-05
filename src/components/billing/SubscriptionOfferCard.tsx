import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, FileText, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  useAccessState,
  useBillingEnabled,
  useMyBilling,
} from "@/hooks/useAccessState";
import {
  BILLING_PRICES,
  formatEuro,
  openCustomerPortal,
  startCheckout,
} from "@/lib/billing";

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

  const currentPlan: "basic" | "premium" =
    profile?.plan === "premium" ? "premium" : "basic";

  const hasSubscription =
    Boolean(billing?.stripe_subscription_id) &&
    ["trialing", "active", "past_due"].includes(billing?.status ?? "");

  const neverSubscribed = !billing?.stripe_subscription_id;
  const isManaged = state === "managed";
  const planName = currentPlan === "premium" ? "Premium" : "Basic";

  const cancellationDate =
    billing?.cancel_at ??
    (billing?.cancel_at_period_end ? billing.current_period_end : null);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);

    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
      setBusy(null);
    }
  };

  let summary: string;

  if (isManaged) {
    summary = `Votre formule ${planName} est gérée par votre professionnel.`;
  } else if (state === "trial") {
    summary = `Essai gratuit en cours jusqu'au ${longDate(
      billing?.trial_end ?? null,
    )}. Le premier prélèvement aura lieu ensuite.`;
  } else if (state === "active") {
    summary = cancellationDate
      ? `Abonnement ${planName} actif. Résiliation prévue le ${longDate(
          cancellationDate,
        )}.`
      : `Abonnement ${planName} actif. Prochain renouvellement le ${longDate(
          billing?.current_period_end ?? null,
        )}.`;
  } else if (state === "past_due") {
    summary =
      "Votre dernier paiement n'a pas abouti. Mettez à jour votre moyen de paiement.";
  } else if (state === "suspended") {
    summary =
      "Votre abonnement est suspendu. Vos données sont conservées jusqu'à sa réactivation.";
  } else {
    summary = `Formule actuelle : ${planName}.`;
  }

  const canBuy = billingEnabled && !isManaged && busy === null;
  const trialNote = neverSubscribed
    ? ` · ${BILLING_PRICES.trialDays} jours d'essai gratuits`
    : "";

  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <CardTitle className="text-xl">Mon abonnement</CardTitle>
            <CardDescription className="mt-1 text-sm leading-relaxed">
              {summary}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isManaged ? (
          <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Pour modifier votre formule, contactez votre professionnel.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className={cn(
                "flex flex-col rounded-2xl border p-4",
                currentPlan === "basic" &&
                  hasSubscription &&
                  "border-primary bg-primary/5",
              )}
            >
              <p className="text-sm font-bold">Basic</p>

              <p className="mt-2 text-2xl font-extrabold">
                {formatEuro(BILLING_PRICES.basicMonthly)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / mois
                </span>
              </p>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                <li>3 programmes nutrition adaptés à vos besoins</li>
                <li>Journal alimentaire, historique 1 mois</li>
                <li>3 programmes de sport inclus</li>
              </ul>

              <Button
                variant="outline"
                className="mt-5 h-11 w-full rounded-full font-semibold"
                disabled={
                  !canBuy || (hasSubscription && currentPlan === "basic")
                }
                onClick={() =>
                  void run("basic", () =>
                    startCheckout({
                      kind: "subscription",
                      plan: "basic",
                    }),
                  )
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
                "flex flex-col rounded-2xl border p-4",
                currentPlan === "premium" && hasSubscription
                  ? "border-primary bg-primary/5"
                  : "border-primary/30 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Premium</p>
                <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
              </div>

              <p className="mt-2 text-2xl font-extrabold">
                {formatEuro(BILLING_PRICES.premiumMonthly)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / mois
                </span>
              </p>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                <li>12 programmes nutrition (3 Basic + 9 Premium)</li>
                <li>9 programmes de sport Premium</li>
                <li>Journal alimentaire, historique 3 mois</li>
                <li>PDF et notes de votre diététicien</li>
              </ul>

              <Button
                className="mt-5 h-11 w-full rounded-full font-bold shadow-lg shadow-primary/20"
                disabled={
                  !canBuy || (hasSubscription && currentPlan === "premium")
                }
                onClick={() =>
                  void run("premium", () =>
                    startCheckout({
                      kind: "subscription",
                      plan: "premium",
                    }),
                  )
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              Programme personnalisé
            </p>

            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Un programme construit pour vous par votre diététicien :{" "}
              {formatEuro(BILLING_PRICES.customProgramOnce)}, une seule fois.
              Réservé aux abonnés Premium.
            </p>

            <Button
              size="sm"
              variant="outline"
              className="mt-4 h-10 w-full rounded-full font-semibold"
              disabled={
                !canBuy || currentPlan !== "premium" || state === "suspended"
              }
              onClick={() =>
                void run("custom", () =>
                  startCheckout({ kind: "custom_program" }),
                )
              }
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

          <div className="flex flex-col rounded-2xl border p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Video className="h-4 w-4 shrink-0 text-primary" />
              Consultation en visio
            </p>

            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Échangez en visio avec votre professionnel de santé.
            </p>

            <Button
              size="sm"
              variant="outline"
              className="mt-4 h-10 w-full rounded-full font-semibold"
              disabled
            >
              Bientôt disponible
            </Button>
          </div>
        </div>

        {billingEnabled && billing?.stripe_customer_id ? (
          <Button
            variant="outline"
            className="h-12 w-full rounded-full font-semibold"
            disabled={busy !== null}
            onClick={() => void run("portal", openCustomerPortal)}
          >
            {busy === "portal"
              ? "Redirection…"
              : "Gérer mon abonnement et mes factures"}
          </Button>
        ) : null}

        <div className="rounded-2xl bg-muted/30 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Paiement sécurisé par Stripe. Résiliable à tout moment. Prix TTC.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}