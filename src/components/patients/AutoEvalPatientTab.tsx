import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  calculateLevel,
  countSuccessfulWeeks,
  getUnlockedBadges,
  getNextBadge,
  getCurrentWeekStartDate,
  type CheckinStatus,
  type WeeklyCheckin,
  type Badge as BadgeType,
} from "@/lib/gamification";

interface AutoEvalPatientTabProps {
  userId: string | null;
  patientLabel: string;
  proId: string;
}

const STATUS_LABELS: Record<CheckinStatus, string> = {
  respecte_100: "✅ Respectée à 100%",
  respecte_80: "🟢 Respectée à 80%",
  respecte_50: "🟡 Respectée à 50%",
  non_respecte: "🔴 Pas respectée",
};

const STATUS_OPTIONS: CheckinStatus[] = ["respecte_100", "respecte_80", "respecte_50", "non_respecte"];

export function AutoEvalPatientTab({ userId, patientLabel, proId }: AutoEvalPatientTabProps) {
  const [checkins, setCheckins] = useState<WeeklyCheckin[] | null>(null);
  const [allBadges, setAllBadges] = useState<BadgeType[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [nutritionStatus, setNutritionStatus] = useState<CheckinStatus>("respecte_100");
  const [sportStatus, setSportStatus] = useState<CheckinStatus>("respecte_100");
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);

    const [checkinsRes, badgesRes, userBadgesRes] = await Promise.all([
      supabase
        .from("weekly_checkins")
        .select("week_start_date, nutrition_status, sport_status, weight_kg, mood_note")
        .eq("user_id", userId)
        .order("week_start_date", { ascending: false }),
      supabase.from("badges").select("id, category, code, label, threshold, points"),
      supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    ]);

    const mapped: WeeklyCheckin[] = (checkinsRes.data ?? []).map((c) => ({
      weekStartDate: c.week_start_date,
      nutritionStatus: c.nutrition_status,
      sportStatus: c.sport_status,
    }));

    setCheckins(mapped);
    setAllBadges((badgesRes.data ?? []) as BadgeType[]);
    setEarnedBadgeIds(new Set((userBadgesRes.data ?? []).map((b: { badge_id: string }) => b.badge_id)));
    setLoading(false);
  }

  async function handleSubmit() {
    if (!userId) return;
    setSaving(true);

    const weekStartDate = getCurrentWeekStartDate();

    const { error } = await supabase.from("weekly_checkins").upsert(
      {
        user_id: userId,
        week_start_date: weekStartDate,
        nutrition_status: nutritionStatus,
        sport_status: sportStatus,
        weight_kg: weightKg ? Number(weightKg) : null,
        mood_note: note.trim() || null,
        filled_by: proId,
      },
      { onConflict: "user_id,week_start_date" },
    );

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Auto-évaluation enregistrée ✅");
    setEditOpen(false);
    setWeightKg("");
    setNote("");
    await load();
  }

  if (!userId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Ce patient n'a pas encore de compte actif. L'auto-évaluation sera disponible
          une fois l'invitation acceptée.
        </CardContent>
      </Card>
    );
  }

  if (loading || checkins === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const nutritionSuccessCount = countSuccessfulWeeks(checkins, "nutrition");
  const sportSuccessCount = countSuccessfulWeeks(checkins, "sport");

  const nutritionUnlocked = getUnlockedBadges(allBadges, "nutrition", nutritionSuccessCount);
  const sportUnlocked = getUnlockedBadges(allBadges, "sport", sportSuccessCount);
  const nextNutritionBadge = getNextBadge(allBadges, "nutrition", nutritionSuccessCount);
  const nextSportBadge = getNextBadge(allBadges, "sport", sportSuccessCount);

  const totalPoints = [...nutritionUnlocked, ...sportUnlocked].reduce((sum, b) => sum + b.points, 0);
  const { level, pointsInCurrentLevel, pointsToNextLevel } = calculateLevel(totalPoints);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🏆 Niveau de {patientLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-[#2D7A1F]">Niveau {level}</span>
            <span className="text-sm text-muted-foreground">
              {pointsInCurrentLevel}/100 points — {pointsToNextLevel} pts avant le niveau {level + 1}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[#6DB33F] transition-all"
              style={{ width: `${pointsInCurrentLevel}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🥗 Badges Nutrition ({nutritionSuccessCount} semaines réussies)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nutritionUnlocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun badge débloqué encore.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {nutritionUnlocked.map((b) => (
                  <Badge key={b.id} variant="secondary" className="bg-[#6DB33F]/10 text-[#2D7A1F]">
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}
            {nextNutritionBadge ? (
              <p className="text-xs text-muted-foreground">
                Prochain badge : {nextNutritionBadge.label} (
                {nextNutritionBadge.threshold - nutritionSuccessCount} semaine
                {nextNutritionBadge.threshold - nutritionSuccessCount > 1 ? "s" : ""} restante
                {nextNutritionBadge.threshold - nutritionSuccessCount > 1 ? "s" : ""})
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🏋️ Badges Sport ({sportSuccessCount} semaines réussies)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sportUnlocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun badge débloqué encore.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sportUnlocked.map((b) => (
                  <Badge key={b.id} variant="secondary" className="bg-[#6DB33F]/10 text-[#2D7A1F]">
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}
            {nextSportBadge ? (
              <p className="text-xs text-muted-foreground">
                Prochain badge : {nextSportBadge.label} (
                {nextSportBadge.threshold - sportSuccessCount} semaine
                {nextSportBadge.threshold - sportSuccessCount > 1 ? "s" : ""} restante
                {nextSportBadge.threshold - sportSuccessCount > 1 ? "s" : ""})
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">📋 Historique des auto-évaluations</CardTitle>
          <Button
            size="sm"
            className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
            onClick={() => setEditOpen((v) => !v)}
          >
            {editOpen ? "Fermer" : "Remplir / corriger cette semaine"}
          </Button>
        </CardHeader>

        {editOpen ? (
          <CardContent className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Nutrition cette semaine
                </label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={nutritionStatus}
                  onChange={(e) => setNutritionStatus(e.target.value as CheckinStatus)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Sport cette semaine
                </label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={sportStatus}
                  onChange={(e) => setSportStatus(e.target.value as CheckinStatus)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Poids (kg, optionnel)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="ex: 78.5"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Note (optionnel)</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contexte, ressenti…"
              />
            </div>

            <div className="flex justify-end">
              <Button
                className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </CardContent>
        ) : null}

        <CardContent className="pt-0">
          {checkins.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune auto-évaluation enregistrée encore.
            </p>
          ) : (
            <div className="space-y-2">
              {checkins.map((c) => (
                <div
                  key={c.weekStartDate}
                  className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium">
                    Semaine du {new Date(c.weekStartDate).toLocaleDateString("fr-FR")}
                  </span>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Nutrition : {c.nutritionStatus ? STATUS_LABELS[c.nutritionStatus] : "—"}</span>
                    <span>Sport : {c.sportStatus ? STATUS_LABELS[c.sportStatus] : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}