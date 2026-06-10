import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile } from "./useAuth";

export interface AccessRights {
  access_recipes: boolean;
  access_sport_programs: boolean;
  access_nutrition_programs: boolean;
  access_messaging: boolean;
  access_visio: boolean;
  access_premium_content: boolean;
}

const PLAN_RIGHTS: Record<Profile["plan"], AccessRights> = {
  basic: {
    access_recipes:            true,
    access_sport_programs:     false,
    access_nutrition_programs: false,
    access_messaging:          false,
    access_visio:              false,
    access_premium_content:    false,
  },
  premium: {
    access_recipes:            true,
    access_sport_programs:     true,
    access_nutrition_programs: true,
    access_messaging:          true,
    access_visio:              false,
    access_premium_content:    true,
  },
  visio: {
    access_recipes:            true,
    access_sport_programs:     true,
    access_nutrition_programs: true,
    access_messaging:          true,
    access_visio:              true,
    access_premium_content:    true,
  },
  patient: {
    access_recipes:            true,
    access_sport_programs:     true,
    access_nutrition_programs: true,
    access_messaging:          true,
    access_visio:              true,
    access_premium_content:    true,
  },
};

const PRO_RIGHTS: AccessRights = {
  access_recipes:            true,
  access_sport_programs:     true,
  access_nutrition_programs: true,
  access_messaging:          true,
  access_visio:              true,
  access_premium_content:    true,
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
      const base: AccessRights = { ...PLAN_RIGHTS[profile.plan] };

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

    return () => { cancelled = true; };
  }, [user, profile, authLoading]);

  return { rights, loading: loading || authLoading };
}