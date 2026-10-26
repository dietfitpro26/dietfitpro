import type {
  ActivityLevel,
  Gender,
} from "@/lib/nutritionCalc";

export const PENDING_PROFILE_KEY = "dietfitpro_pending_profile";
export const PENDING_PLAN_KEY = "dietfitpro_pending_plan";

const STORAGE_KEY = "dietfitpro_pending_registration_v1";

export interface PendingProfileData {
  age: number;
  gender: Gender | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  goal: string;
  activity_level: ActivityLevel | null;
  is_pregnant_or_breastfeeding: boolean;
  target_weight_kg: number | null;
  program_start_date: string;
  bmr_kcal: number | null;
  tdee_kcal: number | null;
  daily_kcal_target: number | null;
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
  profile_complete: boolean;
}

interface PendingRegistration {
  version: 1;
  userId: string;
  profile: PendingProfileData | null;
  plan: "basic" | "premium" | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseProfile(value: unknown): PendingProfileData | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.age !== "number" ||
    !Number.isInteger(value.age) ||
    value.age < 10 ||
    value.age > 120
  ) {
    return null;
  }

  if (
    value.gender !== null &&
    value.gender !== "homme" &&
    value.gender !== "femme"
  ) {
    return null;
  }

  if (
    value.activity_level !== null &&
    value.activity_level !== "sedentaire" &&
    value.activity_level !== "actif" &&
    value.activity_level !== "tres_actif"
  ) {
    return null;
  }

  if (
    typeof value.goal !== "string" ||
    !["perte_de_poids", "prise_de_masse", "maintien", "equilibre"].includes(value.goal)
  ) {
    return null;
  }

  if (
    typeof value.program_start_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.program_start_date) ||
    typeof value.is_pregnant_or_breastfeeding !== "boolean" ||
    typeof value.profile_complete !== "boolean"
  ) {
    return null;
  }

  const numericKeys = [
    "weight_kg",
    "height_cm",
    "bmi",
    "target_weight_kg",
    "bmr_kcal",
    "tdee_kcal",
    "daily_kcal_target",
    "target_kcal",
    "target_protein_g",
    "target_carbs_g",
    "target_fat_g",
  ] as const;

  if (numericKeys.some((key) => !isNullableNumber(value[key]))) {
    return null;
  }

  // Liste explicite : aucun rôle, plan ou identifiant Stripe
  // provenant du stockage local n'est transmis à Supabase.
  return {
    age: value.age,
    gender: value.gender,
    weight_kg: value.weight_kg as number | null,
    height_cm: value.height_cm as number | null,
    bmi: value.bmi as number | null,
    goal: value.goal,
    activity_level: value.activity_level,
    is_pregnant_or_breastfeeding: value.is_pregnant_or_breastfeeding,
    target_weight_kg: value.target_weight_kg as number | null,
    program_start_date: value.program_start_date,
    bmr_kcal: value.bmr_kcal as number | null,
    tdee_kcal: value.tdee_kcal as number | null,
    daily_kcal_target: value.daily_kcal_target as number | null,
    target_kcal: value.target_kcal as number | null,
    target_protein_g: value.target_protein_g as number | null,
    target_carbs_g: value.target_carbs_g as number | null,
    target_fat_g: value.target_fat_g as number | null,
    profile_complete: value.profile_complete,
  };
}

function removeLegacyData() {
  window.localStorage.removeItem(PENDING_PROFILE_KEY);
  window.localStorage.removeItem(PENDING_PLAN_KEY);
}

function readPendingRegistration(): PendingRegistration | null {
  if (typeof window === "undefined") return null;

  try {
    removeLegacyData();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      typeof parsed.userId !== "string" ||
      !parsed.userId
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const profile =
      parsed.profile === null ? null : parseProfile(parsed.profile);

    if (parsed.profile !== null && profile === null) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (
      parsed.plan !== null &&
      parsed.plan !== "basic" &&
      parsed.plan !== "premium"
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      version: 1,
      userId: parsed.userId,
      profile,
      plan: parsed.plan,
    };
  } catch (error) {
    console.error("[pendingRegistration] Lecture impossible :", error);
    return null;
  }
}

function writePendingRegistration(value: PendingRegistration) {
  if (value.profile === null && value.plan === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function savePendingRegistration(
  userId: string,
  profile: PendingProfileData,
  plan: "basic" | "premium",
): boolean {
  if (typeof window === "undefined") return false;

  const safeProfile = parseProfile(profile);
  if (!userId || !safeProfile) return false;

  try {
    removeLegacyData();

    writePendingRegistration({
      version: 1,
      userId,
      profile: safeProfile,
      plan,
    });

    return true;
  } catch (error) {
    console.error("[pendingRegistration] Enregistrement impossible :", error);
    return false;
  }
}

export function getPendingRegistration(
  userId: string,
): PendingRegistration | null {
  const pending = readPendingRegistration();

  return pending?.userId === userId ? pending : null;
}

export function clearPendingProfile(userId: string): boolean {
  const pending = getPendingRegistration(userId);
  if (!pending) return true;

  try {
    writePendingRegistration({ ...pending, profile: null });
    return true;
  } catch (error) {
    console.error("[pendingRegistration] Nettoyage du profil impossible :", error);
    return false;
  }
}

export function takePendingPlan(
  userId: string,
): "basic" | "premium" | null {
  const pending = getPendingRegistration(userId);
  if (!pending?.plan) return null;

  try {
    // Retirée avant Stripe pour éviter une boucle après annulation.
    writePendingRegistration({ ...pending, plan: null });
    return pending.plan;
  } catch (error) {
    console.error("[pendingRegistration] Nettoyage de la formule impossible :", error);
    return null;
  }
}