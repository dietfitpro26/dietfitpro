import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

interface MealSlot {
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
  matin?: MealSlot;
  midi?: MealSlot;
  soir?: MealSlot;
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

const PHASE_LABEL: Record<number, string> = {
  1: "Phase 1 — déficit léger",
  2: "Phase 2 — déficit modéré",
  3: "Phase 3 — déficit important",
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStructured(raw: unknown): StructuredMeals | null {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const obj = raw as StructuredMeals;
    if (obj.matin || obj.midi || obj.soir) return obj;
  }
  return null;
}

function slotLines(key: "matin" | "midi" | "soir", slot: MealSlot | undefined): string[] {
  if (!slot) return ["Aucune indication."];
  const lines: string[] = [];

  if (key === "matin") {
    const pain = num(slot.pain_cereales_g);
    if (pain) lines.push(`${pain} g de pain aux céréales`);
    if (slot.proteines !== false) lines.push("Source de protéines (yaourt, œuf…)");
  } else {
    if (slot.proteines !== false) lines.push("Portion de protéines");
    lines.push(`Légumes : ${slot.legumes || "à volonté"}`);
    const cru = num(slot.feculent_cru_g);
    if (cru && cru > 0) {
      const cuit = num(slot.feculent_cuit_g) ?? cru * 2;
      lines.push(`${slot.feculent_nom || "Féculent"} : ${cru} g cru (${cuit} g cuit)`);
    } else {
      lines.push("Pas de féculent");
    }
  }

  const lipides = num(slot.lipides_crus_g);
  if (lipides) {
    lines.push(
      key === "matin"
        ? `${lipides} g de beurre OU ${lipides} g de confiture`
        : `${lipides} g de matières grasses crues`,
    );
  }
  return lines;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ProgramDetail({ p }: { p: Snapshot }) {
  const structured = asStructured(p.meals);
  const phase = structured?.phase ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2 py-1 font-medium">
          {p.daily_kcal_target ? `${p.daily_kcal_target} kcal` : "kcal —"}
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
        {phase && PHASE_LABEL[phase] ? (
          <span className="rounded-full bg-[#6DB33F]/15 px-2 py-1 text-[#2D7A1F]">
            {PHASE_LABEL[phase]}
          </span>
        ) : null}
      </div>

      {structured ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              { key: "matin", title: "🌅 Petit-déjeuner" },
              { key: "midi", title: "☀️ Déjeuner" },
              { key: "soir", title: "🌙 Dîner" },
            ] as const
          ).map((s) => (
            <div key={s.key} className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-1 text-xs font-semibold">{s.title}</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {slotLines(s.key, structured[s.key]).map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Détail des repas non disponible pour ce programme (ancien format ou programme sans repas).
        </p>
      )}

      {p.notes ? (
        <p className="whitespace-pre-wrap text-xs italic text-muted-foreground">{p.notes}</p>
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
  const [current, setCurrent] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErrorMsg(null);

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
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (curRes.error || histRes.error) {
        setErrorMsg(curRes.error?.message ?? histRes.error?.message ?? "Erreur de chargement");
      }

      const c = curRes.data as
        | (Omit<Snapshot, "date"> & {
            start_date: string | null;
            updated_at: string | null;
            created_at: string;
          })
        | null;

      setCurrent(
        c
          ? {
              id: c.id,
              name: c.name,
              date: c.updated_at ?? c.start_date ?? c.created_at,
              daily_kcal_target: c.daily_kcal_target,
              daily_protein_g: c.daily_protein_g,
              daily_carbs_g: c.daily_carbs_g,
              daily_fat_g: c.daily_fat_g,
              meals: c.meals,
              notes: c.notes,
            }
          : null,
      );

      const rows = (histRes.data ?? []) as Array<Omit<Snapshot, "date"> & { created_at: string }>;
      setHistory(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          date: r.created_at,
          daily_kcal_target: r.daily_kcal_target,
          daily_protein_g: r.daily_protein_g,
          daily_carbs_g: r.daily_carbs_g,
          daily_fat_g: r.daily_fat_g,
          meals: r.meals,
          notes: r.notes,
        })),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, refreshKey]);

  if (loading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      {errorMsg ? <p className="text-xs text-destructive">{errorMsg}</p> : null}

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h4 className="text-sm font-semibold">📌 Programme actuel du patient</h4>
        {current ? (
          <>
            <p className="text-xs text-muted-foreground">
              {current.name ?? "Programme"} — mis à jour le {formatDate(current.date)}
            </p>
            <ProgramDetail p={current} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun programme enregistré pour ce patient.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-lg border bg-card p-4">
        <h4 className="text-sm font-semibold">
          🕘 Historique des programmes donnés ({history.length})
        </h4>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            L'historique se remplira à chaque programme validé.
          </p>
        ) : (
          history.map((h) => {
            const open = openId === h.id;
            return (
              <div key={h.id} className="rounded-lg border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : h.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                >
                  <span className="text-sm">
                    <span className="font-medium">{formatDate(h.date)}</span>
                    <span className="ml-2 text-muted-foreground">
                      {h.name ?? "Programme"}
                      {h.daily_kcal_target ? ` · ${h.daily_kcal_target} kcal` : ""}
                    </span>
                  </span>
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {open ? (
                  <div className="border-t px-3 py-3">
                    <ProgramDetail p={h} />
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