import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BILLING_PRICES, formatEuro, openCustomerPortal, startCheckout } from "@/lib/billing";
import { useBillingEnabled } from "@/hooks/useAccessState";


export function SuspendedAccountScreen() {
  const { billingEnabled } = useBillingEnabled();
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


  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Votre abonnement est suspendu</CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  Vos données sont conservées. Votre programme nutrition, votre programme sport,
                  votre journal et votre évolution réapparaîtront dès la réactivation de votre
                  abonnement. En attendant, vous pouvez consulter votre profil.
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
            <CardTitle className="text-base">Réactiver mon abonnement</CardTitle>
            <CardDescription>
              Paiement sécurisé par Stripe. Résiliable à tout moment depuis votre espace.
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


            <Button
              variant="ghost"
              className="w-full rounded-2xl text-sm"
              disabled={!billingEnabled || busy !== null}
              onClick={() => void run("portal", openCustomerPortal)}
            >
              {busy === "portal" ? "Redirection…" : "Gérer mon moyen de paiement"}
            </Button>


            {!billingEnabled ? (
              <p className="text-center text-xs text-muted-foreground">
                Le paiement en ligne n'est pas encore disponible. Contactez votre professionnel
                pour réactiver votre accès.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}