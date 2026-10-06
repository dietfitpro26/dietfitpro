import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ANAMNESE_SECTIONS,
  isAnswered,
  isExclusiveOption,
  type AnamneseAnswers,
  type AnswerValue,
  type Question,
  type Section,
} from "@/lib/anamneseSchema";

export interface AnamneseSaveOptions {
  complete: boolean;
  consent: boolean;
}

interface Props {
  gender: string | null;
  initial: AnamneseAnswers | null;
  /** "wizard" = écran par écran (patient). "full" = tout sur une page (pro). */
  layout?: "wizard" | "full";
  alreadyConsented?: boolean;
  /** Texte de la case de consentement (par défaut : formulation pour le patient). */
  consentLabel?: string;
  /** Ouvre directement l'écran de consentement (dossier déjà rempli par le pro). */
  startAtConsent?: boolean;
  onSave: (answers: AnamneseAnswers, options: AnamneseSaveOptions) => Promise<boolean>;
  onFinished?: () => void;
}

const CONSENT_TEXT =
  "Je consens à ce que mon diététicien recueille et utilise ces informations de santé pour établir mon accompagnement. Je peux les consulter, les modifier ou demander leur suppression à tout moment.";

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        selected
          ? "border-[#6DB33F] bg-[#6DB33F]/10 font-medium text-[#2D7A1F]"
          : "border-border bg-background text-muted-foreground hover:border-[#6DB33F]/50",
      )}
    >
      {selected ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  if (q.type === "text") {
    return (
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder}
      />
    );
  }

  if (q.type === "textarea") {
    return (
      <Textarea
        rows={3}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder}
      />
    );
  }

  if (q.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          className="max-w-[140px]"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={q.placeholder}
        />
        {q.unit ? <span className="text-sm text-muted-foreground">{q.unit}</span> : null}
      </div>
    );
  }

  if (q.type === "single") {
    return (
      <div className="flex flex-wrap gap-2">
        {(q.options ?? []).map((opt) => (
          <Chip
            key={opt}
            selected={value === opt}
            onClick={() => onChange(value === opt ? null : opt)}
          >
            {opt}
          </Chip>
        ))}
      </div>
    );
  }

  if (q.type === "multi") {
    const current = Array.isArray(value) ? value : [];
    const toggle = (opt: string) => {
      if (current.includes(opt)) {
        onChange(current.filter((x) => x !== opt));
        return;
      }
      if (isExclusiveOption(opt)) {
        onChange([opt]);
        return;
      }
      onChange([...current.filter((x) => !isExclusiveOption(x)), opt]);
    };
    return (
      <div className="flex flex-wrap gap-2">
        {(q.options ?? []).map((opt) => (
          <Chip key={opt} selected={current.includes(opt)} onClick={() => toggle(opt)}>
            {opt}
          </Chip>
        ))}
      </div>
    );
  }

  const min = q.min ?? 0;
  const max = q.max ?? 10;
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="flex flex-wrap gap-2">
      {points.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "h-9 w-9 rounded-full border text-sm transition-colors",
            value === n
              ? "border-[#6DB33F] bg-[#6DB33F] font-semibold text-white"
              : "border-border bg-background text-muted-foreground hover:border-[#6DB33F]/50",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function QuestionBlock({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium leading-snug">{q.label}</Label>
      {q.hint ? <p className="text-xs text-muted-foreground">{q.hint}</p> : null}
      <QuestionField q={q} value={value} onChange={onChange} />
    </div>
  );
}

export function AnamneseForm({
  gender,
  initial,
  layout = "wizard",
  alreadyConsented = false,
  consentLabel,
  startAtConsent = false,
  onSave,
  onFinished,
}: Props) {
  const [answers, setAnswers] = useState<AnamneseAnswers>(initial ?? {});
  const [step, setStep] = useState<number>(() => (startAtConsent ? ANAMNESE_SECTIONS.length : 0));
  const [consent, setConsent] = useState(alreadyConsented);
  const [saving, setSaving] = useState(false);

  const sections: Section[] = useMemo(
    () =>
      ANAMNESE_SECTIONS.map((s) => ({
        ...s,
        questions: s.questions.filter((q) => !q.femaleOnly || gender === "femme"),
      })),
    [gender],
  );

  const setAnswer = (id: string, value: AnswerValue) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const allQuestions = sections.flatMap((s) => s.questions);
  const answeredCount = allQuestions.filter((q) => isAnswered(answers[q.id])).length;

  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderSection = (section: Section) => (
    <Card key={section.id} className="rounded-3xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">
          {section.emoji} {section.title}
        </CardTitle>
        <CardDescription>{section.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {section.questions.map((q) => (
          <QuestionBlock
            key={q.id}
            q={q}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
      </CardContent>
    </Card>
  );

  const consentBlock = (
    <label className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-4 text-sm">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
      />
      <span>{consentLabel ?? CONSENT_TEXT}</span>
    </label>
  );

  if (layout === "full") {
    const saveFull = async () => {
      setSaving(true);
      await onSave(answers, { complete: true, consent });
      setSaving(false);
    };

    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {answeredCount} / {allQuestions.length} questions renseignées
        </p>
        {sections.map(renderSection)}
        {consentBlock}
        <div className="flex justify-end">
          <Button
            className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
            onClick={saveFull}
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer le dossier"}
          </Button>
        </div>
      </div>
    );
  }

  const lastStep = sections.length;
  const progress = Math.round((step / (lastStep + 1)) * 100);

  const goNext = async () => {
    setSaving(true);
    await onSave(answers, { complete: false, consent: false });
    setSaving(false);
    setStep((s) => Math.min(s + 1, lastStep));
    scrollTop();
  };

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  const finish = async () => {
    if (!consent) return;
    setSaving(true);
    const ok = await onSave(answers, { complete: true, consent: true });
    setSaving(false);
    if (ok) onFinished?.();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Étape {Math.min(step + 1, lastStep + 1)} sur {lastStep + 1}
          </span>
          <span>{answeredCount} réponses</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#6DB33F] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {step < lastStep ? (
        renderSection(sections[step])
      ) : (
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">✅ Validation</CardTitle>
            <CardDescription>
              Merci. Il reste à confirmer votre consentement pour enregistrer votre dossier.
              Utilisez « Précédent » si vous souhaitez relire ou corriger vos réponses.
            </CardDescription>
          </CardHeader>
          <CardContent>{consentBlock}</CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={goBack} disabled={step === 0 || saving}>
          Précédent
        </Button>

        {step < lastStep ? (
          <Button
            className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Suivant"}
          </Button>
        ) : (
          <Button
            className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
            onClick={finish}
            disabled={!consent || saving}
          >
            {saving ? "Enregistrement…" : "Terminer"}
          </Button>
        )}
      </div>
    </div>
  );
}