export type QuestionType = "text" | "textarea" | "number" | "single" | "multi" | "scale";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  unit?: string;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  femaleOnly?: boolean;
}

export interface Section {
  id: string;
  title: string;
  emoji: string;
  intro: string;
  questions: Question[];
}

export type AnswerValue = string | number | string[] | null;
export type AnamneseAnswers = Record<string, AnswerValue>;

/** Une option qui commence par "Aucun" / "Aucune" annule les autres choix. */
export function isExclusiveOption(option: string): boolean {
  return option.startsWith("Aucun");
}

export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

const FREQUENCE = ["Jamais", "Rarement", "Parfois", "Souvent"];

export const ANAMNESE_SECTIONS: Section[] = [
  {
    id: "objectif",
    title: "Votre objectif",
    emoji: "🎯",
    intro: "Pour comprendre ce que vous attendez et d'où vous partez.",
    questions: [
      {
        id: "main_goal",
        label: "Quel est votre objectif principal ?",
        type: "single",
        options: [
          "Perdre du poids",
          "Prendre de la masse",
          "Me rééquilibrer",
          "Gérer un problème de santé",
          "Améliorer mes performances sportives",
          "Autre",
        ],
      },
      {
        id: "goal_deadline",
        label: "Dans quel délai souhaitez-vous l'atteindre ?",
        type: "single",
        options: ["Moins d'1 mois", "1 à 3 mois", "3 à 6 mois", "Plus de 6 mois", "Pas de date précise"],
      },
      { id: "weight_max", label: "Poids maximum de votre vie adulte", type: "number", unit: "kg" },
      { id: "weight_min", label: "Poids minimum de votre vie adulte", type: "number", unit: "kg" },
      {
        id: "weight_history",
        label: "Comment a évolué votre poids ?",
        type: "single",
        options: [
          "Stable depuis des années",
          "Prise progressive",
          "Effet yoyo",
          "Perte récente",
          "Variations liées à des événements de vie",
        ],
      },
      {
        id: "previous_diets",
        label: "Quels régimes ou méthodes avez-vous déjà essayés ?",
        type: "multi",
        options: [
          "Aucun régime",
          "Régime hypocalorique",
          "Jeûne intermittent",
          "Régime hyperprotéiné",
          "Régime pauvre en glucides",
          "Programmes commerciaux",
          "Suivi avec un diététicien",
          "Autre",
        ],
      },
      {
        id: "previous_diets_notes",
        label: "Qu'est-ce qui a fonctionné ou non ?",
        type: "textarea",
        placeholder: "En quelques mots…",
      },
      {
        id: "obstacles",
        label: "Quels sont vos principaux obstacles ?",
        type: "multi",
        options: [
          "Manque de temps",
          "Grignotage",
          "Stress",
          "Fatigue",
          "Budget",
          "Vie sociale / repas à l'extérieur",
          "Manque de motivation",
          "Je ne sais pas quoi manger",
          "Autre",
        ],
      },
      {
        id: "motivation",
        label: "Votre niveau de motivation aujourd'hui",
        type: "scale",
        min: 0,
        max: 10,
        hint: "0 = pas du tout motivé(e) · 10 = très motivé(e)",
      },
    ],
  },
  {
    id: "sante",
    title: "Votre santé",
    emoji: "🩺",
    intro: "Ces informations restent confidentielles et visibles uniquement par votre professionnel.",
    questions: [
      {
        id: "conditions",
        label: "Avez-vous (ou avez-vous eu) l'un de ces problèmes de santé ?",
        type: "multi",
        options: [
          "Aucun",
          "Diabète de type 1",
          "Diabète de type 2",
          "Hypertension",
          "Cholestérol élevé",
          "Triglycérides élevés",
          "Hypothyroïdie",
          "Hyperthyroïdie",
          "SOPK",
          "Endométriose",
          "Maladie cœliaque",
          "Syndrome de l'intestin irritable",
          "Reflux gastro-œsophagien",
          "Maladie rénale",
          "Maladie du foie",
          "Anémie",
          "Ostéoporose",
          "Dépression / anxiété",
          "Trouble du comportement alimentaire",
          "Apnée du sommeil",
          "Autre",
        ],
      },
      {
        id: "medications",
        label: "Traitements médicaux en cours",
        type: "textarea",
        placeholder: "Nom et dose si vous les connaissez. Écrivez « aucun » sinon.",
      },
      {
        id: "supplements",
        label: "Compléments alimentaires ou vitamines",
        type: "textarea",
        placeholder: "Lesquels et à quelle fréquence ?",
      },
      {
        id: "surgeries",
        label: "Chirurgies ou hospitalisations importantes",
        type: "textarea",
        placeholder: "Dont chirurgie de l'obésité si c'est le cas.",
      },
      {
        id: "family_history",
        label: "Antécédents dans votre famille proche",
        type: "multi",
        options: ["Aucun", "Diabète", "Maladie cardiovasculaire", "Obésité", "Cholestérol", "Cancer", "Autre"],
      },
      {
        id: "allergies",
        label: "Allergies ou intolérances alimentaires",
        type: "multi",
        options: [
          "Aucune",
          "Gluten",
          "Lactose",
          "Arachide",
          "Fruits à coque",
          "Œufs",
          "Poisson",
          "Crustacés",
          "Soja",
          "Autre",
        ],
      },
      {
        id: "allergies_other",
        label: "Précisions sur vos allergies ou intolérances",
        type: "text",
        placeholder: "Facultatif",
      },
      {
        id: "digestion",
        label: "Troubles digestifs fréquents",
        type: "multi",
        options: ["Aucun", "Ballonnements", "Constipation", "Diarrhées", "Reflux / brûlures", "Nausées"],
      },
      {
        id: "last_blood_test",
        label: "Dernière prise de sang",
        type: "single",
        options: ["Moins de 6 mois", "Entre 6 et 12 mois", "Plus d'un an", "Jamais"],
      },
      {
        id: "pregnancy_status",
        label: "Votre situation actuelle",
        type: "single",
        femaleOnly: true,
        options: ["Non concernée", "Enceinte", "Allaitement", "Projet de grossesse", "Ménopause"],
      },
      {
        id: "cycle",
        label: "Vos cycles menstruels",
        type: "single",
        femaleOnly: true,
        options: ["Réguliers", "Irréguliers", "Absents", "Sous contraception hormonale", "Je ne sais pas"],
      },
      {
        id: "smoking",
        label: "Tabac",
        type: "single",
        options: ["Non-fumeur", "Ancien fumeur", "Occasionnel", "Quotidien"],
      },
      {
        id: "alcohol",
        label: "Alcool",
        type: "single",
        options: ["Jamais", "Occasionnel", "1 à 3 fois par semaine", "Plus de 3 fois par semaine", "Tous les jours"],
      },
    ],
  },
  {
    id: "alimentation",
    title: "Votre alimentation",
    emoji: "🍽️",
    intro: "Pour savoir comment vous mangez au quotidien.",
    questions: [
      {
        id: "diet_type",
        label: "Votre type d'alimentation",
        type: "multi",
        options: [
          "Omnivore",
          "Végétarien",
          "Végétalien",
          "Pescétarien",
          "Halal",
          "Casher",
          "Sans gluten",
          "Sans lactose",
          "Autre",
        ],
      },
      {
        id: "meals_per_day",
        label: "Nombre de repas (hors collations) par jour",
        type: "single",
        options: ["1", "2", "3", "4", "5 ou plus"],
      },
      {
        id: "meal_times",
        label: "Vos horaires de repas habituels",
        type: "text",
        placeholder: "Ex : 8h, 13h, 16h, 20h30",
      },
      {
        id: "breakfast",
        label: "Prenez-vous un petit-déjeuner ?",
        type: "single",
        options: ["Tous les jours", "Souvent", "Rarement", "Jamais"],
      },
      {
        id: "cooking",
        label: "Cuisinez-vous vous-même ?",
        type: "single",
        options: ["Tous les jours", "Souvent", "Rarement", "Jamais"],
      },
      {
        id: "eat_out",
        label: "Repas pris à l'extérieur (restaurant, cantine, plats préparés)",
        type: "single",
        options: ["Jamais", "1 à 2 fois par semaine", "3 à 5 fois par semaine", "Tous les jours"],
      },
      {
        id: "water",
        label: "Eau bue par jour",
        type: "single",
        options: ["Moins d'1/2 litre", "1/2 à 1 litre", "1 à 1,5 litre", "1,5 à 2 litres", "Plus de 2 litres"],
      },
      {
        id: "hot_drinks",
        label: "Cafés ou thés par jour",
        type: "single",
        options: ["Aucun", "1 à 2", "3 à 4", "5 ou plus"],
      },
      {
        id: "sugary_drinks",
        label: "Boissons sucrées ou sodas",
        type: "single",
        options: ["Jamais", "Rarement", "Plusieurs fois par semaine", "Tous les jours"],
      },
      {
        id: "disliked_foods",
        label: "Aliments que vous n'aimez pas ou ne mangez pas",
        type: "textarea",
      },
      {
        id: "loved_foods",
        label: "Aliments que vous adorez",
        type: "textarea",
      },
      {
        id: "typical_day",
        label: "Décrivez une journée alimentaire type",
        type: "textarea",
        placeholder: "Petit-déjeuner, déjeuner, collation, dîner…",
      },
    ],
  },
  {
    id: "comportement",
    title: "Comportement alimentaire",
    emoji: "🧠",
    intro: "Sans jugement : cela m'aide à adapter le programme à votre quotidien.",
    questions: [
      {
        id: "snacking",
        label: "Grignotez-vous entre les repas ?",
        type: "single",
        options: ["Jamais", "Parfois", "Souvent", "Tous les jours"],
      },
      {
        id: "snack_when",
        label: "À quels moments ?",
        type: "multi",
        options: ["Aucun", "Matin", "Après-midi", "Soirée", "La nuit", "Devant un écran"],
      },
      {
        id: "cravings",
        label: "Envies fréquentes",
        type: "multi",
        options: ["Aucune", "Sucré", "Salé", "Gras", "Féculents", "Chocolat"],
      },
      {
        id: "emotional_eating",
        label: "Mangez-vous pour gérer le stress, l'ennui ou les émotions ?",
        type: "single",
        options: FREQUENCE,
      },
      {
        id: "compulsions",
        label: "Épisodes de compulsion alimentaire (perte de contrôle)",
        type: "single",
        options: FREQUENCE,
      },
      {
        id: "eating_speed",
        label: "Votre vitesse pour manger",
        type: "single",
        options: ["Lente", "Normale", "Rapide"],
      },
      {
        id: "hunger_signals",
        label: "Vos sensations de faim et de satiété",
        type: "single",
        options: [
          "Je ressens bien la faim et la satiété",
          "Je ressens mal la faim",
          "Je ressens mal la satiété",
          "Je mange surtout selon l'horloge",
        ],
      },
      {
        id: "eating_context",
        label: "Où mangez-vous le plus souvent ?",
        type: "multi",
        options: ["À table en famille", "Seul(e)", "Devant un écran", "Au bureau", "En déplacement"],
      },
    ],
  },
  {
    id: "mode_vie",
    title: "Votre mode de vie",
    emoji: "🏃",
    intro: "Activité, sommeil, stress : ils comptent autant que l'assiette.",
    questions: [
      { id: "job", label: "Votre profession", type: "text" },
      {
        id: "job_activity",
        label: "Votre activité professionnelle est plutôt",
        type: "single",
        options: ["Assise", "Debout / en mouvement", "Physique"],
      },
      {
        id: "household",
        label: "Votre foyer",
        type: "single",
        options: ["Je vis seul(e)", "En couple", "En famille avec enfants", "En colocation"],
      },
      {
        id: "budget",
        label: "Votre budget alimentation",
        type: "single",
        options: ["Serré", "Moyen", "Confortable"],
      },
      {
        id: "sleep_hours",
        label: "Heures de sommeil par nuit",
        type: "single",
        options: ["Moins de 5 h", "5 à 6 h", "6 à 7 h", "7 à 8 h", "Plus de 8 h"],
      },
      {
        id: "sleep_quality",
        label: "Qualité de votre sommeil",
        type: "scale",
        min: 1,
        max: 5,
        hint: "1 = très mauvaise · 5 = excellente",
      },
      {
        id: "stress",
        label: "Votre niveau de stress",
        type: "scale",
        min: 1,
        max: 5,
        hint: "1 = très faible · 5 = très élevé",
      },
      {
        id: "daily_steps",
        label: "Votre marche quotidienne",
        type: "single",
        options: ["Moins de 3 000 pas", "3 000 à 6 000 pas", "6 000 à 10 000 pas", "Plus de 10 000 pas", "Je ne sais pas"],
      },
      {
        id: "sport_frequency",
        label: "Sport ou activité physique actuelle",
        type: "single",
        options: ["Aucune", "1 à 2 fois par semaine", "3 à 4 fois par semaine", "5 fois ou plus"],
      },
      {
        id: "sport_types",
        label: "Quels types d'activité ?",
        type: "multi",
        options: [
          "Aucune",
          "Marche / course",
          "Musculation",
          "Sports collectifs",
          "Natation",
          "Vélo",
          "Yoga / pilates",
          "Sports de combat",
          "Autre",
        ],
      },
      {
        id: "sport_limits",
        label: "Douleurs, blessures ou limitations physiques",
        type: "textarea",
        placeholder: "Facultatif",
      },
    ],
  },
  {
    id: "conclusion",
    title: "Pour finir",
    emoji: "✍️",
    intro: "Dernières précisions avant de valider votre dossier.",
    questions: [
      {
        id: "expectations",
        label: "Qu'attendez-vous de votre accompagnement ?",
        type: "textarea",
      },
      {
        id: "anything_else",
        label: "Autre chose que je dois savoir ?",
        type: "textarea",
      },
    ],
  },
];