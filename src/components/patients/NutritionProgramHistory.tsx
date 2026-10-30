import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

type MealKey = "matin" | "midi" | "soir";

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

interface MealVariantSlot {
  id: string;
  title: string;
  items: unknown[];
}

interface CollationSlot {
  id: string;
  title: string;
  items: unknown[];
}

interface StructuredMeals {
  phase?: number | null;
  matin?: MealSlot;
  midi?: MealSlot;
  soir?: MealSlot;
  collations?: unknown;
}

interface Snapshot {
  id: string;
  name: string | null;
  date: string;
  daily_kcal_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  meals: unknown;
  notes: string | null;
}

type CurrentRow = Omit<Snapshot, "date"> & {
  start_date: string | null;
  updated_at: string | null;
  created_at: string;
};

type HistoryRow = Omit<Snapshot, "date"> & {
  created_at: string;
};

interface VariantCardData {
  id: string;
  title: string;
  lines: string[];
}

interface MealCardData {
  id: string;
  title: string;
  lines: string[];
  variants: VariantCardData[];
}

const PHASE_LABEL: Record<number, string> = {
  1: "Phase 1 — déficit léger",
  2: "Phase 2 — déficit modéré",
  3: "Phase 3 — déficit important",
};

const MEAL_SECTIONS: ReadonlyArray<{
  key: MealKey;
  title: string;
}> = [
  {
    key: "matin",
    title: "🌅 Petit-déjeuner",
  },
  {
    key: "midi",
    title: "☀️ Déjeuner",
  },
  {
    key: "soir",
    title: "🌙 Dîner",
  },
];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function num(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
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

function asStructured(
  raw: unknown,
): StructuredMeals | null {
  if (!isRecord(raw)) {
    return null;
  }

  if (
    isRecord(raw.matin) ||
    isRecord(raw.midi) ||
    isRecord(raw.soir) ||
    Array.isArray(raw.collations)
  ) {
    return raw as StructuredMeals;
  }

  return null;
}

function getVariants(
  raw: unknown,
): MealVariantSlot[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const variants: MealVariantSlot[] = [];

  raw.forEach((value, index) => {
    if (
      !isRecord(value) ||
      !Array.isArray(value.items)
    ) {
      return;
    }

    variants.push({
      id:
        text(value.id) ||
        `ancienne-variante-${index}`,
      title:
        text(value.title) ||
        `Variante ${index + 1}`,
      items: value.items,
    });
  });

  return variants;
}

function getCollations(
  raw: unknown,
): CollationSlot[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const collations: CollationSlot[] = [];

  raw.forEach((value, index) => {
    if (
      !isRecord(value) ||
      !Array.isArray(value.items)
    ) {
      return;
    }

    collations.push({
      id:
        text(value.id) ||
        `ancienne-collation-${index}`,
      title:
        text(value.title) ||
        `Collation ${index + 1}`,
      items: value.items,
    });
  });

  return collations;
}

function itemLines(items: unknown[]): string[] {
  const lines: string[] = [];

  for (const rawItem of items) {
    if (!isRecord(rawItem)) {
      continue;
    }

    const quantity = text(rawItem.quantity);
    const unit = text(rawItem.unit);
    const name = text(rawItem.name);

    if (!name) {
      continue;
    }

    lines.push(
      [quantity, unit, name]
        .filter(Boolean)
        .join(" "),
    );
  }

  return lines.length > 0
    ? lines
    : ["Aucun aliment renseigné pour ce repas."];
}

function slotLines(
  key: MealKey,
  slot: MealSlot | undefined,
): string[] {
  if (!slot) {
    return ["Aucune indication pour ce repas."];
  }

  if (Array.isArray(slot.items)) {
    return itemLines(slot.items);
  }

  const lines: string[] = [];

  if (key === "matin") {
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
    const name =
      slot.feculent_nom || "féculents";

    if (cru !== null && cru > 0) {
      const cookedLabel =
        cuit !== null && cuit > 0
          ? ` (${cuit} g cuits indiqués dans le programme)`
          : "";

      lines.push(
        `${cru} g crus de ${name}${cookedLabel}`,
      );
    } else {
      lines.push("Pas de féculent à ce repas");
    }
  }

  const lipides = num(slot.lipides_crus_g);

  if (lipides !== null && lipides > 0) {
    lines.push(
      key === "matin"
        ? `${lipides} g de beurre OU ${lipides} g de confiture`
        : `${lipides} g de matières grasses crues`,
    );
  }

  return lines.length > 0
    ? lines
    : ["Aucune indication pour ce repas."];
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date non disponible";
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function FoodLines({
  lines,
}: {
  lines: string[];
}) {
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {lines.map((line, index) => (
        <li
          key={index}
          className="break-words"
        >
          • {line}
        </li>
      ))}
    </ul>
  );
}

function MealDetailCard({
  card,
}: {
  card: MealCardData;
}) {
  const hasVariants = card.variants.length > 0;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold">
        {card.title}
      </p>

      {hasVariants ? (
        <p className="rounded-md bg-primary/5 p-2 text-xs text-muted-foreground">
          Une seule option pour ce repas : le repas
          principal ou l’une des variantes.
        </p>
      ) : null}

      <div className="space-y-2">
        {hasVariants ? (
          <p className="text-xs font-medium">
            Repas principal
          </p>
        ) : null}

        <FoodLines lines={card.lines} />
      </div>

      {card.variants.map((variant, index) => (
        <div
          key={`${variant.id}-${index}`}
          className="space-y-2 rounded-lg border border-primary/15 bg-background p-3"
        >
          <p className="break-words text-xs font-semibold">
            {variant.title}
          </p>

          <FoodLines lines={variant.lines} />
        </div>
      ))}
    </div>
  );
}

