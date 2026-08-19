import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  Dumbbell,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Ruler,
  Scale,
  ShieldCheck,
  Target,
  Trash2,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface PatientQuickPanelProps {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

interface Patient {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  goal: string | null;
  is_active: boolean;
}

interface Measurement {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  waist_cm: number | null;
}

interface PatientAccess {
  access_recipes: boolean;
  access_sport_programs: boolean;
  access_nutrition_programs: boolean;
  access_messaging: boolean;
  access_visio: boolean;
  access_ai_coach: boolean;
  access_premium_content: boolean;
}

const DEFAULT_ACCESS: PatientAccess = {
  access_recipes: true,
  access_sport_programs: true,
  access_nutrition_programs: true,
  access_messaging: true,
  access_visio: false,
  access_ai_coach: false,
  access_premium_content: false,
};

const GOAL_LABEL: Record<string, string> = {
  perte_de_poids: "Perte de poids",
  prise_de_masse: "Prise de masse",
  maintien: "Maintien",
  autre: "Autre",
};

function calculateBmi(
  weight: number | null,
  height: number | null,
): number | null {
  if (!weight || !height || height <= 0) return null;

  return Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("fr-FR");
}

export function PatientQuickPanel({
  patientId,
  open,
  onOpenChange,
  onUpdated,
}: PatientQuickPanelProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [latestMeasurement, setLatestMeasurement] =
    useState<Measurement | null>(null);
  const [access, setAccess] = useState<PatientAccess>(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [measurementDate, setMeasurementDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [measurementWeight, setMeasurementWeight] = useState("");
  const [measurementFat, setMeasurementFat] = useState("");
  const [measurementMuscle, setMeasurementMuscle] = useState("");
  const [measurementWaist, setMeasurementWaist] = useState("");

  useEffect(() => {
    if (!open || !patientId) return;

    let cancelled = false;

    async function loadPanel() {
      setLoading(true);
      setPatient(null);
      setLatestMeasurement(null);
      setAccess(DEFAULT_ACCESS);

      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select(
          "id, user_id, first_name, last_name, email, phone, birth_date, height_cm, weight_kg, target_weight_kg, goal, is_active",
        )
        .eq("id", patientId)
        .maybeSingle();

      if (cancelled) return;

      if (patientError) {
        toast.error(patientError.message);
        setLoading(false);
        return;
      }

      if (!patientData) {
        toast.error("Patient introuvable.");
        setLoading(false);
        return;
      }

      const patientRow = patientData as Patient;
      setPatient(patientRow);

      const { data: measurementData } = await supabase
        .from("body_measurements")
        .select(
          "id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm",
        )
        .eq("patient_id", patientId)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (measurementData) {
        setLatestMeasurement(measurementData as Measurement);
      }

      if (patientRow.user_id) {
        const { data: accessData } = await supabase
          .from("subscriber_overrides")
          .select(
            "access_recipes, access_sport_programs, access_nutrition_programs, access_messaging, access_visio, access_ai_coach, access_premium_content",
          )
          .eq("user_id", patientRow.user_id)
          .maybeSingle();

        if (accessData) {
          setAccess({
            ...DEFAULT_ACCESS,
            ...(accessData as Partial<PatientAccess>),
          });
        }
      }

      setLoading(false);
    }

    void loadPanel();

    return () => {
      cancelled = true;
    };
  }, [open, patientId]);

  const initials = useMemo(() => {
    if (!patient) return "?";

    return `${patient.first_name[0] ?? ""}${patient.last_name[0] ?? ""}`
      .toUpperCase()
      .slice(0, 2);
  }, [patient]);

  const bmi = calculateBmi(
    latestMeasurement?.weight_kg ?? patient?.weight_kg ?? null,
    patient?.height_cm ?? null,
  );

  async function handleSaveAccess() {
    if (!patient?.user_id) {
      toast.error(
        "Ce patient n’a pas encore de compte utilisateur. Envoyez-lui une invitation.",
      );
      return;
    }

    setSavingAccess(true);

    const { error } = await supabase.from("subscriber_overrides").upsert(
      {
        user_id: patient.user_id,
        ...access,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

    setSavingAccess(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Options du patient mises à jour.");
    onUpdated?.();
  }

  async function handleSaveMeasurement() {
    if (!patient) return;

    if (!measurementWeight && !measurementFat && !measurementMuscle) {
      toast.error("Renseigne au moins une mesure.");
      return;
    }

    setSavingMeasurement(true);

    const { error } = await supabase.from("body_measurements").insert({
      patient_id: patient.id,
      user_id: patient.user_id,
      measured_at: measurementDate,
      weight_kg: measurementWeight
        ? Number(measurementWeight)
        : null,
      body_fat_pct: measurementFat ? Number(measurementFat) : null,
      muscle_mass_kg: measurementMuscle
        ? Number(measurementMuscle)
        : null,
      waist_cm: measurementWaist ? Number(measurementWaist) : null,
    });

    setSavingMeasurement(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Mesure ajoutée.");
    setMeasurementWeight("");
    setMeasurementFat("");
    setMeasurementMuscle("");
    setMeasurementWaist("");
    setLatestMeasurement({
      id: `local-${Date.now()}`,
      measured_at: measurementDate,
      weight_kg: measurementWeight ? Number(measurementWeight) : null,
      body_fat_pct: measurementFat ? Number(measurementFat) : null,
      muscle_mass_kg: measurementMuscle
        ? Number(measurementMuscle)
        : null,
      waist_cm: measurementWaist ? Number(measurementWaist) : null,
    });
    onUpdated?.();
  }

  const accessItems: Array<{
    key: keyof PatientAccess;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      key: "access_nutrition_programs",
      label: "Programme nutrition",
      icon: <Utensils className="h-4 w-4" />,
    },
    {
      key: "access_sport_programs",
      label: "Programme sport",
      icon: <Dumbbell className="h-4 w-4" />,
    },
    {
      key: "access_recipes",
      label: "Recettes",
      icon: <Target className="h-4 w-4" />,
    },
    {
      key: "access_messaging",
      label: "Messagerie",
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      key: "access_visio",
      label: "Visio",
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      key: "access_ai_coach",
      label: "Coach IA",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      key: "access_premium_content",
      label: "Contenu Premium",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader className="pr-8">
          <SheetTitle>Fiche rapide patient</SheetTitle>
          <SheetDescription>
            Consulte et modifie les informations principales du patient.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !patient ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Patient introuvable.
          </div>
        ) : (
          <div className="space-y-6 py-6">
            <section className="flex items-center gap-3 rounded-2xl bg-primary/5 p-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/15 font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">
                  {patient.first_name} {patient.last_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {patient.goal ? GOAL_LABEL[patient.goal] : "Objectif non défini"}
                </p>
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    patient.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {patient.is_active ? "Patient actif" : "Patient inactif"}
                </span>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <InfoCard
                label="Poids actuel"
                value={
                  latestMeasurement?.weight_kg
                    ? `${latestMeasurement.weight_kg} kg`
                    : patient.weight_kg
                      ? `${patient.weight_kg} kg`
                      : "—"
                }
                icon={<Scale className="h-4 w-4" />}
              />
              <InfoCard
                label="Poids cible"
                value={
                  patient.target_weight_kg
                    ? `${patient.target_weight_kg} kg`
                    : "—"
                }
                icon={<Target className="h-4 w-4" />}
              />
              <InfoCard
                label="IMC"
                value={bmi ? String(bmi) : "—"}
                icon={<Activity className="h-4 w-4" />}
              />
              <InfoCard
                label="Dernière mesure"
                value={formatDate(latestMeasurement?.measured_at ?? null)}
                icon={<Ruler className="h-4 w-4" />}
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Informations principales</h3>
                  <p className="text-xs text-muted-foreground">
                    Coordonnées et données de suivi.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() =>
                    toast.info(
                      "La modification détaillée est disponible dans la fiche complète.",
                    )
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </div>

              <div className="grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-2">
                <InfoLine
                  label="Email"
                  value={patient.email ?? "Non renseigné"}
                  icon={<Mail className="h-4 w-4" />}
                />
                <InfoLine
                  label="Téléphone"
                  value={patient.phone ?? "Non renseigné"}
                  icon={<MessageCircle className="h-4 w-4" />}
                />
                <InfoLine
                  label="Taille"
                  value={patient.height_cm ? `${patient.height_cm} cm` : "—"}
                  icon={<Ruler className="h-4 w-4" />}
                />
                <InfoLine
                  label="Naissance"
                  value={formatDate(patient.birth_date)}
                  icon={<Calendar className="h-4 w-4" />}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h3 className="font-semibold">Ajouter une mesure</h3>
                <p className="text-xs text-muted-foreground">
                  Ajoute une mesure rapide sans quitter la liste des patients.
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
                <Field label="Date">
                  <Input
                    type="date"
                    value={measurementDate}
                    onChange={(event) =>
                      setMeasurementDate(event.target.value)
                    }
                  />
                </Field>

                <Field label="Poids (kg)">
                  <Input
                    type="number"
                    step="0.1"
                    value={measurementWeight}
                    onChange={(event) =>
                      setMeasurementWeight(event.target.value)
                    }
                  />
                </Field>

                <Field label="Masse grasse (%)">
                  <Input
                    type="number"
                    step="0.1"
                    value={measurementFat}
                    onChange={(event) =>
                      setMeasurementFat(event.target.value)
                    }
                  />
                </Field>

                <Field label="Masse musculaire (kg)">
                  <Input
                    type="number"
                    step="0.1"
                    value={measurementMuscle}
                    onChange={(event) =>
                      setMeasurementMuscle(event.target.value)
                    }
                  />
                </Field>

                <Field label="Tour de taille (cm)">
                  <Input
                    type="number"
                    step="0.1"
                    value={measurementWaist}
                    onChange={(event) =>
                      setMeasurementWaist(event.target.value)
                    }
                  />
                </Field>

                <div className="flex items-end">
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => void handleSaveMeasurement()}
                    disabled={savingMeasurement}
                  >
                    {savingMeasurement ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Ajouter la mesure
                  </Button>
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div>
                <h3 className="font-semibold">Accès et options</h3>
                <p className="text-xs text-muted-foreground">
                  Active ou désactive les fonctionnalités disponibles pour ce patient.
                </p>
              </div>

              {!patient.user_id ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Ce patient n’a pas encore de compte utilisateur. Les options
                  seront disponibles après son invitation.
                </div>
              ) : null}

              <div className="space-y-2">
                {accessItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-2xl border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-primary">{item.icon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>

                    <Switch
                      checked={access[item.key]}
                      disabled={!patient.user_id}
                      onCheckedChange={(checked) =>
                        setAccess((previous) => ({
                          ...previous,
                          [item.key]: checked,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <Button
                className="w-full rounded-xl"
                onClick={() => void handleSaveAccess()}
                disabled={savingAccess || !patient.user_id}
              >
                {savingAccess ? "Enregistrement…" : "Enregistrer les options"}
              </Button>
            </section>
          </div>
        )}

        <SheetFooter>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function InfoLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}