import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Utensils,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Check,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DailyJournal } from "@/components/nutrition/DailyJournal";
import { NutritionTips } from "@/components/nutrition/NutritionTips";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/nutrition")({
  head: () => ({
    meta: [
      {
        title: "Mon plan nutritionnel — DietFitPro",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <Content />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

type SlotKey = "matin" | "midi" | "soir";

const SLOTS: ReadonlyArray<{
  key: SlotKey;
  title: string;
  emoji: string;
}> = [
  {
    key: "matin",
    title: "Petit-déjeuner",
    emoji: "🌅",
  },
  {
    key: "midi",
    title: "Déjeuner",
    emoji: "☀️",
  },
  {
    key: "soir",
    title: "Dîner",
    emoji: "🌙",
  },
];

const PHASE_LABEL: Record<number, string> = {
  1: "Phase 1 — déficit léger",
  2: "Phase 2 — déficit modéré",
  3: "Phase 3 — déficit important",
};

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

interface VariantDisplay {
  id: string;
  title: string;
  lines: string[];
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

interface LegacyMeal {
  id: string;
  moment: "matin" | "midi" | "soir" | "collation";
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface ProgramRow {
  id: string;
  name: string;
  start_date: string | null;
  daily_kcal_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  notes: string | null;
  meals: unknown;
  pro_id: string | null;
}

interface ParsedMeals {
  structured: StructuredMeals | null;
  legacy: LegacyMeal[];
}

interface PatientDocumentRow {
  id: string;
  title: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string | null;
}

interface ProgramPdfRow {
  id: string;
  name: string | null;
  pdf_url: string | null;
}

interface NutritionDocument {
  id: string;
  title: string;
  fileName: string | null;
  date: string | null;
  bucket: "message-attachments" | "program-pdfs";
  path: string;
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

function isLegacyMeal(
  value: unknown,
): value is LegacyMeal {
  if (!isRecord(value)) {
    return false;
  }

  const validMoment =
    value.moment === "matin" ||
    value.moment === "midi" ||
    value.moment === "soir" ||
    value.moment === "collation";

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    validMoment &&
    num(value.kcal) !== null &&
    num(value.protein_g) !== null &&
    num(value.carbs_g) !== null &&
    num(value.fat_g) !== null
  );
}

function parseMeals(raw: unknown): ParsedMeals {
  if (Array.isArray(raw)) {
    return {
      structured: null,
      legacy: raw.filter(isLegacyMeal),
    };
  }

  if (
    isRecord(raw) &&
    (
      isRecord(raw.matin) ||
      isRecord(raw.midi) ||
      isRecord(raw.soir) ||
      Array.isArray(raw.collations)
    )
  ) {
    return {
      structured: raw as StructuredMeals,
      legacy: [],
    };
  }

  return {
    structured: null,
    legacy: [],
  };
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

function buildLines(
  key: SlotKey,
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
    const name = slot.feculent_nom || "féculents";

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
        : `${lipides} g de matières grasses crues (huile d’olive ou colza)`,
    );
  }

  return lines.length > 0
    ? lines
    : ["Aucune indication pour ce repas."];
}

function formatProgramDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return format(date, "dd MMMM yyyy", {
    locale: fr,
  });
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function doneKey(
  programId: string,
  date: string,
): string {
  return `dfp:meal-done:${programId}:${date}`;
}

function loadDone(
  programId: string,
  date: string,
): Set<string> {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(
        doneKey(programId, date),
      ) ?? "[]",
    );

    if (!Array.isArray(stored)) {
      return new Set<string>();
    }

    return new Set(
      stored.filter(
        (value): value is string =>
          typeof value === "string",
      ),
    );
  } catch {
    return new Set<string>();
  }
}

function saveDone(
  programId: string,
  date: string,
  values: Set<string>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      doneKey(programId, date),
      JSON.stringify([...values]),
    );
  } catch {
    // Le suivi reste utilisable sans stockage local.
  }
}

function NutritionDocuments({
  patientId,
}: {
  patientId: string;
}) {
  const [documents, setDocuments] = useState<
    NutritionDocument[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<
    string[]
  >([]);
  const [openingId, setOpeningId] = useState<
    string | null
  >(null);
  const [openError, setOpenError] = useState<
    string | null
  >(null);
  const [fallbackLink, setFallbackLink] = useState<{
    title: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setLoading(true);
      setLoadErrors([]);
      setOpenError(null);
      setFallbackLink(null);
      setDocuments([]);

      try {
        const results = await Promise.allSettled([
          supabase
            .from("patient_documents")
            .select(
              "id, title, file_url, file_name, created_at",
            )
            .eq("patient_id", patientId)
            .eq("category", "nutrition")
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("nutrition_programs")
            .select("id, name, pdf_url")
            .eq("patient_id", patientId)
            .eq("is_active", true)
            .order("created_at", {
              ascending: false,
            })
            .limit(1),
        ]);

        if (cancelled) {
          return;
        }

        const loaded: NutritionDocument[] = [];
        const errors: string[] = [];

        const documentsResult = results[0];

        if (documentsResult.status === "fulfilled") {
          const response = documentsResult.value;

          if (response.error) {
            errors.push(
              "Documents de la fiche patient : " +
                response.error.message,
            );
          } else {
            const rows =
              (response.data ?? []) as PatientDocumentRow[];

            rows.forEach((row) => {
              const path = row.file_url?.trim();

              if (!path) {
                errors.push(
                  `Le document « ${
                    row.title || row.file_name || "PDF"
                  } » ne possède pas de chemin de fichier.`,
                );
                return;
              }

              loaded.push({
                id: `document:${row.id}`,
                title:
                  row.title?.trim() ||
                  row.file_name ||
                  "Document nutrition",
                fileName: row.file_name,
                date: row.created_at,
                bucket: "message-attachments",
                path,
              });
            });
          }
        } else {
          errors.push(
            "Impossible de charger les documents de la fiche patient.",
          );
        }

        const programResult = results[1];

        if (programResult.status === "fulfilled") {
          const response = programResult.value;

          if (response.error) {
            errors.push(
              "PDF du programme actif : " +
                response.error.message,
            );
          } else {
            const rows =
              (response.data ?? []) as ProgramPdfRow[];

            rows.forEach((row) => {
              const path = row.pdf_url?.trim();

              if (!path) {
                return;
              }

              loaded.push({
                id: `program:${row.id}`,
                title:
                  row.name?.trim() ||
                  "PDF du programme actif",
                fileName: null,
                date: null,
                bucket: "program-pdfs",
                path,
              });
            });
          }
        } else {
          errors.push(
            "Impossible de charger le PDF du programme actif.",
          );
        }

        const seen = new Set<string>();

        const uniqueDocuments = loaded.filter(
          (document) => {
            const key =
              `${document.bucket}:${document.path}`;

            if (seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          },
        );

        setDocuments(uniqueDocuments);
        setLoadErrors(errors);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadErrors([
          error instanceof Error
            ? error.message
            : "Impossible de charger les documents.",
        ]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  async function openDocument(
    document: NutritionDocument,
  ) {
    if (openingId !== null) {
      return;
    }

    setOpeningId(document.id);
    setOpenError(null);
    setFallbackLink(null);

    // Ouvrir l’onglet pendant le clic évite certains blocages de popup.
    const tab = window.open("about:blank", "_blank");

    if (tab) {
      tab.opener = null;
    }

    try {
      // Les imports existants enregistrent un chemin Storage,
      // pas un lien public ni une ancienne URL signée.
      if (/^[a-z][a-z0-9+.-]*:/i.test(document.path)) {
        throw new Error(
          "Ce document contient une URL au lieu d’un chemin de stockage. Son format doit être vérifié avant ouverture.",
        );
      }

      const { data, error } =
        await supabase.storage
          .from(document.bucket)
          .createSignedUrl(document.path, 300);

      if (error || !data?.signedUrl) {
        throw new Error(
          error?.message ||
            "Aucun lien d’ouverture n’a été retourné.",
        );
      }

      if (tab && !tab.closed) {
        tab.location.replace(data.signedUrl);
      } else {
        setFallbackLink({
          title: document.title,
          url: data.signedUrl,
        });
      }
    } catch (error) {
      if (tab && !tab.closed) {
        tab.close();
      }

      setOpenError(
        `Impossible d’ouvrir « ${document.title} » : ${
          error instanceof Error
            ? error.message
            : "erreur inconnue"
        }`,
      );
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Mes documents nutrition
        </CardTitle>

        <CardDescription>
          Retrouvez les documents partagés par votre
          praticien et le PDF de votre programme actif.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </>
        ) : (
          <>
            {loadErrors.map((message, index) => (
              <p
                key={index}
                role="alert"
                className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
              >
                {message}
              </p>
            ))}

            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {loadErrors.length > 0
                  ? "La liste des documents n’a pas pu être chargée complètement."
                  : "Aucun document nutrition disponible pour le moment."}
              </p>
            ) : (
              documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/20 p-4"
                >
                  <FileText className="h-7 w-7 shrink-0 text-primary" />

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">
                      {document.title}
                    </p>

                    {document.fileName &&
                    document.fileName !== document.title ? (
                      <p className="break-words text-xs text-muted-foreground">
                        {document.fileName}
                      </p>
                    ) : null}

                    {document.date ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ajouté le{" "}
                        {formatProgramDate(document.date)}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={openingId !== null}
                    onClick={() =>
                      void openDocument(document)
                    }
                  >
                    {openingId === document.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-1 h-4 w-4" />
                    )}

                    {openingId === document.id
                      ? "Ouverture…"
                      : "Ouvrir le PDF"}
                  </Button>
                </div>
              ))
            )}

            {openError ? (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
              >
                {openError}
              </p>
            ) : null}

            {fallbackLink ? (
              <div
                role="status"
                className="space-y-2 rounded-xl border p-3 text-sm"
              >
                <p>
                  Le navigateur n’a pas ouvert le nouvel
                  onglet. Utilisez ce lien temporaire :
                </p>

                <a
                  href={fallbackLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-primary underline"
                >
                  Ouvrir {fallbackLink.title}
                </a>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Content() {
  const { user, profile } = useAuth();
  const userId = user?.id;

  const [patientId, setPatientId] = useState<
    string | null
  >(null);

  const [program, setProgram] = useState<
    ProgramRow | null | undefined
  >(undefined);

  const [proName, setProName] = useState("");
  const [errorMsg, setErrorMsg] = useState<
    string | null
  >(null);

  const [done, setDone] = useState<Set<string>>(
    new Set<string>(),
  );

  useEffect(() => {
    if (!userId) {
      return;
    }

    const currentUserId = userId;
    let cancelled = false;

    async function loadProgram() {
      setProgram(undefined);
      setPatientId(null);
      setProName("");
      setErrorMsg(null);
      setDone(new Set<string>());

      try {
        const {
          data: patientData,
          error: patientError,
        } = await supabase
          .from("patients")
          .select("id")
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (patientError) {
          setErrorMsg(patientError.message);
          setProgram(null);
          return;
        }

        const loadedPatientId = (
          patientData as { id?: string } | null
        )?.id;

        if (!loadedPatientId) {
          setProgram(null);
          return;
        }

        setPatientId(loadedPatientId);

        const { data, error } = await supabase
          .from("nutrition_programs")
          .select(
            "id, name, start_date, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, notes, meals, pro_id",
          )
          .eq("patient_id", loadedPatientId)
          .eq("is_active", true)
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

        if (cancelled) {
          return;
        }

        if (error) {
          setErrorMsg(error.message);
          setProgram(null);
          return;
        }

        const row =
          (data?.[0] as ProgramRow | undefined) ??
          null;

        setProgram(row);

        if (!row) {
          return;
        }

        setDone(loadDone(row.id, todayIso()));

        if (row.pro_id) {
          const { data: practitioner } =
            await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", row.pro_id)
              .maybeSingle();

          if (!cancelled) {
            setProName(
              (
                practitioner as {
                  full_name?: string;
                } | null
              )?.full_name ?? "",
            );
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMsg(
          error instanceof Error
            ? error.message
            : "Impossible de charger votre plan nutritionnel.",
        );

        setProgram(null);
      }
    }

    void loadProgram();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const firstName =
    profile?.full_name?.split(" ")[0] ?? "vous";

  function toggleDone(slotKey: string) {
    if (!program) {
      return;
    }

    const next = new Set(done);

    if (next.has(slotKey)) {
      next.delete(slotKey);
    } else {
      next.add(slotKey);
    }

    setDone(next);
    saveDone(program.id, todayIso(), next);
  }

  if (program === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />

          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  const parsed: ParsedMeals = program
    ? parseMeals(program.meals)
    : {
        structured: null,
        legacy: [],
      };

  const structured = parsed.structured;
  const phase = num(structured?.phase);
  const collations = getCollations(
    structured?.collations,
  );

  const hasMeals =
    structured !== null ||
    parsed.legacy.length > 0;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="rounded-3xl border shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Utensils className="h-6 w-6" />
              </div>

              <div>
                <CardTitle className="text-xl sm:text-2xl">
                  Nutrition
                </CardTitle>

                <CardDescription className="mt-1 text-sm sm:text-base">
                  Bonjour {firstName}, retrouvez ici
                  vos documents, votre plan alimentaire
                  et vos objectifs du jour.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {patientId ? (
          <NutritionDocuments
            key={patientId}
            patientId={patientId}
          />
        ) : null}

        {errorMsg ? (
          <Card className="rounded-3xl border border-destructive/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Impossible de charger votre plan
              </CardTitle>

              <CardDescription>
                {errorMsg}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!program ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard
                icon={<Flame className="h-5 w-5" />}
                title="Apport journalier"
                value="À définir"
                subtitle="Votre praticien précisera votre cible"
              />

              <InfoCard
                icon={<Beef className="h-5 w-5" />}
                title="Protéines"
                value="À définir"
                subtitle="Objectif personnalisé à venir"
              />

              <InfoCard
                icon={<Wheat className="h-5 w-5" />}
                title="Glucides"
                value="À définir"
                subtitle="Adapté à votre profil"
              />

              <InfoCard
                icon={<Droplets className="h-5 w-5" />}
                title="Lipides"
                value="À définir"
                subtitle="Répartition à venir"
              />
            </div>

            {!errorMsg ? (
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle>
                    Aucun programme actif
                  </CardTitle>

                  <CardDescription>
                    Aucun plan alimentaire actif n’est
                    disponible pour le moment. Vos
                    documents partagés restent accessibles
                    dans la section ci-dessus.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            <NutritionTips />
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard
                icon={<Flame className="h-5 w-5" />}
                title="Apport journalier"
                value={
                  program.daily_kcal_target !== null
                    ? `${program.daily_kcal_target} kcal`
                    : "—"
                }
                subtitle={
                  proName
                    ? `Programme par ${proName}`
                    : "Cible énergétique"
                }
              />

              <InfoCard
                icon={<Beef className="h-5 w-5" />}
                title="Protéines"
                value={
                  program.daily_protein_g !== null
                    ? `${program.daily_protein_g} g`
                    : "—"
                }
                subtitle="Référence journalière"
              />

              <InfoCard
                icon={<Wheat className="h-5 w-5" />}
                title="Glucides"
                value={
                  program.daily_carbs_g !== null
                    ? `${program.daily_carbs_g} g`
                    : "—"
                }
                subtitle="Répartition alimentaire"
              />

              <InfoCard
                icon={<Droplets className="h-5 w-5" />}
                title="Lipides"
                value={
                  program.daily_fat_g !== null
                    ? `${program.daily_fat_g} g`
                    : "—"
                }
                subtitle="Équilibre nutritionnel"
              />
            </div>

            <Card className="rounded-3xl border shadow-sm">
              <CardHeader>
                <CardTitle>
                  {program.name}
                </CardTitle>

                <CardDescription>
                  {phase !== null &&
                  PHASE_LABEL[phase]
                    ? `${PHASE_LABEL[phase]} · `
                    : ""}
                  Plan actif depuis le{" "}
                  {formatProgramDate(
                    program.start_date,
                  )}
                </CardDescription>
              </CardHeader>
            </Card>

            <p className="text-xs text-muted-foreground">
              Aujourd’hui —{" "}
              {format(new Date(), "EEEE dd MMMM", {
                locale: fr,
              })}
            </p>

            {!hasMeals ? (
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Détail des repas en préparation
                  </CardTitle>

                  <CardDescription>
                    Votre praticien finalise votre plan.
                    Consultez aussi vos documents PDF.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : structured ? (
              <div className="space-y-6">
                <div className="grid items-start gap-4 lg:grid-cols-3">
                  {SLOTS.map((slot) => {
                    const meal = structured[slot.key];

                    const variants: VariantDisplay[] =
                      getVariants(meal?.variants).map(
                        (variant) => ({
                          id: variant.id,
                          title: variant.title,
                          lines: itemLines(
                            variant.items,
                          ),
                        }),
                      );

                    return (
                      <SlotCard
                        key={slot.key}
                        title={`${slot.emoji} ${slot.title}`}
                        lines={buildLines(
                          slot.key,
                          meal,
                        )}
                        variants={variants}
                        checked={done.has(slot.key)}
                        onToggle={() =>
                          toggleDone(slot.key)
                        }
                      />
                    );
                  })}
                </div>

                {collations.length > 0 ? (
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold">
                      Mes collations
                    </h2>

                    <div className="grid items-start gap-4 lg:grid-cols-3">
                      {collations.map(
                        (collation, index) => {
                          const collationDoneKey =
                            `collation:${collation.id}`;

                          return (
                            <SlotCard
                              key={`${collation.id}-${index}`}
                              title={`🍎 ${collation.title}`}
                              lines={itemLines(
                                collation.items,
                              )}
                              checked={done.has(
                                collationDoneKey,
                              )}
                              onToggle={() =>
                                toggleDone(
                                  collationDoneKey,
                                )
                              }
                            />
                          );
                        },
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <LegacyMeals
                meals={parsed.legacy}
              />
            )}

            {program.notes ? (
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader>
                  <CardTitle>
                    Notes du praticien
                  </CardTitle>

                  <CardDescription>
                    Consignes complémentaires liées
                    à votre plan alimentaire.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {program.notes}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {user ? (
              <DailyJournal
                userId={user.id}
                retentionDays={270}
              />
            ) : null}

            <NutritionTips />

            <p className="text-center text-xs text-muted-foreground">
              Ce plan ne remplace pas un avis médical.
              En cas de doute, contactez votre praticien.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function FoodLines({
  lines,
}: {
  lines: string[];
}) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {lines.map((line, index) => (
        <li
          key={`${index}-${line}`}
          className="break-words rounded-xl bg-muted/30 px-3 py-2"
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function SlotCard({
  title,
  lines,
  variants = [],
  checked,
  onToggle,
}: {
  title: string;
  lines: string[];
  variants?: VariantDisplay[];
  checked: boolean;
  onToggle: () => void;
}) {
  const hasVariants = variants.length > 0;

  return (
    <Card
      className={cn(
        "rounded-3xl border shadow-sm",
        checked &&
          "border-[#6DB33F]/50 bg-[#6DB33F]/5",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">
          {title}
        </CardTitle>

        <Button
          type="button"
          size="sm"
          variant={
            checked ? "default" : "outline"
          }
          aria-pressed={checked}
          className={cn(
            checked &&
              "bg-[#6DB33F] text-white hover:bg-[#2D7A1F]",
          )}
          onClick={onToggle}
        >
          <Check className="mr-1 h-4 w-4" />
          {checked ? "Fait" : "Valider"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasVariants ? (
          <p className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
            Choisissez une seule option pour ce repas :
            le repas principal ou l’une des variantes
            ci-dessous. Ne cumulez pas les options.
          </p>
        ) : null}

        <div className="space-y-2">
          {hasVariants ? (
            <h3 className="text-sm font-semibold">
              Repas principal
            </h3>
          ) : null}

          <FoodLines lines={lines} />
        </div>

        {variants.map((variant, index) => (
          <div
            key={`${variant.id}-${index}`}
            className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-3"
          >
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Alternative au repas principal
              </p>

              <h3 className="break-words text-sm font-semibold">
                {variant.title}
              </h3>
            </div>

            <FoodLines lines={variant.lines} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LegacyMeals({
  meals,
}: {
  meals: LegacyMeal[];
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">
          Vos repas
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {meals.map((meal) => (
          <div
            key={meal.id}
            className="rounded-2xl bg-muted/30 px-3 py-3"
          >
            <div className="text-sm font-medium">
              {meal.name}
            </div>

            <div className="text-xs text-muted-foreground">
              {meal.kcal} kcal ·{" "}
              {meal.protein_g} g prot ·{" "}
              {meal.carbs_g} g gluc ·{" "}
              {meal.fat_g} g lip
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InfoCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>

        <div className="text-sm text-muted-foreground">
          {title}
        </div>

        <div className="mt-1 text-lg font-semibold">
          {value}
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {subtitle}
        </div>
      </CardContent>
    </Card>
  );
}