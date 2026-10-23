import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface AnamneseStatus {
  anamnese_completed_at: string | null;
  anamnese_consent_at: string | null;
}

export function AnamneseReminderBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<AnamneseStatus | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("anamnese_completed_at, anamnese_consent_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setStatus(error ? null : ((data as AnamneseStatus | null) ?? null));
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Chargement, erreur ou pas de fiche patient : on n'affiche rien.
  if (!status) return null;

  const notStarted = !status.anamnese_completed_at;
  const waitingConsent = !!status.anamnese_completed_at && !status.anamnese_consent_at;

  if (!notStarted && !waitingConsent) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#6DB33F]/40 bg-[#6DB33F]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6DB33F]/15 text-[#2D7A1F]">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {notStarted
              ? "Complétez votre dossier santé"
              : "Votre dossier santé est prêt : confirmez-le"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {notStarted
              ? "Quelques questions (5 à 7 minutes) pour que votre diététicien prépare un accompagnement adapté."
              : "Votre diététicien l'a renseigné. Relisez-le et confirmez votre consentement."}
          </p>
        </div>
      </div>
      <Link
        to="/patient/anamnese"
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#6DB33F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2D7A1F]"
      >
        {notStarted ? "Commencer" : "Relire et confirmer"}
      </Link>
    </div>
  );
}