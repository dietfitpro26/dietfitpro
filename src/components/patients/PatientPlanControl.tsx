import { useEffect, useState } from "react";
import { CheckCircle2, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type PatientPlan = "basic" | "premium";

type PatientPlanControlProps = {
  patientUserId: string | null;
  patientName: string;
};

export function PatientPlanControl({
  patientUserId,
  patientName,
}: PatientPlanControlProps) {
  const [plan, setPlan] = useState<PatientPlan>("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      if (!patientUserId) {
        if (!cancelled) {
          setPlan("basic");
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", patientUserId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "[PatientPlanControl] Erreur chargement formule :",
          error
        );
        toast.error("Impossible de charger la formule du patient.");
        setLoading(false);
        return;
      }

      setPlan(
        (data as { plan?: string } | null)?.plan === "premium"
          ? "premium"
          : "basic"
      );

      setLoading(false);
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [patientUserId]);

  const handlePlanChange = async () => {
    if (!patientUserId) {
      toast.error(
        "Ce patient n'a pas encore de compte. Envoyez-lui une invitation avant de modifier sa formule."
      );
      return;
    }

    const nextPlan: PatientPlan =
      plan === "premium" ? "basic" : "premium";

    const confirmed = window.confirm(
      nextPlan === "premium"
        ? `Activer Premium pour ${patientName} ?\n\nLe patient aura accès aux 9 programmes Sport : les 3 programmes Basic et les 6 programmes Premium.`
        : `Repasser ${patientName} en Basic ?\n\nLe patient conservera uniquement les 3 programmes Sport Basic.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc("set_patient_plan", {
      p_patient_user_id: patientUserId,
      p_plan: nextPlan,
    });

    setSaving(false);

    if (error) {
      console.error(
        "[PatientPlanControl] Erreur mise à jour formule :",
        error
      );

      toast.error(`Impossible de modifier la formule : ${error.message}`);
      return;
    }

    setPlan(nextPlan);

    toast.success(
      nextPlan === "premium"
        ? "Accès Premium activé pour le patient ✅"
        : "Patient repassé en Basic ✅"
    );
  };

  const isPremium = plan === "premium";

  return (
    <div
      className={
        isPremium
          ? "mb-5 rounded-xl border-2 border-amber-400 bg-amber-50 p-4"
          : "mb-5 rounded-xl border-2 border-slate-300 bg-slate-50 p-4"
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Crown
              className={
                isPremium
                  ? "h-5 w-5 text-amber-600"
                  : "h-5 w-5 text-slate-600"
              }
            />

            <p className="text-sm font-bold text-foreground">
              Formule du patient
            </p>

            {loading ? (
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Chargement…
              </span>
            ) : isPremium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Premium actif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-white shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Basic actif
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Premium donne accès aux 6 programmes Sport supplémentaires et aux
            contenus Premium. Basic conserve les 3 programmes essentiels.
          </p>
        </div>

        <Button
          type="button"
          variant={isPremium ? "outline" : "default"}
          className={
            isPremium
              ? "border-amber-500 bg-white text-amber-700 hover:bg-amber-100"
              : "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
          }
          onClick={() => void handlePlanChange()}
          disabled={loading || saving || !patientUserId}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Mise à jour…
            </>
          ) : isPremium ? (
            "Repasser en Basic"
          ) : (
            "Activer Premium"
          )}
        </Button>
      </div>

      {!patientUserId ? (
        <p className="mt-3 text-xs font-medium text-amber-700">
          Le patient doit disposer d’un compte actif avant que sa formule
          puisse être modifiée.
        </p>
      ) : null}
    </div>
  );
}