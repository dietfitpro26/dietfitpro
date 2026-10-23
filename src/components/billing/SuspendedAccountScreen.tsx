import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BILLING_PRICES, formatEuro, openCustomerPortal, startCheckout } from "@/lib/billing";
import { useBillingEnabled, useMyBilling } from "@/hooks/useAccessState";


export function SuspendedAccountScreen() {
  const { billingEnabled } = useBillingEnabled();
  const { billing, loading } = useMyBilling();
  const [busy, setBusy] = useState<string | null>(null);


  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
      setBusy(null);
    }
  };


  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-40 animate-pulse rounded-3xl bg-muted" />
          <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }


  // Première connexion : la personne n'a encore jamais souscrit d'abonnement.
  const isFirstTime = !billing?.stripe_subscription_id;


  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className={
                  isFirstTime
                    ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6DB33F]/15 text-[#2D7A1F]"
                    : "flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
                }
              >
                {isFirstTime ? <Sparkles className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {isFirstTime
                    ? "Bienvenue sur DietFitPro"
                    : "Votre abonnement est suspendu"}
                </CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  {isFirstTime
                    ? `Votre compte est créé. Pour accéder à votre programme nutrition, à votre programme sport et à votre journal, choisissez votre formule. Vous bénéficiez de ${BILLING_PRICES.trialDays} jours d'essai gratuits : aucun prélèvement pendant l'essai.`
                    : "Vos données sont conservées. Votre programme nutrition, votre programme sport, votre journal et votre évolution réapparaîtront dès la réactivation de votre abonnement. En attendant, vous pouvez consulter votre profil."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full rounded-2xl">
              <Link to="/subscriber/profile">
                <UserRound className="mr-2 h-4 w-4" />
                Voir mon profil
              </Link>
            </Button>
          </CardContent>
        </Card>


        <Card className="rounded-3xl border border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {isFirstTime ? "Choisir ma formule" : "Réactiver mon abonnement"}
            </CardTitle>
            <CardDescription>
              {isFirstTime
                ? `${BILLING_PRICES.trialDays} jours d'essai gratuits, puis paiement mensuel. Paiement sécurisé par Stripe. Résiliable à tout moment depuis votre espace.`
                : "Paiement sécurisé par Stripe. Résiliable à tout moment depuis votre espace."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="rounded-2xl"
                variant="outline"
                disabled={!billingEnabled || busy !== null}
                onClick={() =>
                  void run("basic", () => startCheckout({ kind: "subscription", plan: "basic" }))
                }
              >
                {busy === "basic"
                  ? "Redirection…"
                  : `Basic — ${formatEuro(BILLING_PRICES.basicMonthly)} / mois`}
              </Button>
              <Button
                className="rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                disabled={!billingEnabled || busy !== null}
                onClick={() =>
                  void run("premium", () => startCheckout({ kind: "subscription", plan: "premium" }))
                }
              >
                {busy === "premium"
                  ? "Redirection…"
                  : `Premium — ${formatEuro(BILLING_PRICES.premiumMonthly)} / mois`}
              </Button>
            </div>


            {!isFirstTime ? (
              <Button
                variant="ghost"
                className="w-full rounded-2xl text-sm"
                disabled={!billingEnabled || busy !== null}
                onClick={() => void run("portal", openCustomerPortal)}
              >
                {busy === "portal" ? "Redirection…" : "Gérer mon moyen de paiement"}
              </Button>
            ) : null}


            {!billingEnabled ? (
              <p className="text-center text-xs text-muted-foreground">
                Le paiement en ligne n'est pas encore disponible. Contactez votre professionnel
                pour activer votre accès.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}