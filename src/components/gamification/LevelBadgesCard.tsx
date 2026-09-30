import { useCallback, useEffect, useState } from "react";
import { Award, Dumbbell, Flame, Lock, Moon, TrendingUp, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CHECKIN_TABLE,
  CHECKIN_UPDATED_EVENT,
  computeProgress,
  type BadgeInfo,
  type CheckinRow,
  type Progress,
} from "@/lib/wellbeing";

const BADGE_ICONS: Record<BadgeInfo["id"], React.ElementType> = {
  first: Award,
  streak3: Flame,
  energy_up: TrendingUp,
  sleep: Moon,
  sport: Dumbbell,
};

export function LevelBadgesCard({ userId }: { userId: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from(CHECKIN_TABLE)
      .select("week_start, energy, mood, sleep, nutrition, activity")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(52);

    if (loadError) {
      console.error("[LevelBadgesCard] Chargement impossible :", loadError);
      setError(true);
      return;
    }

    setError(false);
    setProgress(computeProgress((data ?? []) as CheckinRow[]));
  }, [userId]);

  useEffect(() => {
    void load();

    const handleUpdate = () => {
      void load();
    };

    window.addEventListener(CHECKIN_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener(CHECKIN_UPDATED_EVENT, handleUpdate);
    };
  }, [load]);

  if (error) return null;

  if (!progress) {
    return (
      <Card className="rounded-3xl shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Chargement de votre niveau...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-primary" />
          Mon niveau
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xl font-bold text-primary">{progress.levelName}</p>
              <p className="text-xs text-muted-foreground">
                {progress.points} points · {progress.count} bilan
                {progress.count > 1 ? "s" : ""}
                {progress.currentStreak > 1
                  ? ` · ${progress.currentStreak} semaines d’affilée`
                  : ""}
              </p>
            </div>

            <p className="text-right text-xs text-muted-foreground">
              {progress.nextLevelName
                ? `${progress.pointsToNext} pts avant « ${progress.nextLevelName} »`
                : "Niveau maximum atteint"}
            </p>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>

          {progress.count === 0 ? (
            <p className="text-xs text-muted-foreground">
              Votre niveau progresse à chaque bilan du lundi.
            </p>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {progress.badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.id];

            return (
              <div
                key={badge.id}
                className={[
                  "flex items-start gap-3 rounded-2xl border p-3",
                  badge.earned ? "bg-card" : "bg-muted/30 opacity-70",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    badge.earned
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {badge.earned ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium">{badge.label}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}