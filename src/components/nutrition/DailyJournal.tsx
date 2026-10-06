import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, ChevronUp, Droplets, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { SLOT_LABEL, SLOT_ORDER, type SlotId } from "@/lib/nutritionPlans";

type MealStatus = "respecte" | "ecart" | null;

interface MealEntry {
  status: MealStatus;
  note: string;
}

type MealsMap = Record<SlotId, MealEntry>;

interface LogRow {
  id: string;
  log_date: string;
  meals: unknown;
  water_ml: number | null;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  notes: string | null;
}

interface Props {
  userId: string;
  /** Nombre de jours d'historique affichés (30 = Basic, 90 = Premium, 270 = patient). */
  retentionDays: number;
  /** Lecture seule (vue du professionnel). */
  readOnly?: boolean;
  title?: string;
  /** Message affiché sous l'historique (ex : proposition Premium). */
  footerNote?: string;
}

const GLASS_ML = 250;
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const ENERGIES = ["Très basse", "Basse", "Moyenne", "Bonne", "Excellente"];

function emptyMeals(): MealsMap {
  return {
    matin: { status: null, note: "" },
    midi: { status: null, note: "" },
    collation: { status: null, note: "" },
    soir: { status: null, note: "" },
  };
}

function normalizeMeals(raw: unknown): MealsMap {
  const result = emptyMeals();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return result;
  const obj = raw as Record<string, unknown>;

  for (const slot of SLOT_ORDER) {
    const entry = obj[slot];
    if (typeof entry === "object" && entry !== null) {
      const e = entry as { status?: unknown; note?: unknown };
      result[slot] = {
        status: e.status === "respecte" || e.status === "ecart" ? e.status : null,
        note: typeof e.note === "string" ? e.note : "",
      };
    }
  }
  return result;
}

