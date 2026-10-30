import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type MealKey = "matin" | "midi" | "soir";
type Phase = 1 | 2 | 3;

export interface MealItem {
  quantity: string;
  unit: string;
  name: string;
}

export interface MealVariant {
  id: string;
  title: string;
  items: MealItem[];
}

export interface MealPlan {
  items: MealItem[];
  variants?: MealVariant[];
  proteines: boolean;
  lipides_crus_g: number;
  feculent_cru_g: number;
  feculent_cuit_g: number;
  pain_cereales_g?: number;
}

export interface SnackPlan {
  id: string;
  title: string;
  items: MealItem[];
}

interface MainMeals {
  matin: MealPlan;
  midi: MealPlan;
  soir: MealPlan;
}

export interface MacroResult {
  mb: number;
  tdee: number;
  target_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  feculent_midi_cru_g: number;
  feculent_soir_cru_g: number;
  feculent_matin_pain_g: number;
  feculent_label: string;
  phase: Phase;
  meals: {
    phase: Phase;
    mb: number;
    tdee: number;
    matin: MealPlan;
    midi: MealPlan;
    soir: MealPlan;
    collations: SnackPlan[];
  };
}

interface Props {
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  gender: "homme" | "femme" | null;
  onValidate: (result: MacroResult) => void | Promise<void>;
}

const NAP_OPTIONS = [
  {
    value: "1.40",
    label: "Sédentaire (bureau, peu de marche)",
  },
  {
    value: "1.55",
    label: "Légèrement actif (marche ~30 min/j)",
  },
  {
    value: "1.70",
    label: "Modérément actif (sport 3×/sem)",
  },
  {
    value: "1.85",
    label: "Très actif (sport 5×/sem)",
  },
  {
    value: "2.00",
    label: "Extrêmement actif (athlète)",
  },
];

const PHASE_OPTIONS = [
  {
    value: "1",
    label: "Phase 1 — Déficit léger (-150 kcal)",
    deficit: 150,
  },
  {
    value: "2",
    label: "Phase 2 — Déficit modéré (-400 kcal)",
    deficit: 400,
  },
  {
    value: "3",
    label: "Phase 3 — Déficit important (-700 kcal)",
    deficit: 700,
  },
];

const MEAL_SECTIONS: Array<{
  key: MealKey;
  title: string;
}> = [
  {
    key: "matin",
    title: "Petit-déjeuner",
  },
  {
    key: "midi",
    title: "Déjeuner",
  },
  {
    key: "soir",
    title: "Dîner",
  },
];

const MIN_KCAL_FEMME = 1200;
const MIN_KCAL_HOMME = 1500;

function parseNumber(value: string): number {
  if (!value.trim()) {
    return Number.NaN;
  }

  return Number(value.trim().replace(",", "."));
}

function emptyItem(): MealItem {
  return {
    quantity: "",
    unit: "",
    name: "",
  };
}

function cleanItems(items: MealItem[]): MealItem[] {
  return items.map((item) => ({
    quantity: item.quantity.trim(),
    unit: item.unit.trim(),
    name: item.name.trim(),
  }));
}

function prepareMeal(meal: MealPlan): MealPlan {
  return {
    ...meal,
    items: cleanItems(meal.items),
    variants: (meal.variants ?? []).map((variant) => ({
      id: variant.id,
      title: variant.title.trim(),
      items: cleanItems(variant.items),
    })),
  };
}

function calcMBkJ(
  weight: number,
  height: number,
  age: number,
  gender: "homme" | "femme",
): number {
  const base =
    1.083 *
    Math.pow(weight, 0.48) *
    Math.pow(height, 0.5) *
    Math.pow(age, -0.13) *
    1000;

  const adjusted =
    gender === "femme"
      ? base * (0.963 / 1.083)
      : base;

  return Math.round(adjusted) / 10;
}

