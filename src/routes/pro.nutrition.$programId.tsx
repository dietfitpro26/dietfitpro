import {
  useEffect,
  useState,
  useRef,
  type FormEvent,
  type ChangeEvent,
} from "react";
import {
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Upload,
  FileText,
  Trash2,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute(
  "/pro/nutrition/$programId",
)({
  head: () => ({
    meta: [
      {
        title: "Programme nutrition — DietFitPro",
      },
    ],
  }),
  component: Page,
});

type MealMoment =
  | "matin"
  | "midi"
  | "soir"
  | "collation";

type MainMealMoment = Exclude<
  MealMoment,
  "collation"
>;

const MOMENT_LABEL: Record<MealMoment, string> = {
  matin: "Petit-déjeuner",
  midi: "Déjeuner",
  soir: "Dîner",
  collation: "Collation",
};

const MAIN_MOMENTS: MainMealMoment[] = [
  "matin",
  "midi",
  "soir",
];

const MEAL_TYPE_BY_MOMENT: Record<
  MealMoment,
  string
> = {
  matin: "breakfast",
  midi: "lunch",
  soir: "dinner",
  collation: "snack",
};

const MOMENT_BY_MEAL_TYPE: Record<
  string,
  MealMoment
> = {
  breakfast: "matin",
  lunch: "midi",
  dinner: "soir",
  snack: "collation",
};

type ItemCategory =
  | "drink"
  | "protein"
  | "starch"
  | "vegetable"
  | "fruit"
  | "dairy"
  | "dessert"
  | "fat"
  | "other";

const CATEGORY_LABEL: Record<
  ItemCategory,
  string
> = {
  drink: "Boisson",
  protein: "Protéine",
  starch: "Féculent",
  vegetable: "Légume",
  fruit: "Fruit",
  dairy: "Produit laitier",
  dessert: "Dessert",
  fat: "Matière grasse",
  other: "Autre",
};

const CATEGORY_OPTIONS = Object.keys(
  CATEGORY_LABEL,
) as ItemCategory[];

interface MealItem {
  id?: string;
  category: ItemCategory;
  food_name: string;
  quantity: string;
  unit: string;
  equivalence: string;
  notes: string;
  is_optional: boolean;
  display_order: number;
}

interface CustomMeal {
  id: string;
  meal_type: string;
  name: string;
  variant: string | null;
  notes: string | null;
  display_order: number;
  items: MealItem[];
}

interface MealSlot {
  items?: unknown;
  variants?: unknown;
  pain_cereales_g?: number | null;
  feculent_cru_g?: number | null;
  feculent_cuit_g?: number | null;
  feculent_nom?: string | null;
  legumes?: string | null;
  proteines?: boolean | null;
  lipides_crus_g?: number | null;
}

interface StructuredMeals {
  phase?: number | null;
  mb?: number | null;
  tdee?: number | null;
  matin?: MealSlot;
  midi?: MealSlot;
  soir?: MealSlot;
  collations?: unknown;
}

interface SavedOption {
  id: string;
  title: string;
  items: unknown[];
}

interface LegacyMeal {
  id: string;
  moment: MealMoment;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Program {
  id: string;
  name: string;
  patient_id: string;
  daily_kcal_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  notes: string | null;
  meals: unknown;
  pdf_url: string | null;
}

interface PatientLite {
  id: string;
  first_name: string;
  last_name: string;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function text(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return "";
}

function num(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function asStructured(
  raw: unknown,
): StructuredMeals | null {
  if (
    isRecord(raw) &&
    (
      isRecord(raw.matin) ||
      isRecord(raw.midi) ||
      isRecord(raw.soir) ||
      Array.isArray(raw.collations)
    )
  ) {
    return raw as StructuredMeals;
  }

  return null;
}

function readOptions(
  raw: unknown,
  fallbackTitle: string,
): SavedOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const options: SavedOption[] = [];

  raw.forEach((value, index) => {
    if (
      !isRecord(value) ||
      !Array.isArray(value.items)
    ) {
      return;
    }

    options.push({
      id: text(value.id) || `option-${index}`,
      title:
        text(value.title) ||
        `${fallbackTitle} ${index + 1}`,
      items: value.items,
    });
  });

  return options;
}

function itemLines(items: unknown[]): string[] {
  const lines: string[] = [];

  items.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const name = text(item.name);

    if (!name) {
      return;
    }

    lines.push(
      [
        text(item.quantity),
        text(item.unit),
        name,
      ]
        .filter(Boolean)
        .join(" "),
    );
  });

  return lines.length
    ? lines
    : ["Aucun aliment renseigné."];
}

function slotLines(
  moment: MainMealMoment,
  slot: MealSlot | undefined,
): string[] {
  if (!slot) {
    return ["Aucune indication pour ce repas."];
  }

  if (Array.isArray(slot.items)) {
    return itemLines(slot.items);
  }

  const lines: string[] = [];

  if (moment === "matin") {
    const pain = num(slot.pain_cereales_g);

    if (pain !== null && pain > 0) {
      lines.push(
        `${pain} g de pain aux céréales`,
      );
    }

    if (slot.proteines !== false) {
      lines.push(
        "Une source de protéines (yaourt, œuf…)",
      );
    }
  } else {
    if (slot.proteines !== false) {
      lines.push(
        "Une portion de protéines (viande, poisson, œuf…)",
      );
    }

    lines.push(
      `${slot.legumes || "À volonté"} de légumes`,
    );

    const cru = num(slot.feculent_cru_g);
    const cuit = num(slot.feculent_cuit_g);

    if (cru !== null && cru > 0) {
      const cookedLabel =
        cuit !== null && cuit > 0
          ? ` (${cuit} g cuits indiqués dans le programme)`
          : "";

      lines.push(
        `${cru} g crus de ${
          slot.feculent_nom || "féculents"
        }${cookedLabel}`,
      );
    } else {
      lines.push("Pas de féculent à ce repas");
    }
  }

  const lipides = num(slot.lipides_crus_g);

  if (lipides !== null && lipides > 0) {
    lines.push(
      moment === "matin"
        ? `${lipides} g de beurre OU ${lipides} g de confiture`
        : `${lipides} g de matières grasses crues`,
    );
  }

  return lines.length
    ? lines
    : ["Aucune indication pour ce repas."];
}

function getLegacyMeals(raw: unknown): LegacyMeal[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (value): value is LegacyMeal =>
      isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      (
        value.moment === "matin" ||
        value.moment === "midi" ||
        value.moment === "soir" ||
        value.moment === "collation"
      ) &&
      num(value.kcal) !== null &&
      num(value.protein_g) !== null &&
      num(value.carbs_g) !== null &&
      num(value.fat_g) !== null,
  );
}

