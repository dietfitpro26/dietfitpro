import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type WeeklyCheckinCardProps = {
  userId: string;
};

type CheckinValues = {
  energy: number;
  mood: number;
  sleep: number;
  nutrition: number;
  activity: number;
};

type CheckinRow = Partial<CheckinValues> | null;

const TABLE_NAME = "wellbeing_checkins";

const DEFAULT_VALUES: CheckinValues = {
  energy: 3,
  mood: 3,
  sleep: 3,
  nutrition: 3,
  activity: 3,
};

const QUESTIONS: Array<{
  key: keyof CheckinValues;
  label: string;
}> = [
  { key: "energy", label: "Mon énergie cette semaine" },
  { key: "mood", label: "Mon moral cette semaine" },
  { key: "sleep", label: "La qualité de mon sommeil" },
  { key: "nutrition", label: "La qualité de mon alimentation" },
  { key: "activity", label: "Ma régularité sportive" },
];

function getWeekStart(): string {
  const date = new Date();
  const day = date.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + difference);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${dayOfMonth}`;
}

export function WeeklyCheckinCard({ userId }: WeeklyCheckinCardProps) {
  const [values, setValues] = useState<CheckinValues>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCheckin() {
      setLoading(true);
      setError("");

      const weekStart = getWeekStart();

      const { data, error: loadError } = await supabase
        .from(TABLE_NAME)
        .select("energy, mood, sleep, nutrition, activity")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (!active) return;

      if (loadError) {
        console.error("[WeeklyCheckinCard] Chargement impossible :", loadError);
        setError("Impossible de charger votre bilan de la semaine.");
      } else if (data) {
        const checkin = data as CheckinRow;

        setValues({
          energy: checkin?.energy ?? 3,
          mood: checkin?.mood ?? 3,
          sleep: checkin?.sleep ?? 3,
          nutrition: checkin?.nutrition ?? 3,
          activity: checkin?.activity ?? 3,
        });

        setSaved(true);
      }

      setLoading(false);
    }

    void loadCheckin();

    return () => {
      active = false;
    };
  }, [userId]);

  function updateValue(key: keyof CheckinValues, value: number) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const weekStart = getWeekStart();

    const { error: saveError } = await supabase.from(TABLE_NAME).upsert(
      {
        user_id: userId,
        week_start: weekStart,
        energy: values.energy,
        mood: values.mood,
        sleep: values.sleep,
        nutrition: values.nutrition,
        activity: values.activity,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,week_start",
      },
    );

    if (saveError) {
      console.error("[WeeklyCheckinCard] Enregistrement impossible :", saveError);
      setError("Impossible d’enregistrer votre bilan.");
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <Card className="rounded-3xl shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            Chargement de votre bilan hebdomadaire...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          Mon bilan de la semaine
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          Prenez quelques secondes pour faire le point sur votre semaine.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Bilan enregistré
              </>
            ) : (
              "Votre bilan reste privé."
            )}
          </div>

          <Button
            type="button"
            className="rounded-2xl"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer mon bilan"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}