function createMeals(
  phase: "1" | "2" | "3",
  sex: "homme" | "femme",
): MainMeals {
  const fecMidi =
    phase === "1" ? 80 : phase === "2" ? 50 : 0;

  const fecSoir =
    phase === "1" ? 40 : phase === "2" ? 25 : 0;

  const pain = sex === "femme" ? 30 : 50;

  return {
    matin: {
      pain_cereales_g: pain,
      proteines: true,
      lipides_crus_g: 10,
      feculent_cru_g: pain,
      feculent_cuit_g: pain,
      variants: [],
      items: [
        {
          quantity: "1",
          unit: "tasse",
          name: "Café ou thé sans sucre",
        },
        {
          quantity: "1",
          unit: "unité",
          name: "Yaourt nature ou œuf",
        },
        {
          quantity: String(pain),
          unit: "g",
          name: "Pain aux céréales",
        },
        {
          quantity: "10",
          unit: "g",
          name: "Beurre ou confiture",
        },
        {
          quantity: "1",
          unit: "unité",
          name: "Fruit de saison",
        },
      ],
    },
    midi: {
      proteines: true,
      lipides_crus_g: 10,
      feculent_cru_g: fecMidi,
      feculent_cuit_g: fecMidi * 2,
      variants: [],
      items: [
        {
          quantity: "120",
          unit: "g",
          name: "Protéine : viande, poisson ou œuf",
        },
        {
          quantity: String(fecMidi),
          unit: "g",
          name: "Féculents crus",
        },
        {
          quantity: "à volonté",
          unit: "",
          name: "Légumes",
        },
        {
          quantity: "10",
          unit: "g",
          name: "Huile d’olive ou colza crue",
        },
        {
          quantity: "1",
          unit: "unité",
          name: "Fruit de saison",
        },
      ],
    },
    soir: {
      proteines: true,
      lipides_crus_g: 10,
      feculent_cru_g: fecSoir,
      feculent_cuit_g: fecSoir * 2,
      variants: [],
      items: [
        {
          quantity: "120",
          unit: "g",
          name: "Protéine : poisson, œuf ou viande blanche",
        },
        {
          quantity: String(fecSoir),
          unit: "g",
          name: "Féculents crus",
        },
        {
          quantity: "à volonté",
          unit: "",
          name: "Légumes",
        },
        {
          quantity: "10",
          unit: "g",
          name: "Huile d’olive ou colza crue",
        },
        {
          quantity: "1",
          unit: "unité",
          name: "Yaourt nature",
        },
      ],
    },
  };
}

interface MealItemsEditorProps {
  items: MealItem[];
  onChange: (items: MealItem[]) => void;
}

