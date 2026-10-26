import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useAccessState,
  useBillingEnabled,
} from "@/hooks/useAccessState";
import {
  BILLING_PRICES,
  formatEuro,
  startCheckout,
} from "@/lib/billing";

export function CustomProgramCard() {
  const { billingEnabled } = useBillingEnabled();
  const { state } = useAccessState();
  const [busy, setBusy] = useState(false);

  const blocked = state === "suspended";

  const handleOrder = async () => {
    if (!billingEnabled || busy || blocked) return;

    setBusy(true);

    try {
      await startCheckout({ kind: "custom_program" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue.",
      );
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-3xl border border-dashed shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>

          <div>
            <CardTitle className="text-base">
              Plan sur mesure par votre diététicien
            </CardTitle>

            <CardDescription className="mt-1">
              Un programme construit pour vous à partir d&apos;un
              questionnaire complet (
              {formatEuro(BILLING_PRICES.customProgramOnce)}, une seule
              fois).
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Button
          className="w-full rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F] sm:w-auto"
          disabled={!billingEnabled || busy || blocked}
          onClick={() => void handleOrder()}
        >
          {busy
            ? "Redirection…"
            : !billingEnabled
              ? "Bientôt disponible"
              : blocked
                ? "Indisponible"
                : `Commander · ${formatEuro(BILLING_PRICES.customProgramOnce)}`}
        </Button>
      </CardContent>
    </Card>
  );
}