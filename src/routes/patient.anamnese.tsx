import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { AnamneseForm, type AnamneseSaveOptions } from "@/components/patients/AnamneseForm";
import type { AnamneseAnswers } from "@/lib/anamneseSchema";

export const Route = createFileRoute("/patient/anamnese")({
  head: () => ({ meta: [{ title: "Mon dossier santé — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <Content />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

interface PatientRow {
  gender: string | null;
  anamnese: AnamneseAnswers | null;
  anamnese_completed_at: string | null;
  anamnese_consent_at: string | null;
}

function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [row, setRow] = useState<PatientRow | null | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("gender, anamnese, anamnese_completed_at, anamnese_consent_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setErrorMsg(error.message);
        setRow(null);
        return;
      }

      setRow((data as PatientRow | null) ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSave = async (
    answers: AnamneseAnswers,
    options: AnamneseSaveOptions,
  ): Promise<boolean> => {
    const { error } = await supabase.rpc("save_my_anamnese", {
      p_answers: answers,
      p_complete: options.complete,
      p_consent: options.consent,
    });

    if (error) {
      toast.error("Enregistrement impossible : " + error.message);
      return false;
    }

    if (options.complete) {
      toast.success("Merci ! Votre dossier est enregistré ✅");
    }
    return true;
  };

  if (row === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  // Dossier déjà rempli par le professionnel, consentement du patient en attente.
  const preparedByPro = !!row && !!row.anamnese_completed_at && !row.anamnese_consent_at;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">Votre dossier santé</CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  {preparedByPro
                    ? "Votre diététicien a déjà renseigné votre dossier. Relisez-le si vous le souhaitez, puis confirmez votre consentement."
                    : "Quelques questions (5 à 7 minutes) pour que votre diététicien prépare un accompagnement adapté. Vos réponses sont confidentielles et visibles uniquement par votre professionnel."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {errorMsg ? (
          <Card className="rounded-3xl border border-destructive/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Impossible de charger votre dossier</CardTitle>
              <CardDescription>{errorMsg}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {row === null ? (
          !errorMsg ? (
            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Aucune fiche patient trouvée</CardTitle>
                <CardDescription>
                  Contactez votre professionnel pour qu'il vérifie votre invitation.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null
        ) : (
          <>
            {row.anamnese_completed_at && row.anamnese_consent_at ? (
              <div className="rounded-2xl border border-[#6DB33F]/40 bg-[#6DB33F]/5 px-4 py-3 text-sm text-[#2D7A1F]">
                Dossier complété le{" "}
                {new Date(row.anamnese_completed_at).toLocaleDateString("fr-FR")}. Vous pouvez le
                modifier à tout moment.
              </div>
            ) : null}

            <AnamneseForm
              gender={row.gender}
              initial={row.anamnese}
              alreadyConsented={!!row.anamnese_consent_at}
              startAtConsent={preparedByPro}
              onSave={handleSave}
              onFinished={() => void navigate({ to: "/patient/dashboard" })}
            />
          </>
        )}
      </div>
    </div>
  );
}