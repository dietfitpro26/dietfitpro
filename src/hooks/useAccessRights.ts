import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile } from "./useAuth";

export interface AccessRights {
  recipes: boolean;
  sport: boolean;
  messaging: boolean;
  aiUnlimited: boolean;
  nutritionPrograms: boolean;
}

const PLAN_RIGHTS: Record<Profile["plan"], AccessRights> = {
  basic: {
    recipes: true,
    sport: false,
    messaging: false,
    aiUnlimited: false,
    nutritionPrograms: false,
  },
  premium: {
    recipes: true,
    sport: true,
    messaging: true,
    aiUnlimited: true,
    nutritionPrograms: false,
  },
  visio: {
    recipes: true,
    sport: true,
    messaging: true,
    aiUnlimited: true,
    nutritionPrograms: true,
  },
  patient: {
    recipes: true,
    sport: true,
    messaging: true,
    aiUnlimited: true,
    nutritionPrograms: true,
  },
};

const PRO_RIGHTS: AccessRights = {
  recipes: true,
  sport: true,
  messaging: true,
  aiUnlimited: true,
  nutritionPrograms: true,
};

export function useAccessRights() {
  const { user, profile, loading: authLoading } = useAuth();
  const [rights, setRights] = useState<AccessRights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile) {
      setRights(null);
      setLoading(false);
      return;
    }

    if (profile.role === "pro") {
      setRights(PRO_RIGHTS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const base = { ...PLAN_RIGHTS[profile.plan] };

      const { data, error } = await supabase
        .from("subscriber_overrides")
        .select("feature_key, enabled")
        .eq("user_id", user.id);

      if (!cancelled) {
        if (error) {
          console.error("[useAccessRights] overrides error", error);
        } else if (data) {
          for (const row of data as { feature_key: string; enabled: boolean }[]) {
            if (row.feature_key in base) {
              (base as Record<string, boolean>)[row.feature_key] = row.enabled;
            }
          }
        }
        setRights(base);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile, authLoading]);

  return { rights, loading: loading || authLoading };
}
