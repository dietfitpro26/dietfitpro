import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile } from "./useAuth";

export interface AccessRights {
  plan_label: "basic" | "premium" | "patient";
  access_recipes: boolean;
  access_sport_programs: boolean;
  access_nutrition_programs: boolean;
  access_messaging: boolean;
  access_visio: boolean;
  access_ai_coach: boolean;
  access_premium_content: boolean;
  sport_session_limit: number | null;
}

type AccessKey =
  | "access_recipes"
  | "access_sport_programs"
  | "access_nutrition_programs"
  | "access_messaging"
  | "access_visio"
  | "access_ai_coach"
  | "access_premium_content";

type OverrideRow = {
  feature_key: string | null;
  enabled: boolean | null;
  access_recipes?: boolean | null;
  access_sport_programs?: boolean | null;
  access_nutrition_programs?: boolean | null;
  access_messaging?: boolean | null;
  access_visio?: boolean | null;
  access_premium_content?: boolean | null;
  access_ai_coach?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

type FreshProfileRow = {
  role: Profile["role"] | null;
  plan: Profile["plan"] | null;
};

const ACCESS_KEYS: AccessKey[] = [
  "access_recipes",
  "access_sport_programs",
  "access_nutrition_programs",
  "access_messaging",
  "access_visio",
  "access_ai_coach",
  "access_premium_content",
];

const BASIC_RIGHTS: AccessRights = {
  plan_label: "basic",
  access_recipes: false,
  access_sport_programs: true,
  access_nutrition_programs: false,
  access_messaging: false,
  access_visio: false,
  access_ai_coach: false,
  access_premium_content: false,
  sport_session_limit: 3,
};

const PREMIUM_RIGHTS: AccessRights = {
  plan_label: "premium",
  access_recipes: true,
  access_sport_programs: true,
  access_nutrition_programs: true,
  access_messaging: true,
  access_visio: false,
  access_ai_coach: true,
  access_premium_content: true,
  sport_session_limit: null,
};

const PATIENT_RIGHTS: AccessRights = {
  plan_label: "patient",
  access_recipes: true,
  access_sport_programs: true,
  access_nutrition_programs: true,
  access_messaging: true,
  access_visio: false,
  access_ai_coach: true,
  access_premium_content: true,
  sport_session_limit: null,
};

const PRO_RIGHTS: AccessRights = {
  plan_label: "patient",
  access_recipes: true,
  access_sport_programs: true,
  access_nutrition_programs: true,
  access_messaging: true,
  access_visio: true,
  access_ai_coach: true,
  access_premium_content: true,
  sport_session_limit: null,
};

function isAccessKey(value: string): value is AccessKey {
  return ACCESS_KEYS.includes(value as AccessKey);
}

function getBaseRights(role: Profile["role"], plan: Profile["plan"]): AccessRights {
  if (role === "patient") {
    return { ...PATIENT_RIGHTS };
  }

  if (role === "subscriber" && plan === "premium") {
    return { ...PREMIUM_RIGHTS };
  }

  return { ...BASIC_RIGHTS };
}

function applyBooleanOverride(
  base: AccessRights,
  key: AccessKey,
  value: boolean | null | undefined
) {
  if (typeof value === "boolean") {
    base[key] = value;
  }
}

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

    const loadRights = async () => {
      setLoading(true);

      let effectiveRole: Profile["role"] = profile.role;
      let effectivePlan: Profile["plan"] = profile.plan;

      const { data: freshProfile, error: freshProfileError } = await supabase
        .from("profiles")
        .select("role, plan")
        .eq("id", user.id)
        .maybeSingle();

      if (freshProfileError) {
        console.error("[useAccessRights] fresh profile error", freshProfileError);
      } else {
        const row = freshProfile as FreshProfileRow | null;
        if (row?.role) effectiveRole = row.role;
        if (row?.plan) effectivePlan = row.plan;
      }

      const base = getBaseRights(effectiveRole, effectivePlan);

      const { data: overrides, error: overridesError } = await supabase
        .from("subscriber_overrides")
        .select(`
          feature_key,
          enabled,
          access_recipes,
          access_sport_programs,
          access_nutrition_programs,
          access_messaging,
          access_visio,
          access_premium_content,
          access_ai_coach,
          metadata
        `)
        .eq("user_id", user.id);

      if (cancelled) return;

      if (overridesError) {
        console.error("[useAccessRights] overrides error", overridesError);
      } else if (overrides && overrides.length > 0) {
        for (const row of overrides as OverrideRow[]) {
          applyBooleanOverride(base, "access_recipes", row.access_recipes);
          applyBooleanOverride(base, "access_sport_programs", row.access_sport_programs);
          applyBooleanOverride(base, "access_nutrition_programs", row.access_nutrition_programs);
          applyBooleanOverride(base, "access_messaging", row.access_messaging);
          applyBooleanOverride(base, "access_visio", row.access_visio);
          applyBooleanOverride(base, "access_premium_content", row.access_premium_content);
          applyBooleanOverride(base, "access_ai_coach", row.access_ai_coach);

          if (row.feature_key && isAccessKey(row.feature_key)) {
            applyBooleanOverride(base, row.feature_key, row.enabled);
          }

          const sportLimit =
            row.metadata &&
            typeof row.metadata === "object" &&
            typeof row.metadata["sport_session_limit"] === "number"
              ? row.metadata["sport_session_limit"]
              : null;

          if (typeof sportLimit === "number") {
            base.sport_session_limit = sportLimit;
          }
        }
      }

      setRights(base);
      setLoading(false);
    };

    void loadRights();

    return () => {
      cancelled = true;
    };
  }, [user, profile, authLoading]);

  return { rights, loading: loading || authLoading };
}