function MealItemsEditor({
  items,
  onChange,
}: MealItemsEditorProps) {
  function updateItem(
    index: number,
    patch: Partial<MealItem>,
  ) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...patch }
          : item,
      ),
    );
  }

  function removeItem(index: number) {
    onChange(
      items.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([...items, emptyItem()])
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          Ajouter un aliment
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucun aliment renseigné. Ajoute une ligne
          pour compléter cette option.
        </p>
      ) : null}

      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border bg-muted/10 p-3"
        >
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <Input
              value={item.quantity}
              onChange={(event) =>
                updateItem(index, {
                  quantity: event.target.value,
                })
              }
              placeholder="Quantité"
              aria-label={`Quantité de l’aliment ${index + 1}`}
            />

            <Input
              value={item.unit}
              onChange={(event) =>
                updateItem(index, {
                  unit: event.target.value,
                })
              }
              placeholder="Unité : g, ml, tasse…"
              aria-label={`Unité de l’aliment ${index + 1}`}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => removeItem(index)}
              aria-label={`Supprimer l’aliment ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Input
            value={item.name}
            onChange={(event) =>
              updateItem(index, {
                name: event.target.value,
              })
            }
            placeholder="Nom de l’aliment"
            aria-label={`Nom de l’aliment ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

export function MacroCalculator({
  weight_kg,
  height_cm,
  age,
  gender,
  onValidate,
}: Props) {
  const [weight, setWeight] = useState(
    weight_kg?.toString() ?? "",
  );
  const [height, setHeight] = useState(
    height_cm?.toString() ?? "",
  );
  const [ageVal, setAge] = useState(
    age?.toString() ?? "",
  );
  const [sex, setSex] = useState<"homme" | "femme">(
    gender ?? "femme",
  );
  const [nap, setNap] = useState("1.55");
  const [phase, setPhase] =
    useState<"1" | "2" | "3">("1");

  const [mb, setMb] = useState<number | null>(null);
  const [tdee, setTdee] =
    useState<number | null>(null);
  const [targetKcal, setTargetKcal] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [carbsG, setCarbsG] = useState("");

  const [calculated, setCalculated] = useState(false);
  const [warning, setWarning] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [meals, setMeals] =
    useState<MainMeals | null>(null);
  const [collations, setCollations] =
    useState<SnackPlan[]>([]);

  useEffect(() => {
    setCalculated(false);
    setWarning(null);
    setError(null);
  }, [weight, height, ageVal, sex, nap, phase]);

  function handleCalculate() {
    const w = parseNumber(weight);
    const h = parseNumber(height);
    const a = parseNumber(ageVal);

    if (
      ![w, h, a].every(
        (value) =>
          Number.isFinite(value) && value > 0,
      )
    ) {
      setError(
        "Renseigne un poids, une taille et un âge strictement positifs.",
      );
      return;
    }

    if (
      meals &&
      !window.confirm(
        "Recalculer remplacera les repas, leurs variantes et les collations actuellement dans l’éditeur. Continuer ?",
      )
    ) {
      return;
    }

    const phaseOption = PHASE_OPTIONS.find(
      (option) => option.value === phase,
    );

    if (!phaseOption) {
      setError("La phase sélectionnée est invalide.");
      return;
    }

    const napVal = parseNumber(nap);
    const mbKj = calcMBkJ(w, h, a, sex);
    const mbKcal = Math.round(mbKj / 4.185);
    const tdeeVal = Math.round(
      (mbKj * napVal) / 4.185,
    );

    if (
      !Number.isFinite(mbKcal) ||
      !Number.isFinite(tdeeVal)
    ) {
      setError(
        "Le calcul est impossible avec ces valeurs.",
      );
      return;
    }

    const minKcal =
      sex === "femme"
        ? MIN_KCAL_FEMME
        : MIN_KCAL_HOMME;

    const rawKcal = tdeeVal - phaseOption.deficit;
    const kcal = Math.max(minKcal, rawKcal);

    setWarning(
      rawKcal < minKcal
        ? `Le déficit demandé donnerait ${rawKcal} kcal. L’objectif a été remonté au seuil configuré de ${minKcal} kcal. À vérifier par le praticien.`
        : null,
    );

    setError(null);
    setMb(mbKcal);
    setTdee(tdeeVal);
    setTargetKcal(String(kcal));
    setProteinG(
      String(Math.round((kcal * 0.2) / 4)),
    );
    setFatG(
      String(Math.round((kcal * 0.2) / 9)),
    );
    setCarbsG(
      String(
        Math.max(0, Math.round((kcal * 0.6) / 4)),
      ),
    );
    setMeals(createMeals(phase, sex));
    setCollations([]);
    setCalculated(true);
  }

  function updateMealItems(
    mealKey: MealKey,
    items: MealItem[],
  ) {
    setMeals((current) => {
      if (!current) return current;

      return {
        ...current,
        [mealKey]: {
          ...current[mealKey],
          items,
        },
      };
    });
  }

  function addVariant(mealKey: MealKey) {
    const id = crypto.randomUUID();

    setMeals((current) => {
      if (!current) return current;

      const meal = current[mealKey];
      const variants = meal.variants ?? [];

      const variant: MealVariant = {
        id,
        title: `Variante ${variants.length + 1}`,
        items:
          meal.items.length > 0
            ? meal.items.map((item) => ({ ...item }))
            : [emptyItem()],
      };

      return {
        ...current,
        [mealKey]: {
          ...meal,
          variants: [...variants, variant],
        },
      };
    });
  }

  function updateVariant(
    mealKey: MealKey,
    variantId: string,
    patch: Partial<Pick<MealVariant, "title" | "items">>,
  ) {
    setMeals((current) => {
      if (!current) return current;

      const meal = current[mealKey];

      return {
        ...current,
        [mealKey]: {
          ...meal,
          variants: (meal.variants ?? []).map(
            (variant) =>
              variant.id === variantId
                ? { ...variant, ...patch }
                : variant,
          ),
        },
      };
    });
  }

  function removeVariant(
    mealKey: MealKey,
    variantId: string,
  ) {
    if (
      !window.confirm(
        "Supprimer cette variante et ses aliments ? Le repas principal sera conservé.",
      )
    ) {
      return;
    }

    setMeals((current) => {
      if (!current) return current;

      const meal = current[mealKey];

      return {
        ...current,
        [mealKey]: {
          ...meal,
          variants: (meal.variants ?? []).filter(
            (variant) => variant.id !== variantId,
          ),
        },
      };
    });
  }

  function addCollation() {
    const id = crypto.randomUUID();

    setCollations((current) => [
      ...current,
      {
        id,
        title: `Collation ${current.length + 1}`,
        items: [emptyItem()],
      },
    ]);
  }

  function updateCollation(
    collationId: string,
    patch: Partial<Pick<SnackPlan, "title" | "items">>,
  ) {
    setCollations((current) =>
      current.map((collation) =>
        collation.id === collationId
          ? { ...collation, ...patch }
          : collation,
      ),
    );
  }

  function removeCollation(collationId: string) {
    setCollations((current) =>
      current.filter(
        (collation) =>
          collation.id !== collationId,
      ),
    );
  }

  async function handleValidate() {
    if (
      !calculated ||
      !meals ||
      mb === null ||
      tdee === null ||
      saving
    ) {
      return;
    }

    const kcal = parseNumber(targetKcal);
    const protein = parseNumber(proteinG);
    const fat = parseNumber(fatG);
    const carbs = parseNumber(carbsG);

    if (
      !Number.isFinite(kcal) ||
      kcal <= 0 ||
      ![protein, fat, carbs].every(
        (value) =>
          Number.isFinite(value) && value >= 0,
      )
    ) {
      setError(
        "Vérifie les objectifs : les calories doivent être positives et les macros positives ou nulles.",
      );
      return;
    }

    for (const section of MEAL_SECTIONS) {
      const meal = meals[section.key];
      const variants = meal.variants ?? [];

      if (
        meal.items.some(
          (item) => !item.name.trim(),
        )
      ) {
        setError(
          `${section.title} : complète le nom des aliments du repas principal ou supprime les lignes vides.`,
        );
        return;
      }

      if (
        variants.length > 0 &&
        meal.items.length === 0
      ) {
        setError(
          `${section.title} : complète le repas principal avant de publier ses variantes.`,
        );
        return;
      }

      for (const variant of variants) {
        if (!variant.title.trim()) {
          setError(
            `${section.title} : donne un nom à chaque variante.`,
          );
          return;
        }

        if (variant.items.length === 0) {
          setError(
            `${section.title} — ${variant.title} : ajoute au moins un aliment ou supprime la variante.`,
          );
          return;
        }

        if (
          variant.items.some(
            (item) => !item.name.trim(),
          )
        ) {
          setError(
            `${section.title} — ${variant.title} : complète les noms des aliments ou supprime les lignes vides.`,
          );
          return;
        }
      }
    }

    for (const collation of collations) {
      if (
        !collation.title.trim() ||
        collation.items.length === 0
      ) {
        setError(
          "Chaque collation doit avoir un titre et au moins un aliment. Sinon, supprime la collation.",
        );
        return;
      }

      if (
        collation.items.some(
          (item) => !item.name.trim(),
        )
      ) {
        setError(
          `${collation.title} : complète les noms des aliments ou supprime les lignes vides.`,
        );
        return;
      }
    }

    const phaseValue = Number(phase) as Phase;

    setError(null);
    setSaving(true);

    try {
      await onValidate({
        mb,
        tdee,
        target_kcal: kcal,
        protein_g: protein,
        fat_g: fat,
        carbs_g: carbs,
        feculent_midi_cru_g:
          meals.midi.feculent_cru_g,
        feculent_soir_cru_g:
          meals.soir.feculent_cru_g,
        feculent_matin_pain_g:
          meals.matin.pain_cereales_g ?? 0,
        feculent_label: "Féculents au choix",
        phase: phaseValue,
        meals: {
          phase: phaseValue,
          mb,
          tdee,
          matin: prepareMeal(meals.matin),
          midi: prepareMeal(meals.midi),
          soir: prepareMeal(meals.soir),
          collations: collations.map(
            (collation) => ({
              id: collation.id,
              title: collation.title.trim(),
              items: cleanItems(collation.items),
            }),
          ),
        },
      });
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Impossible d’enregistrer le programme.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-base">
          Calculateur de macros — Méthode Black et al.
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <fieldset
          disabled={saving}
          className="min-w-0 space-y-6"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="macro-weight">
                Poids (kg) *
              </Label>

              <Input
                id="macro-weight"
                type="number"
                min="0.1"
                step="0.1"
                value={weight}
                onChange={(event) =>
                  setWeight(event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="macro-height">
                Taille (cm) *
              </Label>

              <Input
                id="macro-height"
                type="number"
                min="1"
                value={height}
                onChange={(event) =>
                  setHeight(event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="macro-age">
                Âge *
              </Label>

              <Input
                id="macro-age"
                type="number"
                min="1"
                value={ageVal}
                onChange={(event) =>
                  setAge(event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Sexe *</Label>

              <Select
                disabled={saving}
                value={sex}
                onValueChange={(value) =>
                  setSex(
                    value as "homme" | "femme",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="femme">
                    Femme
                  </SelectItem>
                  <SelectItem value="homme">
                    Homme
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>
                Niveau d’activité (NAP)
              </Label>

              <Select
                disabled={saving}
                value={nap}
                onValueChange={setNap}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {NAP_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Phase de déficit</Label>

              <Select
                disabled={saving}
                value={phase}
                onValueChange={(value) =>
                  setPhase(
                    value as "1" | "2" | "3",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {PHASE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleCalculate}
            className="w-full"
          >
            Calculer les macros
          </Button>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          {calculated && meals ? (
            <>
              <Separator />

              {warning ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {warning}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Métabolisme de base
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {mb} kcal
                  </p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    TDEE
                  </p>
                  <p className="text-lg font-bold">
                    {tdee} kcal
                  </p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Objectif calorique
                  </p>
                  <p className="text-lg font-bold text-green-600">
                    {targetKcal} kcal
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label>Kcal cible</Label>
                  <Input
                    type="number"
                    min="1"
                    value={targetKcal}
                    onChange={(event) =>
                      setTargetKcal(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Protéines (g)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={proteinG}
                    onChange={(event) =>
                      setProteinG(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Lipides (g)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={fatG}
                    onChange={(event) =>
                      setFatG(event.target.value)
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Glucides (g)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={carbsG}
                    onChange={(event) =>
                      setCarbsG(
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                Les chiffres ci-dessus sont des objectifs.
                Modifier les aliments, ajouter une variante
                ou une collation ne recalcule pas
                automatiquement leur bilan nutritionnel.
                Les variantes ne sont pas automatiquement
                équivalentes sur le plan nutritionnel.
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Programme modifiable avant validation
                </h3>

                <p className="text-xs text-muted-foreground">
                  Pour chaque repas, prépare le repas
                  principal et, si nécessaire, des variantes.
                  Une variante est une alternative au même
                  repas, pas un repas supplémentaire.
                </p>
              </div>

              {MEAL_SECTIONS.map((section) => {
                const meal = meals[section.key];
                const variants = meal.variants ?? [];

                return (
                  <div
                    key={section.key}
                    className="space-y-5 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-base font-semibold">
                        {section.title}
                      </h4>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          addVariant(section.key)
                        }
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter une variante
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        Repas principal
                      </p>

                      <MealItemsEditor
                        items={meal.items}
                        onChange={(items) =>
                          updateMealItems(
                            section.key,
                            items,
                          )
                        }
                      />
                    </div>

                    {variants.length > 0 ? (
                      <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                        Le patient devra choisir une seule
                        option pour ce repas : le repas
                        principal ou l’une des variantes.
                      </p>
                    ) : null}

                    {variants.map(
                      (variant, variantIndex) => (
                        <div
                          key={variant.id}
                          className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h5 className="text-sm font-semibold">
                              Variante {variantIndex + 1}
                            </h5>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                removeVariant(
                                  section.key,
                                  variant.id,
                                )
                              }
                            >
                              <X className="mr-1 h-4 w-4" />
                              Supprimer la variante
                            </Button>
                          </div>

                          <div className="space-y-1">
                            <Label
                              htmlFor={`variant-title-${variant.id}`}
                            >
                              Nom de la variante
                            </Label>

                            <Input
                              id={`variant-title-${variant.id}`}
                              value={variant.title}
                              placeholder="Ex. : Option végétarienne"
                              onChange={(event) =>
                                updateVariant(
                                  section.key,
                                  variant.id,
                                  {
                                    title:
                                      event.target.value,
                                  },
                                )
                              }
                            />
                          </div>

                          <MealItemsEditor
                            items={variant.items}
                            onChange={(items) =>
                              updateVariant(
                                section.key,
                                variant.id,
                                { items },
                              )
                            }
                          />
                        </div>
                      ),
                    )}
                  </div>
                );
              })}

              <Separator />

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Collations
                    </h3>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Ajoute une collation uniquement si
                      tu souhaites l’intégrer au programme.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCollation}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Ajouter une collation
                  </Button>
                </div>

                {collations.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Aucune collation ajoutée.
                  </div>
                ) : null}

                {collations.map(
                  (collation, collationIndex) => (
                    <div
                      key={collation.id}
                      className="space-y-4 rounded-xl border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">
                          Collation {collationIndex + 1}
                        </h4>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            removeCollation(
                              collation.id,
                            )
                          }
                        >
                          <X className="mr-1 h-4 w-4" />
                          Supprimer la collation
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <Label
                          htmlFor={`snack-title-${collation.id}`}
                        >
                          Nom ou moment de la collation
                        </Label>

                        <Input
                          id={`snack-title-${collation.id}`}
                          value={collation.title}
                          placeholder="Ex. : Collation de l’après-midi"
                          onChange={(event) =>
                            updateCollation(
                              collation.id,
                              {
                                title:
                                  event.target.value,
                              },
                            )
                          }
                        />
                      </div>

                      <MealItemsEditor
                        items={collation.items}
                        onChange={(items) =>
                          updateCollation(
                            collation.id,
                            { items },
                          )
                        }
                      />
                    </div>
                  ),
                )}
              </div>

              <Button
                type="button"
                onClick={() =>
                  void handleValidate()
                }
                className="w-full"
                size="lg"
                disabled={saving}
              >
                {saving
                  ? "Enregistrement du programme…"
                  : "Valider et publier ce programme pour le patient"}
              </Button>
            </>
          ) : null}
        </fieldset>
      </CardContent>
    </Card>
  );
}