function normalizeCustomMeals(
  raw: unknown,
): CustomMeal[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((value) => {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      typeof value.meal_type !== "string"
    ) {
      return [];
    }

    const items: MealItem[] = [];

    if (Array.isArray(value.nutrition_meal_items)) {
      value.nutrition_meal_items.forEach(
        (rawItem) => {
          if (!isRecord(rawItem)) {
            return;
          }

          const category = text(rawItem.category);

          items.push({
            id:
              typeof rawItem.id === "string"
                ? rawItem.id
                : undefined,
            category: CATEGORY_OPTIONS.includes(
              category as ItemCategory,
            )
              ? category as ItemCategory
              : "other",
            food_name: text(rawItem.food_name),
            quantity: text(rawItem.quantity),
            unit: text(rawItem.unit),
            equivalence: text(rawItem.equivalence),
            notes: text(rawItem.notes),
            is_optional:
              rawItem.is_optional === true,
            display_order:
              num(rawItem.display_order) ?? 0,
          });
        },
      );
    }

    return [{
      id: value.id,
      meal_type: value.meal_type,
      name: text(value.name),
      variant: text(value.variant) || null,
      notes: text(value.notes) || null,
      display_order:
        num(value.display_order) ?? 0,
      items: items.sort(
        (a, b) =>
          a.display_order - b.display_order,
      ),
    }];
  });
}

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <Content />
      </ProLayout>
    </ProtectedRoute>
  );
}

