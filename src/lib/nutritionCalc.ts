/**
 * src/lib/nutritionCalc.ts
 *
 * Moteur de calcul Nutrition DietFitPro.
 * - BMR (métabolisme de base) : formule de Black et al. (1996), adultes 18+ uniquement.
 * - TDEE (dépense énergétique totale) = BMR x coefficient d'activité.
 * - Calories cibles = TDEE + delta progressif selon l'objectif et l'ancienneté du programme.
 * - Macros = répartition en grammes selon l'objectif.
 * - Bonus grossesse/allaitement optionnel.
 *
 * IMPORTANT : pour les moins de 18 ans, ce moteur ne doit pas être utilisé.
 * Utiliser isMinor() en amont pour bloquer l'affichage du calcul et rediriger
 * vers un message de prise de contact manuelle (formule Schofield prévue en V2).
 */

export type Gender = 'homme' | 'femme';
export type ActivityLevel = 'sedentaire' | 'actif' | 'tres_actif';
export type NutritionGoal = 'perte_de_poids' | 'prise_de_masse' | 'maintien' | 'equilibre';

export interface NutritionProfileInput {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  /** Date de début du programme (ISO yyyy-mm-dd). Sert à calculer le palier du delta calorique. */
  programStartDate: string;
  /** Optionnel : bonus calorique grossesse/allaitement (non obligatoire). */
  isPregnantOrBreastfeeding?: boolean;
}

export interface NutritionCalcResult {
  bmrKcal: number;
  tdeeKcal: number;
  targetKcal: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  programMonth: 1 | 2 | 3;
  pregnancyBonusKcal: number;
  warnings: string[];
}

const ACTIVITY_COEFFICIENTS: Record<ActivityLevel, number> = {
  sedentaire: 1.4,
  actif: 1.6,
  tres_actif: 1.9,
};

/** Ratios macro par objectif : [min, max] en % des calories totales. On prend le milieu de la fourchette. */
const MACRO_RANGES: Record<NutritionGoal, { protein: [number, number]; carbs: [number, number]; fat: [number, number] }> = {
  equilibre: { protein: [11, 15], carbs: [45, 55], fat: [20, 30] },
  perte_de_poids: { protein: [15, 20], carbs: [40, 50], fat: [10, 30] },
  prise_de_masse: { protein: [20, 30], carbs: [50, 55], fat: [10, 30] },
  maintien: { protein: [11, 15], carbs: [45, 55], fat: [20, 30] },
};

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

const PREGNANCY_BONUS_KCAL = 300;
const BREASTFEEDING_BONUS_KCAL = 500;

/** Un utilisateur est mineur si son âge est strictement inférieur à 18 ans. */
export function isMinor(age: number): boolean {
  return age < 18;
}

/**
 * Calcule le métabolisme de base (BMR) avec la formule de Black et al. (1996).
 * Formule en MJ/jour, convertie en kcal/jour (1 MJ = 1000/4.1855 kcal).
 * Valide uniquement pour les adultes (18 ans et plus).
 */
export function calculateBMR(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  const heightM = heightCm / 100;
  const coefficient = gender === 'homme' ? 1.083 : 0.963;
  const mjPerDay = coefficient * Math.pow(weightKg, 0.48) * Math.pow(heightM, 0.5) * Math.pow(age, -0.13);
  const kcalPerDay = (mjPerDay * 1000) / 4.1855;
  return Math.round(kcalPerDay);
}

/** Calcule la dépense énergétique totale (TDEE) = BMR x coefficient d'activité. */
export function calculateTDEE(bmrKcal: number, activityLevel: ActivityLevel): number {
  return Math.round(bmrKcal * ACTIVITY_COEFFICIENTS[activityLevel]);
}

/**
 * Détermine le palier du programme (mois 1, 2, ou 3+) à partir de la date de début.
 * Mois 1 : 0-29 jours, Mois 2 : 30-59 jours, Mois 3+ : 60 jours et plus.
 */
