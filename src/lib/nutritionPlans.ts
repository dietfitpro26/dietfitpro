import type { NutritionGoal } from "@/lib/nutritionCalc";

export type SlotId = "matin" | "midi" | "collation" | "soir";

export const SLOT_ORDER: SlotId[] = ["matin", "midi", "collation", "soir"];

export const SLOT_LABEL: Record<SlotId, string> = {
  matin: "🌅 Petit-déjeuner",
  midi: "☀️ Déjeuner",
  collation: "🍎 Collation",
  soir: "🌙 Dîner",
};

export type LineKind = "protein" | "starch" | "bread" | "fat" | "veg" | "fruit" | "free";

export interface PlanLine {
  kind: LineKind;
  label: string;
  /** Équivalences / idées, affichées sous la ligne. */
  options?: string;
  /** Quantité fixe (prioritaire sur le calcul). */
  fixed?: string;
  /** Protéines pour 100 g (par défaut 22 : viande, poisson). */
  proteinPer100g?: number;
  /** Glucides pour 100 g de produit cru (par défaut 75 : riz, pâtes). */
  carbsPer100gRaw?: number;
  /** Part des glucides du repas apportée par cette ligne (par défaut 0,7). */
  share?: number;
}

export interface NutritionPlan {
  id: string;
  tier: "basic" | "premium";
  name: string;
  tagline: string;
  /** Si défini, l'objectif du plan remplace l'objectif du profil (plans Basic). */
  goal: NutritionGoal | null;
  /** Part des calories du jour pour chaque repas (total = 1). */
  split: Record<SlotId, number>;
  meals: Record<SlotId, PlanLine[]>;
  tips: string[];
}

export interface Targets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ComputedLine {
  label: string;
  quantity: string | null;
  options?: string;
}

export interface ComputedMeal {
  slot: SlotId;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  lines: ComputedLine[];
}

/* ───────────── Lignes réutilisables ───────────── */

const veg = (options = "Crus ou cuits, à volonté"): PlanLine => ({
  kind: "veg",
  label: "Légumes",
  options,
});

const fruit = (fixed = "1 fruit de saison"): PlanLine => ({
  kind: "fruit",
  label: "Fruit",
  fixed,
});

const fat = (options = "Huile d'olive ou de colza, jamais chauffée"): PlanLine => ({
  kind: "fat",
  label: "Matière grasse",
  options,
});

const breakfastFat: PlanLine = {
  kind: "free",
  label: "Matière grasse",
  fixed: "10 g de beurre OU 10 g de confiture",
};

const protein = (label: string, options: string, proteinPer100g = 22): PlanLine => ({
  kind: "protein",
  label,
  options,
  proteinPer100g,
});

const starch = (label: string, options: string, share = 0.7, carbsPer100gRaw = 75): PlanLine => ({
  kind: "starch",
  label,
  options,
  share,
  carbsPer100gRaw,
});

const bread = (label = "Pain aux céréales", options?: string): PlanLine => ({
  kind: "bread",
  label,
  options,
});

const dairy = (label: string, fixed: string, options?: string): PlanLine => ({
  kind: "free",
  label,
  fixed,
  options,
});

const CLASSIC_PROTEIN = protein(
  "Protéines",
  "Poulet, dinde, poisson, œufs (2 œufs ≈ 100 g), viande maigre",
);

const CLASSIC_STARCH = starch("Féculent", "Riz, pâtes, quinoa, semoule, lentilles (poids cru)");

function makePlan(
  base: Omit<NutritionPlan, "meals"> & { meals?: Partial<Record<SlotId, PlanLine[]>> },
): NutritionPlan {
  const defaults: Record<SlotId, PlanLine[]> = {
    matin: [
      dairy("Laitage", "1 pot (125 g)", "Yaourt nature ou fromage blanc"),
      bread(),
      breakfastFat,
      fruit(),
    ],
    midi: [CLASSIC_PROTEIN, CLASSIC_STARCH, veg(), fat(), fruit()],
    collation: [fruit(), dairy("Au choix", "1 portion", "Laitage nature ou une poignée d'amandes (15 g)")],
    soir: [
      CLASSIC_PROTEIN,
      starch("Féculent", "Riz, pâtes, quinoa, semoule, lentilles (poids cru)", 0.5),
      veg(),
      fat(),
      dairy("Dessert", "1 yaourt nature"),
    ],
  };

  return { ...base, meals: { ...defaults, ...(base.meals ?? {}) } };
}