function Content() {
  const { user } = useAuth();
  const { programId } = Route.useParams();
  const navigate = useNavigate();

  const [program, setProgram] =
    useState<Program | null>(null);
  const [patient, setPatient] =
    useState<PatientLite | null>(null);
  const [customMeals, setCustomMeals] =
    useState<CustomMeal[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] =
    useState<string | null>(null);
  const [mealOpen, setMealOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPdf, setDeletingPdf] =
    useState(false);
  const [deletingMealId, setDeletingMealId] =
    useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  async function load() {
    if (!user) {
      return;
    }

    setLoading(true);
    setLoadError(null);
    setProgram(null);
    setPatient(null);
    setCustomMeals([]);

    try {
      const { data, error } = await supabase
        .from("nutrition_programs")
        .select(
          "id, name, patient_id, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, notes, meals, pdf_url",
        )
        .eq("id", programId)
        .eq("pro_id", user.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return;
      }

      const loadedProgram = data as Program;
      setProgram(loadedProgram);

      const [
        patientResponse,
        mealsResponse,
      ] = await Promise.all([
        supabase
          .from("patients")
          .select("id, first_name, last_name")
          .eq("id", loadedProgram.patient_id)
          .eq("pro_id", user.id)
          .maybeSingle(),

        supabase
          .from("nutrition_meals")
          .select(`
            id,
            meal_type,
            name,
            variant,
            notes,
            display_order,
            nutrition_meal_items (
              id,
              category,
              food_name,
              quantity,
              unit,
              equivalence,
              notes,
              is_optional,
              display_order
            )
          `)
          .eq("program_id", loadedProgram.id)
          .order("display_order", {
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          }),
      ]);

      setPatient(
        patientResponse.data as PatientLite | null,
      );

      setCustomMeals(
        normalizeCustomMeals(mealsResponse.data),
      );

      const errors = [
        patientResponse.error?.message,
        mealsResponse.error?.message,
      ].filter(Boolean);

      if (errors.length) {
        setLoadError(
          "Chargement partiel : " +
            errors.join(" — "),
        );
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Impossible de charger le programme.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, programId]);

  async function addMeal(
    meal: CustomMeal,
  ): Promise<void> {
    if (!program || !user) {
      throw new Error(
        "Session ou programme indisponible.",
      );
    }

    const {
      data: insertedMeal,
      error: mealError,
    } = await supabase
      .from("nutrition_meals")
      .insert({
        program_id: program.id,
        pro_id: user.id,
        patient_id: program.patient_id,
        meal_type: meal.meal_type,
        name: meal.name,
        variant: meal.variant,
        notes: meal.notes,
        display_order: customMeals.length,
      })
      .select("id")
      .single();

    if (mealError || !insertedMeal) {
      throw new Error(
        mealError?.message ??
          "Impossible de créer le repas.",
      );
    }

    const mealId = insertedMeal.id as string;

    const items = meal.items.map(
      (item, index) => ({
        meal_id: mealId,
        category: item.category,
        food_name: item.food_name,
        quantity: item.quantity || null,
        unit: item.unit || null,
        equivalence: item.equivalence || null,
        notes: item.notes || null,
        is_optional: item.is_optional,
        display_order: index,
      }),
    );

    const { error: itemsError } = await supabase
      .from("nutrition_meal_items")
      .insert(items);

    if (itemsError) {
      const { error: rollbackError } =
        await supabase
          .from("nutrition_meals")
          .delete()
          .eq("id", mealId)
          .eq("program_id", program.id)
          .eq("pro_id", user.id);

      await load();

      throw new Error(
        "Les aliments n’ont pas été enregistrés : " +
          itemsError.message +
          (
            rollbackError
              ? " Le repas incomplet peut subsister dans la liste."
              : " La suppression du repas incomplet a été demandée."
          ),
      );
    }

    toast.success("Repas personnalisé ajouté");
    setMealOpen(false);
    await load();
  }

  async function deleteMeal(mealId: string) {
    if (
      !program ||
      !user ||
      deletingMealId !== null
    ) {
      return;
    }

    if (
      !window.confirm(
        "Supprimer ce repas personnalisé ?",
      )
    ) {
      return;
    }

    setDeletingMealId(mealId);

    try {
      const { data, error } = await supabase
        .from("nutrition_meals")
        .delete()
        .eq("id", mealId)
        .eq("program_id", program.id)
        .eq("pro_id", user.id)
        .select("id");

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length !== 1) {
        throw new Error(
          "Suppression non confirmée. Vérifie tes droits et recharge la page.",
        );
      }

      setCustomMeals((current) =>
        current.filter(
          (meal) => meal.id !== mealId,
        ),
      );

      toast.success("Repas supprimé");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer le repas.",
      );
    } finally {
      setDeletingMealId(null);
    }
  }

  async function handlePdfUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file || !user || !program || uploading) {
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error(
        "Seuls les fichiers PDF sont acceptés.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(
        "Fichier trop lourd : 10 Mo maximum.",
      );
      event.target.value = "";
      return;
    }

    setUploading(true);

    const path =
      `${user.id}/${program.id}-${crypto.randomUUID()}.pdf`;

    try {
      const { error: uploadError } =
        await supabase.storage
          .from("program-pdfs")
          .upload(path, file, {
            upsert: false,
            contentType: "application/pdf",
          });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from("nutrition_programs")
        .update({ pdf_url: path })
        .eq("id", program.id)
        .eq("pro_id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError || !updated) {
        await supabase.storage
          .from("program-pdfs")
          .remove([path]);

        throw new Error(
          updateError?.message ??
            "Le PDF n’a pas été associé au programme.",
        );
      }

      setProgram((current) =>
        current?.id === program.id
          ? { ...current, pdf_url: path }
          : current,
      );

      toast.success("PDF associé au programme");

      if (program.pdf_url) {
        const { error: cleanupError } =
          await supabase.storage
            .from("program-pdfs")
            .remove([program.pdf_url]);

        if (cleanupError) {
          toast.error(
            "Nouveau PDF enregistré, mais l’ancien fichier n’a pas été supprimé du stockage.",
          );
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d’importer le PDF.",
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handlePdfDelete() {
    if (
      !program?.pdf_url ||
      !user ||
      deletingPdf
    ) {
      return;
    }

    if (
      !window.confirm(
        "Retirer le PDF de ce programme ?",
      )
    ) {
      return;
    }

    const path = program.pdf_url;
    setDeletingPdf(true);

    try {
      const { data, error } = await supabase
        .from("nutrition_programs")
        .update({ pdf_url: null })
        .eq("id", program.id)
        .eq("pro_id", user.id)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        throw new Error(
          error?.message ??
            "Le retrait du PDF n’a pas été confirmé.",
        );
      }

      setProgram((current) =>
        current?.id === program.id
          ? { ...current, pdf_url: null }
          : current,
      );

      const { error: storageError } =
        await supabase.storage
          .from("program-pdfs")
          .remove([path]);

      if (storageError) {
        toast.error(
          "PDF retiré du programme, mais le fichier reste dans le stockage : " +
            storageError.message,
        );
      } else {
        toast.success("PDF supprimé");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de retirer le PDF.",
      );
    } finally {
      setDeletingPdf(false);
    }
  }

  async function handlePdfDownload() {
    if (!program?.pdf_url) {
      return;
    }

    const { data, error } =
      await supabase.storage
        .from("program-pdfs")
        .createSignedUrl(program.pdf_url, 60);

    if (error || !data?.signedUrl) {
      toast.error("Impossible d’ouvrir le PDF");
      return;
    }

    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            navigate({ to: "/pro/nutrition" })
          }
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Button>

        <p className="mt-4 text-destructive">
          {loadError ?? "Programme introuvable."}
        </p>
      </div>
    );
  }

  const structured = asStructured(program.meals);
  const legacyMeals = getLegacyMeals(program.meals);

  const collations = readOptions(
    structured?.collations,
    "Collation",
  );

  const grouped: Record<
    MealMoment,
    CustomMeal[]
  > = {
    matin: [],
    midi: [],
    soir: [],
    collation: [],
  };

  customMeals.forEach((meal) => {
    const moment =
      MOMENT_BY_MEAL_TYPE[meal.meal_type];

    if (moment) {
      grouped[moment].push(meal);
    }
  });

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b bg-white px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Retour aux programmes"
          onClick={() =>
            navigate({ to: "/pro/nutrition" })
          }
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">
            {program.name}
          </h1>

          <p className="text-sm text-muted-foreground">
            {patient
              ? `${patient.first_name} ${patient.last_name}`
              : "—"}
            {program.daily_kcal_target !== null
              ? ` • ${program.daily_kcal_target} kcal/j`
              : ""}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            navigate({
              to: "/pro/patients/$patientId",
              params: {
                patientId: program.patient_id,
              },
            })
          }
        >
          <Pencil className="mr-1 h-4 w-4" />
          Ouvrir la fiche patient
        </Button>
      </header>

      <div className="space-y-6 p-6">
        {loadError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            {loadError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Kcal / jour"
            value={
              program.daily_kcal_target !== null
                ? `${program.daily_kcal_target} kcal`
                : "—"
            }
          />

          <KpiCard
            label="Protéines"
            value={
              program.daily_protein_g !== null
                ? `${program.daily_protein_g} g`
                : "—"
            }
          />

          <KpiCard
            label="Glucides"
            value={
              program.daily_carbs_g !== null
                ? `${program.daily_carbs_g} g`
                : "—"
            }
          />

          <KpiCard
            label="Lipides"
            value={
              program.daily_fat_g !== null
                ? `${program.daily_fat_g} g`
                : "—"
            }
          />
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">
            Programme alimentaire enregistré
          </h2>

          {structured ? (
            <>
              <div className="grid items-start gap-4 md:grid-cols-3">
                {MAIN_MOMENTS.map((moment) => {
                  const slot =
                    structured[moment];

                  return (
                    <MealCard
                      key={moment}
                      title={MOMENT_LABEL[moment]}
                      lines={slotLines(
                        moment,
                        slot,
                      )}
                      variants={readOptions(
                        slot?.variants,
                        "Variante",
                      )}
                    />
                  );
                })}
              </div>

              {collations.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold">
                    Collations
                  </h3>

                  <div className="grid items-start gap-4 md:grid-cols-3">
                    {collations.map(
                      (collation, index) => (
                        <MealCard
                          key={`${collation.id}-${index}`}
                          title={collation.title}
                          lines={itemLines(
                            collation.items,
                          )}
                        />
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : legacyMeals.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {legacyMeals.map((meal) => (
                <Card key={meal.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {MOMENT_LABEL[meal.moment]}
                      {" — "}
                      {meal.name}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="text-sm text-muted-foreground">
                    {meal.kcal} kcal ·{" "}
                    {meal.protein_g} g prot ·{" "}
                    {meal.carbs_g} g gluc ·{" "}
                    {meal.fat_g} g lip
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun détail de repas disponible
              dans le programme enregistré.
            </p>
          )}
        </section>

        {program.notes ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Notes du praticien
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {program.notes}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Document PDF complémentaire
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {program.pdf_url ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <FileText className="h-8 w-8 shrink-0 text-primary" />

                <p className="flex-1 text-sm font-medium">
                  PDF associé au programme
                </p>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void handlePdfDownload()
                  }
                >
                  <Download className="mr-1 h-4 w-4" />
                  Ouvrir
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deletingPdf || uploading}
                  className="text-destructive"
                  onClick={() =>
                    void handlePdfDelete()
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {deletingPdf
                    ? "Suppression…"
                    : "Supprimer"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun PDF associé à ce programme.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || deletingPdf}
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              <Upload className="mr-1 h-4 w-4" />
              {uploading
                ? "Importation…"
                : program.pdf_url
                  ? "Remplacer le PDF"
                  : "Importer un PDF"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Format PDF uniquement · 10 Mo maximum.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) =>
                void handlePdfUpload(event)
              }
            />
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              Repas personnalisés séparés
            </h2>

            <Button
              type="button"
              onClick={() => setMealOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Ajouter un repas
            </Button>
          </div>

          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Ces repas sont gérés séparément du
            programme alimentaire ci-dessus.
            Ils ne sont pas automatiquement intégrés
            aux repas, variantes ou collations affichés
            dans la page nutrition du patient.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              Object.keys(MOMENT_LABEL) as MealMoment[]
            ).map((moment) => (
              <Card key={moment}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {MOMENT_LABEL[moment]}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {grouped[moment].length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun repas personnalisé
                    </p>
                  ) : (
                    grouped[moment].map((meal) => (
                      <div
                        key={meal.id}
                        className="space-y-3 rounded-xl border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {meal.name}
                            </p>

                            {meal.variant ? (
                              <p className="text-xs text-muted-foreground">
                                Variante :{" "}
                                {meal.variant}
                              </p>
                            ) : null}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={
                              deletingMealId !== null
                            }
                            className="shrink-0 text-destructive"
                            aria-label={`Supprimer ${meal.name}`}
                            onClick={() =>
                              void deleteMeal(meal.id)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <ul className="space-y-2">
                          {meal.items.map(
                            (item, index) => (
                              <li
                                key={
                                  item.id ??
                                  `${meal.id}-${index}`
                                }
                                className="text-sm"
                              >
                                <p>
                                  {[
                                    item.quantity,
                                    item.unit,
                                    item.food_name,
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  {item.is_optional
                                    ? " (facultatif)"
                                    : ""}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  {CATEGORY_LABEL[
                                    item.category
                                  ]}
                                </p>

                                {item.equivalence ? (
                                  <p className="text-xs text-muted-foreground">
                                    Équivalence :{" "}
                                    {item.equivalence}
                                  </p>
                                ) : null}

                                {item.notes ? (
                                  <p className="text-xs text-muted-foreground">
                                    {item.notes}
                                  </p>
                                ) : null}
                              </li>
                            ),
                          )}
                        </ul>

                        {meal.notes ? (
                          <p className="whitespace-pre-wrap text-xs italic text-muted-foreground">
                            {meal.notes}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <AddMealDialog
        open={mealOpen}
        onOpenChange={setMealOpen}
        onAdd={addMeal}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="text-lg font-bold text-[#2D7A1F]">
        {value}
      </p>
    </div>
  );
}

function FoodLines({
  lines,
}: {
  lines: string[];
}) {
  return (
    <ul className="space-y-2">
      {lines.map((line, index) => (
        <li
          key={index}
          className="flex items-start gap-2 text-sm"
        >
          <span className="text-primary">•</span>
          <span className="break-words">
            {line}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MealCard({
  title,
  lines,
  variants = [],
}: {
  title: string;
  lines: string[];
  variants?: SavedOption[];
}) {
  const hasVariants = variants.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasVariants ? (
          <p className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
            Une seule option pour ce repas :
            le repas principal ou une variante.
            Ne pas cumuler les options.
          </p>
        ) : null}

        <div className="space-y-2">
          {hasVariants ? (
            <p className="text-sm font-semibold">
              Repas principal
            </p>
          ) : null}

          <FoodLines lines={lines} />
        </div>

        {variants.map((variant, index) => (
          <div
            key={`${variant.id}-${index}`}
            className="space-y-3 rounded-xl border bg-primary/5 p-3"
          >
            <p className="break-words text-sm font-semibold">
              {variant.title}
            </p>

            <FoodLines
              lines={itemLines(variant.items)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function createEmptyCustomItem(
  category: ItemCategory = "drink",
): MealItem {
  return {
    category,
    food_name: "",
    quantity: "",
    unit: "",
    equivalence: "",
    notes: "",
    is_optional: false,
    display_order: 0,
  };
}

function AddMealDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onAdd: (meal: CustomMeal) => Promise<void>;
}) {
  const [moment, setMoment] =
    useState<MealMoment>("matin");
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<MealItem[]>([
    createEmptyCustomItem(),
  ]);

  function updateItem(
    index: number,
    patch: Partial<MealItem>,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...patch }
          : item,
      ),
    );
  }

  function resetForm() {
    setName("");
    setVariant("");
    setNotes("");
    setItems([createEmptyCustomItem()]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!name.trim()) {
      toast.error(
        "Le nom du repas est obligatoire.",
      );
      return;
    }

    const validItems = items
      .filter((item) => item.food_name.trim())
      .map((item, index) => ({
        ...item,
        food_name: item.food_name.trim(),
        quantity: item.quantity.trim(),
        unit: item.unit.trim(),
        equivalence: item.equivalence.trim(),
        notes: item.notes.trim(),
        display_order: index,
      }));

    if (validItems.length === 0) {
      toast.error(
        "Ajoute au moins un aliment.",
      );
      return;
    }

    setSaving(true);

    try {
      await onAdd({
        id: crypto.randomUUID(),
        meal_type: MEAL_TYPE_BY_MOMENT[moment],
        name: name.trim(),
        variant: variant.trim() || null,
        notes: notes.trim() || null,
        display_order: 0,
        items: validItems,
      });

      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer le repas.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) {
          onOpenChange(value);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Ajouter un repas personnalisé séparé
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Cet ajout ne modifie pas automatiquement
          le programme alimentaire du patient.
        </p>

        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4"
        >
          <fieldset
            disabled={saving}
            className="min-w-0 space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Moment</Label>

                <Select
                  disabled={saving}
                  value={moment}
                  onValueChange={(value) =>
                    setMoment(
                      value as MealMoment,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {(
                      Object.keys(
                        MOMENT_LABEL,
                      ) as MealMoment[]
                    ).map((value) => (
                      <SelectItem
                        key={value}
                        value={value}
                      >
                        {MOMENT_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Nom du repas *</Label>
                <Input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  required
                  placeholder="Nom du repas"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Variante</Label>
              <Input
                value={variant}
                onChange={(event) =>
                  setVariant(event.target.value)
                }
                placeholder="Ex. : Version végétarienne"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label>Aliments</Label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    createEmptyCustomItem(
                      "protein",
                    ),
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Ajouter un aliment
              </Button>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="space-y-3 rounded-xl border p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Aliment {index + 1}
                  </p>

                  {items.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Supprimer l’aliment ${index + 1}`}
                      onClick={() =>
                        setItems((current) =>
                          current.filter(
                            (_, itemIndex) =>
                              itemIndex !== index,
                          ),
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label>Catégorie</Label>

                  <Select
                    disabled={saving}
                    value={item.category}
                    onValueChange={(value) =>
                      updateItem(index, {
                        category:
                          value as ItemCategory,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {CATEGORY_OPTIONS.map(
                        (category) => (
                          <SelectItem
                            key={category}
                            value={category}
                          >
                            {
                              CATEGORY_LABEL[
                                category
                              ]
                            }
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Quantité</Label>
                    <Input
                      value={item.quantity}
                      placeholder="Ex. : 120"
                      onChange={(event) =>
                        updateItem(index, {
                          quantity:
                            event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Unité</Label>
                    <Input
                      value={item.unit}
                      placeholder="Ex. : g, ml, tasse"
                      onChange={(event) =>
                        updateItem(index, {
                          unit: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Aliment</Label>
                  <Input
                    value={item.food_name}
                    onChange={(event) =>
                      updateItem(index, {
                        food_name:
                          event.target.value,
                      })
                    }
                    placeholder="Nom de l’aliment"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Équivalence</Label>
                  <Input
                    value={item.equivalence}
                    onChange={(event) =>
                      updateItem(index, {
                        equivalence:
                          event.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Note</Label>
                  <Input
                    value={item.notes}
                    onChange={(event) =>
                      updateItem(index, {
                        notes:
                          event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ))}

            <div className="space-y-1">
              <Label>Notes générales</Label>
              <Textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  onOpenChange(false)
                }
              >
                Annuler
              </Button>

              <Button type="submit">
                {saving
                  ? "Enregistrement…"
                  : "Enregistrer le repas"}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}