function ProgramDetail({
  p,
}: {
  p: Snapshot;
}) {
  const structured = asStructured(p.meals);
  const phase = num(structured?.phase);

  const mealCards: MealCardData[] = [];

  if (structured) {
    MEAL_SECTIONS.forEach((section) => {
      const slot = structured[section.key];

      mealCards.push({
        id: section.key,
        title: section.title,
        lines: slotLines(section.key, slot),
        variants: getVariants(slot?.variants).map(
          (variant) => ({
            id: variant.id,
            title: variant.title,
            lines: itemLines(variant.items),
          }),
        ),
      });
    });

    getCollations(structured.collations).forEach(
      (collation, index) => {
        mealCards.push({
          id: `collation-${collation.id}-${index}`,
          title: `🍎 ${collation.title}`,
          lines: itemLines(collation.items),
          variants: [],
        });
      },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2 py-1 font-medium">
          {p.daily_kcal_target !== null
            ? `${p.daily_kcal_target} kcal`
            : "kcal —"}
        </span>

        <span className="rounded-full bg-muted px-2 py-1">
          Prot. {p.daily_protein_g ?? "—"} g
        </span>

        <span className="rounded-full bg-muted px-2 py-1">
          Gluc. {p.daily_carbs_g ?? "—"} g
        </span>

        <span className="rounded-full bg-muted px-2 py-1">
          Lip. {p.daily_fat_g ?? "—"} g
        </span>

        {phase !== null && PHASE_LABEL[phase] ? (
          <span className="rounded-full bg-[#6DB33F]/15 px-2 py-1 text-[#2D7A1F]">
            {PHASE_LABEL[phase]}
          </span>
        ) : null}
      </div>

      {structured ? (
        <div className="grid items-start gap-3 sm:grid-cols-3">
          {mealCards.map((card) => (
            <MealDetailCard
              key={card.id}
              card={card}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Détail des repas non disponible pour ce
          programme (ancien format ou programme sans
          repas).
        </p>
      )}

      {p.notes ? (
        <p className="whitespace-pre-wrap text-xs italic text-muted-foreground">
          {p.notes}
        </p>
      ) : null}
    </div>
  );
}

export function NutritionProgramHistory({
  patientId,
  refreshKey,
}: {
  patientId: string;
  refreshKey: number;
}) {
  const [current, setCurrent] =
    useState<Snapshot | null>(null);

  const [history, setHistory] =
    useState<Snapshot[]>([]);

  const [loading, setLoading] = useState(true);

  const [errorMsg, setErrorMsg] =
    useState<string | null>(null);

  const [openId, setOpenId] =
    useState<string | null>(null);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [deleteError, setDeleteError] =
    useState<string | null>(null);

  const [successMsg, setSuccessMsg] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrograms() {
      setLoading(true);
      setErrorMsg(null);
      setDeleteError(null);
      setSuccessMsg(null);
      setOpenId(null);

      try {
        const [curRes, histRes] = await Promise.all([
          supabase
            .from("nutrition_programs")
            .select(
              "id, name, start_date, updated_at, created_at, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, meals, notes",
            )
            .eq("patient_id", patientId)
            .maybeSingle(),

          supabase
            .from("nutrition_program_history")
            .select(
              "id, name, created_at, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, meals, notes",
            )
            .eq("patient_id", patientId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (cancelled) {
          return;
        }

        const errors = [
          curRes.error?.message,
          histRes.error?.message,
        ].filter(Boolean);

        if (errors.length > 0) {
          setErrorMsg(errors.join(" — "));
        }

        const currentRow =
          curRes.data as CurrentRow | null;

        setCurrent(
          currentRow
            ? {
                id: currentRow.id,
                name: currentRow.name,
                date:
                  currentRow.updated_at ??
                  currentRow.start_date ??
                  currentRow.created_at,
                daily_kcal_target:
                  currentRow.daily_kcal_target,
                daily_protein_g:
                  currentRow.daily_protein_g,
                daily_carbs_g:
                  currentRow.daily_carbs_g,
                daily_fat_g:
                  currentRow.daily_fat_g,
                meals: currentRow.meals,
                notes: currentRow.notes,
              }
            : null,
        );

        const rows =
          (histRes.data ?? []) as HistoryRow[];

        setHistory(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            date: row.created_at,
            daily_kcal_target:
              row.daily_kcal_target,
            daily_protein_g:
              row.daily_protein_g,
            daily_carbs_g:
              row.daily_carbs_g,
            daily_fat_g:
              row.daily_fat_g,
            meals: row.meals,
            notes: row.notes,
          })),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMsg(
          error instanceof Error
            ? error.message
            : "Impossible de charger les programmes.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [patientId, refreshKey]);

  async function deleteHistoryProgram(
    snapshot: Snapshot,
  ) {
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement de l’historique « ${
        snapshot.name ?? "Programme"
      } » du ${formatDate(snapshot.date)} ?\n\n` +
        "Cette action est irréversible.\n" +
        "Le programme actuel du patient ne sera pas supprimé.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(snapshot.id);
    setDeleteError(null);
    setSuccessMsg(null);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error(
          "Votre session a expiré. Reconnectez-vous avant de supprimer ce programme.",
        );
      }

      const {
        data: deletedRows,
        error: deletionError,
      } = await supabase
        .from("nutrition_program_history")
        .delete()
        .eq("id", snapshot.id)
        .eq("patient_id", patientId)
        .eq("pro_id", authData.user.id)
        .select("id");

      if (deletionError) {
        throw new Error(deletionError.message);
      }

      if (!deletedRows || deletedRows.length !== 1) {
        throw new Error(
          "La suppression n’a pas été confirmée. Le programme a peut-être déjà été supprimé ou vos droits ne permettent pas cette action. Rechargez la page pour vérifier.",
        );
      }

      setHistory((previous) =>
        previous.filter(
          (item) => item.id !== snapshot.id,
        ),
      );

      setOpenId((previous) =>
        previous === snapshot.id
          ? null
          : previous,
      );

      setSuccessMsg(
        "Ancien programme supprimé de l’historique. Le programme actuel est conservé.",
      );
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer ce programme.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="space-y-4">
      {errorMsg ? (
        <p
          role="alert"
          className="text-xs text-destructive"
        >
          {errorMsg}
        </p>
      ) : null}

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h4 className="text-sm font-semibold">
          📌 Programme actuel du patient
        </h4>

        {current ? (
          <>
            <p className="text-xs text-muted-foreground">
              {current.name ?? "Programme"} — mis à jour
              le {formatDate(current.date)}
            </p>

            <ProgramDetail p={current} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun programme enregistré pour ce patient.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">
            🕘 Historique des programmes donnés (
            {history.length})
          </h4>

          <p className="text-xs text-muted-foreground">
            Supprimer une entrée de l’historique ne
            supprime pas le programme actuel du patient.
          </p>
        </div>

        {deleteError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
          >
            {deleteError}
          </p>
        ) : null}

        {successMsg ? (
          <p
            role="status"
            className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {successMsg}
          </p>
        ) : null}

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun ancien programme dans l’historique.
          </p>
        ) : (
          history.map((snapshot) => {
            const open = openId === snapshot.id;
            const deleting =
              deletingId === snapshot.id;

            return (
              <div
                key={snapshot.id}
                className="rounded-lg border bg-muted/20"
              >
                <div className="flex flex-wrap items-center gap-2 p-2">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenId(
                        open ? null : snapshot.id,
                      )
                    }
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2 py-2 text-left"
                  >
                    <span className="text-sm">
                      <span className="font-medium">
                        {formatDate(snapshot.date)}
                      </span>

                      <span className="ml-2 text-muted-foreground">
                        {snapshot.name ?? "Programme"}

                        {snapshot.daily_kcal_target !== null
                          ? ` · ${snapshot.daily_kcal_target} kcal`
                          : ""}
                      </span>
                    </span>

                    {open ? (
                      <ChevronUp className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                  </button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deletingId !== null}
                    className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Supprimer de l’historique ${
                      snapshot.name ?? "ce programme"
                    } du ${formatDate(snapshot.date)}`}
                    onClick={() =>
                      void deleteHistoryProgram(
                        snapshot,
                      )
                    }
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {deleting
                      ? "Suppression…"
                      : "Supprimer"}
                  </Button>
                </div>

                {open ? (
                  <div className="border-t px-3 py-3">
                    <ProgramDetail p={snapshot} />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}