/* ───────────── Plans Basic (3) ───────────── */

export const BASIC_PLANS: NutritionPlan[] = [
  makePlan({
    id: "basic_perte",
    tier: "basic",
    name: "Perte de poids",
    tagline: "Déficit progressif, repas simples et rassasiants.",
    goal: "perte_de_poids",
    split: { matin: 0.27, midi: 0.35, collation: 0.08, soir: 0.3 },
    tips: [
      "Buvez au moins 1,5 litre d'eau par jour.",
      "Privilégiez les légumes pour rassasier.",
      "Évitez de sauter un repas : la collation est facultative.",
    ],
  }),
  makePlan({
    id: "basic_equilibre",
    tier: "basic",
    name: "Équilibre",
    tagline: "Maintenir son poids avec une alimentation variée.",
    goal: "equilibre",
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    tips: [
      "Variez les sources de protéines et de féculents.",
      "Mangez à heures régulières.",
      "Cuisinez des produits bruts dès que possible.",
    ],
  }),
  makePlan({
    id: "basic_masse",
    tier: "basic",
    name: "Prise de masse",
    tagline: "Léger surplus calorique pour gagner du muscle.",
    goal: "prise_de_masse",
    split: { matin: 0.25, midi: 0.3, collation: 0.15, soir: 0.3 },
    tips: [
      "Ne sautez pas la collation : elle aide à atteindre vos besoins.",
      "Associez le plan à un entraînement de renforcement régulier.",
      "Pesez-vous une fois par semaine, dans les mêmes conditions.",
    ],
  }),
];

/* ───────────── Plans Premium (9 styles) ───────────── */