function isoDay(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function longDate(iso: string) {
  return format(parseISO(iso), "EEEE d MMMM yyyy", { locale: fr });
}

function shortDate(iso: string) {
  return format(parseISO(iso), "EEE d MMM", { locale: fr });
}

function mealsSummary(meals: MealsMap) {
  const slots = SLOT_ORDER.map((s) => meals[s]);
  return {
    respected: slots.filter((m) => m.status === "respecte").length,
    gaps: slots.filter((m) => m.status === "ecart").length,
  };
}

export function DailyJournal({ userId, retentionDays, readOnly = false, title, footerNote }: Props) {
  const today = isoDay(new Date());
  const minDate = isoDay(subDays(new Date(), retentionDays - 1));

  const [entries, setEntries] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [date, setDate] = useState(today);
  const [meals, setMeals] = useState<MealsMap>(emptyMeals());
  const [glasses, setGlasses] = useState(0);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState("");
  const [notes, setNotes] = useState("");

  const fillForm = useCallback((row: LogRow | undefined) => {
    setMeals(row ? normalizeMeals(row.meals) : emptyMeals());
    setGlasses(row?.water_ml ? Math.round(row.water_ml / GLASS_ML) : 0);
    setMood(row?.mood ?? null);
    setEnergy(row?.energy ?? null);
    setSleep(row?.sleep_hours != null ? String(row.sleep_hours) : "");
    setNotes(row?.notes ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, log_date, meals, water_ml, mood, energy, sleep_hours, notes")
        .eq("user_id", userId)
        .gte("log_date", minDate)
        .order("log_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        setErrorMsg(error.message);
        setEntries([]);
      } else {
        const rows = (data ?? []) as LogRow[];
        setEntries(rows);
        fillForm(rows.find((r) => r.log_date === today));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, minDate, today, fillForm]);

  const changeDate = (value: string) => {
    if (!value || value > today || value < minDate) return;
    setDate(value);
    fillForm(entries.find((r) => r.log_date === value));
  };

  const setMeal = (slot: SlotId, patch: Partial<MealEntry>) =>
    setMeals((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));

  const handleSave = async () => {
    const sleepNumber = sleep.trim() === "" ? null : Number(sleep.replace(",", "."));
    if (sleepNumber !== null && (!Number.isFinite(sleepNumber) || sleepNumber < 0 || sleepNumber > 24)) {
      toast.error("Le sommeil doit être compris entre 0 et 24 heures.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("daily_logs")
      .upsert(
        {
          user_id: userId,
          log_date: date,
          meals,
          water_ml: glasses * GLASS_ML,
          mood,
          energy,
          sleep_hours: sleepNumber,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,log_date" },
      )
      .select("id, log_date, meals, water_ml, mood, energy, sleep_hours, notes")
      .single();

    setSaving(false);

    if (error || !data) {
      toast.error("Enregistrement impossible : " + (error?.message ?? "erreur inconnue"));
      return;
    }

    const saved = data as LogRow;
    setEntries((prev) =>
      [saved, ...prev.filter((r) => r.log_date !== saved.log_date)].sort((a, b) =>
        a.log_date < b.log_date ? 1 : -1,
      ),
    );
    toast.success("Journal enregistré ✅");
  };

  const stats = useMemo(() => {
    const since = isoDay(subDays(new Date(), 29));
    const recent = entries.filter((e) => e.log_date >= since);
    let respected = 0;
    let filled = 0;
    for (const e of recent) {
      const s = mealsSummary(normalizeMeals(e.meals));
      respected += s.respected;
      filled += s.respected + s.gaps;
    }
    return {
      days: recent.length,
      respectedPct: filled > 0 ? Math.round((respected / filled) * 100) : null,
    };
  }, [entries]);

  if (loading) return <Skeleton className="h-64 w-full rounded-3xl" />;

  const retentionLabel =
    retentionDays >= 270 ? "9 mois" : retentionDays >= 90 ? "3 mois" : "1 mois";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title ?? "Mon journal alimentaire"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {readOnly
            ? `Historique des ${retentionLabel} récents.`
            : `Notez votre journée en 2 minutes. Historique conservé : ${retentionLabel}.`}
        </p>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Jours renseignés (30 derniers jours)</p>
          <p className="mt-1 text-xl font-semibold">{stats.days}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Repas respectés (30 derniers jours)</p>
          <p className="mt-1 text-xl font-semibold">
            {stats.respectedPct !== null ? `${stats.respectedPct} %` : "—"}
          </p>
        </div>
      </div>

      {!readOnly ? (
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base capitalize">{longDate(date)}</CardTitle>
            <CardDescription>
              {date === today ? "Aujourd'hui" : "Vous modifiez une journée passée"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-[220px] space-y-1">
              <Label htmlFor="journal-date" className="text-xs text-muted-foreground">
                Choisir un jour
              </Label>
              <Input
                id="journal-date"
                type="date"
                value={date}
                min={minDate}
                max={today}
                onChange={(e) => changeDate(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Mes repas</p>
              {SLOT_ORDER.map((slot) => (
                <div key={slot} className="space-y-2 rounded-2xl bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{SLOT_LABEL[slot]}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMeal(slot, { status: meals[slot].status === "respecte" ? null : "respecte" })
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          meals[slot].status === "respecte"
                            ? "border-[#6DB33F] bg-[#6DB33F]/10 font-medium text-[#2D7A1F]"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        ✅ Respecté
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMeal(slot, { status: meals[slot].status === "ecart" ? null : "ecart" })
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          meals[slot].status === "ecart"
                            ? "border-amber-400 bg-amber-50 font-medium text-amber-800"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        ⚠️ Écart
                      </button>
                    </div>
                  </div>
                  <Input
                    value={meals[slot].note}
                    onChange={(e) => setMeal(slot, { note: e.target.value })}
                    placeholder="Ce que j'ai mangé (facultatif)"
                    maxLength={300}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Droplets className="h-4 w-4 text-primary" />
                Eau bue
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setGlasses((g) => Math.max(0, g - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[110px] text-center text-sm font-semibold">
                  {glasses} verre{glasses > 1 ? "s" : ""} · {(glasses * GLASS_ML) / 1000} L
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setGlasses((g) => Math.min(30, g + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Humeur</p>
                <div className="flex gap-2">
                  {MOODS.map((emoji, i) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setMood(mood === i + 1 ? null : i + 1)}
                      className={cn(
                        "h-10 w-10 rounded-full border text-xl transition-colors",
                        mood === i + 1
                          ? "border-[#6DB33F] bg-[#6DB33F]/10"
                          : "border-border bg-background",
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Énergie</p>
                <div className="flex flex-wrap gap-2">
                  {ENERGIES.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setEnergy(energy === i + 1 ? null : i + 1)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        energy === i + 1
                          ? "border-[#6DB33F] bg-[#6DB33F]/10 font-medium text-[#2D7A1F]"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-w-[220px] space-y-1">
              <Label htmlFor="journal-sleep" className="text-sm font-medium">
                Sommeil (heures)
              </Label>
              <Input
                id="journal-sleep"
                type="number"
                inputMode="decimal"
                min="0"
                max="24"
                step="0.5"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                placeholder="ex : 7,5"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="journal-notes" className="text-sm font-medium">
                Notes de la journée
              </Label>
              <Textarea
                id="journal-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Faim, envies, repas à l'extérieur, difficultés…"
                maxLength={1000}
              />
            </div>

            <div className="flex justify-end">
              <Button
                className="rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "Enregistrer ma journée"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-3xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Historique</CardTitle>
          <CardDescription>
            {entries.length} journée{entries.length > 1 ? "s" : ""} sur les {retentionLabel} récents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.length === 0 ? (
            <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
              Aucune journée enregistrée pour le moment.
            </div>
          ) : (
            entries.map((entry) => {
              const m = normalizeMeals(entry.meals);
              const s = mealsSummary(m);
              const open = openId === entry.id;
              return (
                <div key={entry.id} className="rounded-2xl border bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : entry.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <span className="text-sm">
                      <span className="font-medium capitalize">{shortDate(entry.log_date)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ✅ {s.respected} · ⚠️ {s.gaps}
                        {entry.water_ml ? ` · 💧 ${Math.round(entry.water_ml / GLASS_ML)}` : ""}
                        {entry.mood ? ` · ${MOODS[entry.mood - 1]}` : ""}
                      </span>
                    </span>
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {open ? (
                    <div className="space-y-2 border-t px-3 py-3 text-sm">
                      {SLOT_ORDER.map((slot) =>
                        m[slot].status || m[slot].note ? (
                          <p key={slot}>
                            <span className="font-medium">{SLOT_LABEL[slot]}</span>{" "}
                            <span className="text-muted-foreground">
                              {m[slot].status === "respecte"
                                ? "✅ Respecté"
                                : m[slot].status === "ecart"
                                  ? "⚠️ Écart"
                                  : ""}
                              {m[slot].note ? ` — ${m[slot].note}` : ""}
                            </span>
                          </p>
                        ) : null,
                      )}
                      <p className="text-xs text-muted-foreground">
                        {entry.energy ? `Énergie : ${ENERGIES[entry.energy - 1]}` : ""}
                        {entry.sleep_hours != null ? ` · Sommeil : ${entry.sleep_hours} h` : ""}
                      </p>
                      {entry.notes ? (
                        <p className="whitespace-pre-wrap text-xs italic text-muted-foreground">
                          {entry.notes}
                        </p>
                      ) : null}
                      {!readOnly ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            changeDate(entry.log_date);
                            if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Modifier ce jour
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          {footerNote ? (
            <p className="pt-2 text-center text-xs text-muted-foreground">{footerNote}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}