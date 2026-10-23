import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  CHECKIN_TABLE,
  CHECKIN_UPDATED_EVENT,
  DEFAULT_CHECKIN,
  QUESTIONS,
  getTodayKey,
  getWeekStart,
  type CheckinValues,
} from "@/lib/wellbeing";

function snoozeKey(userId: string) {
  return `dfp_checkin_snooze_${userId}`;
}

export function WeeklyCheckinDialog() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "done">("form");
  const [values, setValues] = useState<CheckinValues>(DEFAULT_CHECKIN);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;

    let active = true;

    async function checkCurrentWeek(id: string) {
      try {
        if (window.localStorage.getItem(snoozeKey(id)) === getTodayKey()) {
          return;
        }
      } catch {
        // stockage indisponible : on continue
      }

      const { data, error: loadError } = await supabase
        .from(CHECKIN_TABLE)
        .select("id")
        .eq("user_id", id)
        .eq("week_start", getWeekStart())
        .maybeSingle();

      if (!active) return;

      if (loadError) {
        console.error("[WeeklyCheckinDialog] Vérification impossible :", loadError);
        return;
      }

      if (!data) {
        setOpen(true);
      }
    }

    void checkCurrentWeek(userId);

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (step !== "done") return;

    const timer = window.setTimeout(() => {
      setOpen(false);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [step]);

  function updateValue(key: keyof CheckinValues, value: number) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleLater() {
    if (userId) {
      try {
        window.localStorage.setItem(snoozeKey(userId), getTodayKey());
      } catch {
        // stockage indisponible : on ferme quand même
      }
    }
    setOpen(false);
  }

  async function handleSubmit() {
    if (!userId) return;

    setSaving(true);
    setError("");

    const { error: insertError } = await supabase.from(CHECKIN_TABLE).insert({
      user_id: userId,
      week_start: getWeekStart(),
      energy: values.energy,
      mood: values.mood,
      sleep: values.sleep,
      nutrition: values.nutrition,
      activity: values.activity,
    });

    if (insertError && insertError.code !== "23505") {
      console.error("[WeeklyCheckinDialog] Enregistrement impossible :", insertError);
      setError("Impossible d’enregistrer votre bilan. Réessayez dans un instant.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setStep("done");
    window.dispatchEvent(new Event(CHECKIN_UPDATED_EVENT));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-checkin-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border bg-card p-5 shadow-xl sm:p-6">
        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h2 className="text-lg font-semibold">Merci pour votre bilan</h2>
            <p className="text-sm text-muted-foreground">
              On fera le point ensemble la semaine prochaine.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Bilan de la semaine
              </div>
              <h2 id="weekly-checkin-title" className="text-xl font-semibold">
                Comment s’est passée votre semaine ?
              </h2>
              <p className="text-sm text-muted-foreground">
                Cela prend moins d’une minute. Une fois envoyé, le bilan ne peut
                plus être modifié : on s’améliorera la semaine suivante.
              </p>
            </div>

            <div className="space-y-4">
              {QUESTIONS.map((question) => (
                <div key={question.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{question.label}</span>
                    <span className="text-sm font-semibold text-primary">
                      {values[question.key]}/5
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${question.label} : ${value} sur 5`}
                        onClick={() => updateValue(question.key, value)}
                        className={[
                          "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                          values[question.key] === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background hover:bg-primary/10",
                        ].join(" ")}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={handleLater}
                disabled={saving}
              >
                Plus tard
              </Button>

              <Button
                type="button"
                className="rounded-2xl"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Envoyer mon bilan"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}