export const PREMIUM_PLANS: NutritionPlan[] = [
  makePlan({
    id: "premium_classique",
    tier: "premium",
    name: "Classique équilibré",
    tagline: "La base : protéines, féculents, légumes à chaque repas.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    tips: ["Un plan simple à suivre toute l'année.", "Variez les féculents d'un repas à l'autre."],
  }),
  makePlan({
    id: "premium_proteines",
    tier: "premium",
    name: "Riche en protéines",
    tagline: "Plus de satiété et de maintien musculaire.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    meals: {
      matin: [
        dairy("Protéines", "2 œufs OU 150 g de fromage blanc 0 %", "Ou skyr nature"),
        bread(),
        breakfastFat,
        fruit(),
      ],
      collation: [
        dairy("Protéines", "1 portion", "Skyr ou fromage blanc 0 %, ou une tranche de jambon blanc"),
        fruit(),
      ],
    },
    tips: ["Répartissez les protéines sur tous les repas.", "Pensez à bien vous hydrater."],
  }),
  makePlan({
    id: "premium_mediterraneen",
    tier: "premium",
    name: "Méditerranéen",
    tagline: "Huile d'olive, poisson, légumes et légumineuses.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    meals: {
      midi: [
        protein("Protéines", "Poisson 2 à 3 fois par semaine, volaille, œufs, pois chiches"),
        starch("Féculent", "Pois chiches, lentilles, boulgour, riz complet, pâtes complètes (poids cru)"),
        veg("Légumes de saison, crus ou cuits, à volonté"),
        fat("Huile d'olive extra vierge, crue"),
        fruit(),
      ],
      collation: [fruit(), dairy("Oléagineux", "15 g", "Amandes, noix ou noisettes natures")],
    },
    tips: ["Privilégiez l'huile d'olive crue.", "Limitez la viande rouge à 1 ou 2 fois par semaine."],
  }),
  makePlan({
    id: "premium_vegetarien",
    tier: "premium",
    name: "Végétarien",
    tagline: "Sans viande ni poisson, avec des protéines variées.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    meals: {
      midi: [
        protein("Protéines végétales", "Tofu, tempeh, œufs, légumineuses, seitan", 12),
        CLASSIC_STARCH,
        veg(),
        fat(),
        fruit(),
      ],
      soir: [
        protein("Protéines végétales", "Tofu, tempeh, œufs, légumineuses, fromage blanc", 12),
        starch("Féculent", "Riz, pâtes, quinoa, semoule (poids cru)", 0.5),
        veg(),
        fat(),
        dairy("Dessert", "1 yaourt nature"),
      ],
    },
    tips: [
      "Associez céréales et légumineuses pour compléter les protéines.",
      "Pensez à la vitamine B12 : parlez-en à votre professionnel.",
    ],
  }),
  makePlan({
    id: "premium_sans_gluten",
    tier: "premium",
    name: "Sans gluten",
    tagline: "Sans blé, orge ni seigle.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    meals: {
      matin: [
        dairy("Laitage", "1 pot (125 g)", "Yaourt nature ou fromage blanc"),
        bread("Pain sans gluten", "Ou galettes de riz, flocons de sarrasin ou de maïs"),
        breakfastFat,
        fruit(),
      ],
      midi: [
        CLASSIC_PROTEIN,
        starch("Féculent sans gluten", "Riz, quinoa, sarrasin, maïs, millet (poids cru)"),
        veg(),
        fat(),
        fruit(),
      ],
      soir: [
        CLASSIC_PROTEIN,
        starch("Féculent sans gluten", "Riz, quinoa, sarrasin, maïs, millet (poids cru)", 0.5),
        veg(),
        fat(),
        dairy("Dessert", "1 yaourt nature"),
      ],
    },
    tips: [
      "Vérifiez les étiquettes des produits transformés.",
      "En cas de maladie cœliaque, suivez les consignes de votre professionnel.",
    ],
  }),
  makePlan({
    id: "premium_sans_lactose",
    tier: "premium",
    name: "Sans lactose",
    tagline: "Sans lait ni produits laitiers classiques.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    meals: {
      matin: [
        dairy("Alternative végétale", "1 pot (125 g)", "Yaourt au soja, à l'avoine ou sans lactose"),
        bread(),
        { kind: "free", label: "Matière grasse", fixed: "10 g de margarine ou de confiture" },
        fruit(),
      ],
      collation: [fruit(), dairy("Au choix", "15 g", "Oléagineux nature ou dessert végétal")],
      soir: [
        CLASSIC_PROTEIN,
        starch("Féculent", "Riz, pâtes, quinoa, semoule, lentilles (poids cru)", 0.5),
        veg(),
        fat(),
        dairy("Dessert", "1 yaourt végétal"),
      ],
    },
    tips: ["Pensez au calcium : eaux minérales riches en calcium, légumes verts, amandes."],
  }),
  makePlan({
    id: "premium_rapide",
    tier: "premium",
    name: "Rapide, peu de cuisine",
    tagline: "Des repas prêts en 15 minutes.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    meals: {
      midi: [
        protein("Protéines express", "Œufs, thon ou sardines au naturel, jambon blanc, poulet déjà cuit"),
        starch("Féculent express", "Riz ou quinoa micro-ondable, pâtes, pain complet (poids cru)"),
        veg("Légumes surgelés nature, salade en sachet, tomates cerises"),
        fat(),
        fruit(),
      ],
      soir: [
        protein("Protéines express", "Omelette, poisson pané maison, steak haché 5 %, tofu"),
        starch("Féculent express", "Riz ou pâtes (poids cru), pommes de terre au micro-ondes", 0.5),
        veg("Légumes surgelés nature, soupe sans féculent"),
        fat(),
        dairy("Dessert", "1 yaourt nature"),
      ],
    },
    tips: ["Préparez vos féculents pour 2 jours.", "Gardez des légumes surgelés nature en réserve."],
  }),
  makePlan({
    id: "premium_budget",
    tier: "premium",
    name: "Petit budget",
    tagline: "Bien manger sans dépenser trop.",
    goal: null,
    split: { matin: 0.25, midi: 0.35, collation: 0.1, soir: 0.3 },
    meals: {
      midi: [
        protein("Protéines économiques", "Œufs, cuisses de poulet, thon en conserve, lentilles, pois chiches"),
        starch("Féculent", "Riz, pâtes, semoule, lentilles, pommes de terre (poids cru)"),
        veg("Légumes de saison ou surgelés nature"),
        fat("Huile de colza, jamais chauffée"),
        fruit("1 fruit de saison (pomme, banane, orange…)"),
      ],
      collation: [fruit(), dairy("Au choix", "1 portion", "Fromage blanc nature ou 2 biscottes")],
    },
    tips: ["Achetez de saison et en vrac.", "Les légumineuses sèches sont très économiques."],
  }),
  makePlan({
    id: "premium_sportif",
    tier: "premium",
    name: "Sportif",
    tagline: "Plus de glucides autour de l'entraînement.",
    goal: null,
    split: { matin: 0.25, midi: 0.33, collation: 0.12, soir: 0.3 },
    meals: {
      midi: [
        CLASSIC_PROTEIN,
        starch("Féculent", "Riz, pâtes, quinoa, patate douce (poids cru)", 0.8),
        veg(),
        fat(),
        fruit(),
      ],
      collation: [
        fruit("1 banane ou 2 fruits secs"),
        dairy("Avant ou après l'entraînement", "1 portion", "Compote, fromage blanc, barre de céréales maison"),
      ],
    },
    tips: [
      "Mangez un repas riche en féculents 2 à 3 heures avant une séance longue.",
      "Hydratez-vous avant, pendant et après l'effort.",
    ],
  }),
];

