import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openCustomerPortal } from "@/lib/billing";


export function PastDueBanner() {
  const [busy, setBusy] = useState(false);


  const handleClick = async () => {
    setBusy(true);
    try {
      await openCustomerPortal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
      setBusy(false);
    }
  };


  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Votre dernier paiement n'a pas abouti. Mettez à jour votre moyen de paiement pour
          conserver l'accès à votre espace.
        </p>
        <Button
          size="sm"
          className="shrink-0 rounded-xl bg-amber-600 text-white hover:bg-amber-700"
          disabled={busy}
          onClick={() => void handleClick()}
        >
          {busy ? "Redirection…" : "Mettre à jour mon paiement"}
        </Button>
      </div>
    </div>
  );
}