export function getProgramMonth(programStartDate: string): 1 | 2 | 3 {
  const start = new Date(programStartDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return 1;
  if (diffDays < 60) return 2;
  return 3;
}

/**
 * Calcule le delta calorique à appliquer au TDEE selon l'objectif et le palier du programme.
 * Perte de poids : -300 (mois 1) / -500 (mois 2) / -750 (mois 3+)
 * Prise de masse : +300 (mois 1) / +500 (mois 2) / +750 (mois 3+)
 * Maintien / équilibre : 0
 */
export function getCalorieDelta(goal: NutritionGoal, programMonth: 1 | 2 | 3): number {
  const steps: Record<1 | 2 | 3, number> = { 1: 300, 2: 500, 3: 750 };
  if (goal === 'perte_de_poids') return -steps[programMonth];
  if (goal === 'prise_de_masse') return steps[programMonth];
  return 0;
}

/** Calcule la répartition des macros en grammes à partir des calories cibles et de l'objectif. */
export function calculateMacros(targetKcal: number, goal: NutritionGoal) {
  const ranges = MACRO_RANGES[goal];
  const proteinPct = (ranges.protein[0] + ranges.protein[1]) / 2;
  const carbsPct = (ranges.carbs[0] + ranges.carbs[1]) / 2;
  const fatPct = (ranges.fat[0] + ranges.fat[1]) / 2;

  const proteinKcal = (targetKcal * proteinPct) / 100;
  const carbsKcal = (targetKcal * carbsPct) / 100;
  const fatKcal = (targetKcal * fatPct) / 100;

  return {
    targetProteinG: Math.round(proteinKcal / KCAL_PER_G_PROTEIN),
    targetCarbsG: Math.round(carbsKcal / KCAL_PER_G_CARBS),
    targetFatG: Math.round(fatKcal / KCAL_PER_G_FAT),
    proteinPct: Math.round(proteinPct),
    carbsPct: Math.round(carbsPct),
    fatPct: Math.round(fatPct),
  };
}

/**
 * Fonction principale : calcule BMR, TDEE, calories cibles et macros à partir du profil complet.
 * Retourne aussi des warnings (ex: profil mineur détecté) pour affichage côté UI.
 */
export function calculateNutritionProfile(input: NutritionProfileInput): NutritionCalcResult {
  const warnings: string[] = [];

  if (isMinor(input.age)) {
    warnings.push(
      "Ce profil concerne un mineur (moins de 18 ans). Le calcul automatique Black et al. ne s'applique pas. Merci de contacter directement votre professionnel pour un accompagnement personnalisé."
    );
    return {
      bmrKcal: 0,
      tdeeKcal: 0,
      targetKcal: 0,
      targetProteinG: 0,
      targetCarbsG: 0,
      targetFatG: 0,
      proteinPct: 0,
      carbsPct: 0,
      fatPct: 0,
      programMonth: 1,
      pregnancyBonusKcal: 0,
      warnings,
    };
  }

  const bmrKcal = calculateBMR(input.weightKg, input.heightCm, input.age, input.gender);
  const tdeeKcal = calculateTDEE(bmrKcal, input.activityLevel);
  const programMonth = getProgramMonth(input.programStartDate);
  const delta = getCalorieDelta(input.goal, programMonth);

  let pregnancyBonusKcal = 0;
  if (input.gender === 'femme' && input.isPregnantOrBreastfeeding) {
    pregnancyBonusKcal = PREGNANCY_BONUS_KCAL;
    warnings.push(
      `Bonus grossesse/allaitement appliqué : +${pregnancyBonusKcal} kcal/jour. Ce bonus est indicatif, à ajuster selon le suivi médical.`
    );
  }

  const targetKcal = Math.max(1200, tdeeKcal + delta + pregnancyBonusKcal);
  const macros = calculateMacros(targetKcal, input.goal);

  return {
    bmrKcal,
    tdeeKcal,
    targetKcal,
    ...macros,
    programMonth,
    pregnancyBonusKcal,
    warnings,
  };
}