export const ALL_PLANS: NutritionPlan[] = [...BASIC_PLANS, ...PREMIUM_PLANS];

export function getPlan(id: string | null | undefined): NutritionPlan | null {
  if (!id) return null;
  return ALL_PLANS.find((p) => p.id === id) ?? null;
}

/** Plan Basic proposé par défaut selon l'objectif du profil. */
export function defaultBasicPlanId(goal: NutritionGoal | null): string {
  if (goal === "perte_de_poids") return "basic_perte";
  if (goal === "prise_de_masse") return "basic_masse";
  return "basic_equilibre";
}

/* ───────────── Calcul des quantités ───────────── */

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function computePlan(plan: NutritionPlan, targets: Targets): ComputedMeal[] {
  return SLOT_ORDER.map((slot) => {
    const part = plan.split[slot] ?? 0;
    const kcal = Math.round(targets.kcal * part);
    const proteinG = Math.round(targets.proteinG * part);
    const carbsG = Math.round(targets.carbsG * part);
    const fatG = Math.round(targets.fatG * part);

    const lines: ComputedLine[] = plan.meals[slot].map((line) => {
      let quantity: string | null = line.fixed ?? null;

      if (!quantity) {
        if (line.kind === "protein") {
          const per100 = line.proteinPer100g ?? 22;
          const grams = Math.max(50, roundTo((proteinG * 0.75) / (per100 / 100), 5));
          quantity = `≈ ${grams} g (poids cuit)`;
        } else if (line.kind === "starch") {
          const per100 = line.carbsPer100gRaw ?? 75;
          const carbs = carbsG * (line.share ?? 0.7);
          const raw = Math.max(20, roundTo(carbs / (per100 / 100), 5));
          quantity = `${raw} g cru (${raw * 2} g cuit)`;
        } else if (line.kind === "bread") {
          const grams = Math.max(20, roundTo((carbsG * 0.55) / 0.5, 5));
          quantity = `${grams} g`;
        } else if (line.kind === "fat") {
          const grams = Math.max(5, roundTo(fatG * 0.6, 5));
          quantity = `${grams} g`;
        } else if (line.kind === "veg") {
          quantity = "À volonté";
        }
      }

      return { label: line.label, quantity, options: line.options };
    });

    return { slot, kcal, proteinG, carbsG, fatG, lines };
  });
}