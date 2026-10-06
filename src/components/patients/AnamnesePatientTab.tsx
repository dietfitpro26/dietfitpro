import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { AnamneseForm, type AnamneseSaveOptions } from "@/components/patients/AnamneseForm";
import {
  ANAMNESE_SECTIONS,
  isAnswered,
  type AnamneseAnswers,
  type AnswerValue,
} from "@/lib/anamneseSchema";

interface Props {
  patientId: string;
  gender: string | null;
  anamnese: AnamneseAnswers | null;
  completedAt: string | null;
  consentAt: string | null;
  onSaved: () => void | Promise<void>;
}

const PRO_CONSENT_LABEL =
  "Consentement du patient recueilli (en consultation ou par écrit) pour l'enregistrement de ses données de santé.";

function formatAnswer(value: AnswerValue | undefined, unit?: string): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return unit ? `${value} ${unit}` : String(value);
  return typeof value === "string" ? value : "";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function AnamnesePatientTab({
  patientId,
  gender,
  anamnese,
  completedAt,
  consentAt,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState(false);

  const handleSave = async (
    answers: AnamneseAnswers,
    options: AnamneseSaveOptions,
  ): Promise<boolean> => {
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("patients")
      .update({
        anamnese: answers,
        anamnese_completed_at: completedAt ?? nowIso,
        anamnese_consent_at: consentAt ?? (options.consent ? nowIso : null),
      })
      .eq("id", patientId);

    if (error) {
      toast.error("Enregistrement impossible : " + error.message);
      return false;
    }

    toast.success("Dossier santé enregistré ✅");
    await onSaved();
    setEditing(false);
    return true;
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </div>
        <AnamneseForm
          gender={gender}
          initial={anamnese}
          layout="full"
          alreadyConsented={!!consentAt}
          consentLabel={PRO_CONSENT_LABEL}
          onSave={handleSave}
        />
      </div>
    );
  }

  const hasData =
    !!anamnese && ANAMNESE_SECTIONS.some((s) => s.questions.some((q) => isAnswered(anamnese[q.id])));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">📋 Dossier santé (anamnèse)</p>
            <p className="text-xs text-muted-foreground">
              {completedAt ? `Complété le ${formatDate(completedAt)}` : "Non complété"}
              {" · "}
              {consentAt
                ? `Consentement enregistré le ${formatDate(consentAt)}`
                : "Consentement en attente"}
            </p>
          </div>
          <Button
            className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1 h-4 w-4" />
            {hasData ? "Modifier le dossier" : "Remplir le dossier"}
          </Button>
        </CardContent>
      </Card>

      {!hasData ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucune réponse enregistrée pour l'instant. Remplissez le dossier en consultation, ou
          laissez le patient le compléter depuis son espace.
        </div>
      ) : (
        ANAMNESE_SECTIONS.map((section) => {
          const rows = section.questions.filter((q) => isAnswered(anamnese?.[q.id]));
          if (rows.length === 0) return null;
          return (
            <Card key={section.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {section.emoji} {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rows.map((q) => (
                  <div key={q.id}>
                    <p className="text-xs text-muted-foreground">{q.label}</p>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {formatAnswer(anamnese?.[q.id], q.unit)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}