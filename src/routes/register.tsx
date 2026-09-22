import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Activity, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  calculateNutritionProfile,
  isMinor,
  type ActivityLevel,
  type Gender,
  type NutritionGoal,
} from "@/lib/nutritionCalc";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Inscription — DietFitPro" },
      {
        name: "description",
        content: "Créez votre compte abonné DietFitPro.",
      },
    ],
  }),
  component: RegisterPage,
});

const GOALS: { value: NutritionGoal; label: string }[] = [
  { value: "perte_de_poids", label: "🥗 Perte de poids" },
  { value: "prise_de_masse", label: "💪 Prise de masse" },
  { value: "maintien", label: "⚖️ Maintien du poids" },
  { value: "equilibre", label: "❤️ Santé générale" },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: "sedentaire", label: "🪑 Sédentaire", hint: "Bureau, peu ou pas de sport" },
  { value: "actif", label: "🏃 Actif", hint: "Sport 2-3x / semaine" },
  { value: "tres_actif", label: "🔥 Très actif", hint: "Sport 4-6x / semaine ou métier physique" },
];

function calcBMI(weight: number, height: number): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(height)) {
    return null;
  }

  if (weight <= 0 || height <= 0) {
    return null;
  }

  const heightInMeters = height / 100;

  return Math.round(
    (weight / (heightInMeters * heightInMeters)) * 10,
  ) / 10;
}

function getBMILabel(bmi: number): {
  label: string;
  color: string;
} {
  if (bmi < 18.5) {
    return {
      label: "Insuffisance pondérale",
      color: "text-blue-500",
    };
  }

  if (bmi < 25) {
    return {
      label: "Poids normal ✅",
      color: "text-green-500",
    };
  }

  if (bmi < 30) {
    return {
      label: "Surpoids",
      color: "text-orange-500",
    };
  }

  return {
    label: "Obésité",
    color: "text-red-500",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const possibleError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      possibleError.message,
      possibleError.details,
      possibleError.hint,
      possibleError.code,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .map((value) => value.trim());

    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  return "Erreur inconnue pendant la création du compte.";
}

// Clé de stockage local temporaire : si l'email doit être confirmé avant la première
// connexion, on garde le profil physique en attente pour le réinjecter au premier login.
export const PENDING_PROFILE_KEY = "dietfitpro_pending_profile";

// IMPORTANT : ces champs correspondent exactement aux colonnes existantes de la
// table public.profiles ET sont autorisés par le trigger de sécurité
// prevent_profile_security_changes(). Ne JAMAIS inclure ici : role, plan,
// pro_id, subscription_status, stripe_customer_id, stripe_subscription_id.
// Ces champs "sensibles" sont gérés uniquement via handle_new_user() à la
// création, ou via set_patient_plan()/pro_set_subscriber_plan() après paiement.
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

function savePendingProfile(data: PendingProfileData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(data));
}

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [goal, setGoal] = useState<NutritionGoal | "">("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">("");
  const [isPregnantOrBreastfeeding, setIsPregnantOrBreastfeeding] = useState(false);
  const [plan, setPlan] = useState<"basic" | "premium">("basic");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const bmi = calcBMI(Number(weightKg), Number(heightCm));
  const bmiInfo = bmi !== null ? getBMILabel(bmi) : null;

  const targetBmi = calcBMI(
    Number(targetWeightKg),
    Number(heightCm),
  );
  const targetBmiInfo =
    targetBmi !== null ? getBMILabel(targetBmi) : null;

  const numericAgeForPreview = age ? Number(age) : null;
  const isMinorProfile =
    numericAgeForPreview !== null && Number.isFinite(numericAgeForPreview)
      ? isMinor(numericAgeForPreview)
      : false;

  // Aperçu du calcul nutrition en direct, dès que tous les champs nécessaires sont remplis.
  const nutritionPreview =
    !isMinorProfile &&
    weightKg &&
    heightCm &&
    age &&
    gender &&
    activityLevel &&
    goal
      ? calculateNutritionProfile({
          weightKg: Number(weightKg),
          heightCm: Number(heightCm),
          age: Number(age),
          gender: gender as Gender,
          activityLevel: activityLevel as ActivityLevel,
          goal: goal as NutritionGoal,
          programStartDate: new Date().toISOString().slice(0, 10),
          isPregnantOrBreastfeeding,
        })
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting || success) {
      return;
    }

    setError(null);
    setNeedsEmailConfirm(false);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Veuillez renseigner votre nom complet.");
      return;
    }

    if (!cleanEmail) {
      setError("Veuillez renseigner votre adresse email.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    if (!goal) {
      setError("Veuillez sélectionner votre objectif.");
      return;
    }

    const numericAge = age ? Number(age) : null;

    if (numericAge === null) {
      setError("Veuillez renseigner votre âge.");
      return;
    }

    if (!isMinor(numericAge)) {
      if (!gender) {
        setError("Veuillez indiquer votre sexe (nécessaire pour calculer vos besoins caloriques).");
        return;
      }

      if (!activityLevel) {
        setError("Veuillez sélectionner votre niveau d'activité physique.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const weight = weightKg ? Number(weightKg) : null;
      const height = heightCm ? Number(heightCm) : null;
      const targetWeight = targetWeightKg
        ? Number(targetWeightKg)
        : null;

      const currentBmi =
        weight !== null && height !== null
          ? calcBMI(weight, height)
          : null;

      const programStartDate = new Date().toISOString().slice(0, 10);

      // Cas mineur : pas de calcul Black et al., profil marqué incomplet
      // pour déclencher un suivi manuel côté Pro.
      const minor = isMinor(numericAge);

      const nutrition = minor
        ? null
        : calculateNutritionProfile({
            weightKg: weight ?? 0,
            heightCm: height ?? 0,
            age: numericAge,
            gender: gender as Gender,
            activityLevel: activityLevel as ActivityLevel,
            goal: goal as NutritionGoal,
            programStartDate,
            isPregnantOrBreastfeeding,
          });

      // NOTE IMPORTANTE : "plan" n'est jamais envoyé ici. Le compte est
      // toujours créé en "basic" par handle_new_user() (sécurité anti-triche
      // côté base). Le passage en Premium se fera après paiement confirmé,
      // via le flux de paiement existant (Stripe / set_patient_plan).
      const profileUpdate: PendingProfileData = {
        age: numericAge,
        gender: minor ? null : (gender as Gender),
        weight_kg: weight,
        height_cm: height,
        bmi: currentBmi,
        goal,
        activity_level: minor ? null : (activityLevel as ActivityLevel),
        is_pregnant_or_breastfeeding: minor ? false : isPregnantOrBreastfeeding,
        target_weight_kg: targetWeight,
        program_start_date: programStartDate,
        bmr_kcal: nutrition?.bmrKcal ?? null,
        tdee_kcal: nutrition?.tdeeKcal ?? null,
        daily_kcal_target: nutrition?.targetKcal ?? null,
        target_kcal: nutrition?.targetKcal ?? null,
        target_protein_g: nutrition?.targetProteinG ?? null,
        target_carbs_g: nutrition?.targetCarbsG ?? null,
        target_fat_g: nutrition?.targetFatG ?? null,
        profile_complete: !minor,
      };

      const result = await signUp(cleanEmail, password, {
        full_name: cleanName,
      });

      if (result.data.session) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("id", result.data.session.user.id);

        if (updateError) {
          console.error("[register] Erreur mise à jour profil :", updateError);
          setError(getErrorMessage(updateError));
          setSubmitting(false);
          return;
        }

        setSuccess(true);

        // Si l'utilisateur a choisi Premium, on le redirige vers le paiement
        // au lieu de /home directement. Le plan ne sera activé qu'après
        // confirmation du paiement (voir patient.pay.$consultationId.tsx ou
        // équivalent abonné).
        window.setTimeout(() => {
          if (plan === "premium") {
            void navigate({ to: "/home" }); // TODO: rediriger vers la page de paiement Premium quand elle existe
          } else {
            void navigate({ to: "/home" });
          }
        }, 1000);

        return;
      }

      savePendingProfile(profileUpdate);
      setSuccess(true);
      setNeedsEmailConfirm(true);
    } catch (err) {
      console.error("[register] Erreur complète inscription :", err);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Activity className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-foreground">
            DietFitPro
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créer un compte</CardTitle>
            <CardDescription>
              Rejoignez la communauté DietFitPro
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input
                  id="full_name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  disabled={submitting || success}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  disabled={submitting || success}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    disabled={submitting || success}
                  />

                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    disabled={submitting || success}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  6 caractères minimum.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">
                  Confirmer le mot de passe
                </Label>

                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    disabled={submitting || success}
                  />

                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label={
                      showConfirm
                        ? "Masquer la confirmation"
                        : "Afficher la confirmation"
                    }
                    disabled={submitting || success}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium text-foreground">
                  Choisissez votre offre
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlan("basic")}
                    disabled={submitting || success}
                    className={`rounded-lg border px-4 py-3 text-center text-sm font-medium transition-all ${
                      plan === "basic"
                        ? "border-[#6DB33F] bg-[#6DB33F]/10 text-[#2D7A1F]"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    🥗 Basic
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nutrition générale
                    </p>
                    <p className="mt-2 text-lg font-bold text-[#2D7A1F]">
                      9.99€
                      <span className="text-xs font-normal text-muted-foreground">
                        /mois
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-green-600">
                      7 jours d'essai pour vous décider
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlan("premium")}
                    disabled={submitting || success}
                    className={`rounded-lg border px-4 py-3 text-center text-sm font-medium transition-all ${
                      plan === "premium"
                        ? "border-[#6DB33F] bg-[#6DB33F]/10 text-[#2D7A1F]"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    ⭐ Premium
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fonctionnalités avancées
                    </p>
                    <p className="mt-2 text-lg font-bold text-[#2D7A1F]">
                      25.99€
                      <span className="text-xs font-normal text-muted-foreground">
                        /mois
                      </span>
                    </p>
                  </button>
                </div>

                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Sans engagement — Annulable à tout moment
                </p>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Votre compte démarre en formule Basic. Le passage en Premium
                  sera confirmé après votre paiement.
                </p>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium text-foreground">
                  Votre profil physique
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Âge</Label>
                <Input
                  id="age"
                  type="number"
                  min="10"
                  max="120"
                  placeholder="ex: 35"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  disabled={submitting || success}
                />
              </div>

              {isMinorProfile ? (
                <Alert>
                  <AlertDescription>
                    Les moins de 18 ans nécessitent un accompagnement personnalisé.
                    Après la création du compte, votre professionnel prendra contact
                    avec vous directement pour établir votre programme.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Sexe</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setGender("homme")}
                        disabled={submitting || success}
                        className={`rounded-lg border px-4 py-2 text-center text-sm font-medium transition-all ${
                          gender === "homme"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        👨 Homme
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender("femme")}
                        disabled={submitting || success}
                        className={`rounded-lg border px-4 py-2 text-center text-sm font-medium transition-all ${
                          gender === "femme"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        👩 Femme
                      </button>
                    </div>
                  </div>

                  {gender === "femme" ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3">
                      <input
                        id="pregnant"
                        type="checkbox"
                        checked={isPregnantOrBreastfeeding}
                        onChange={(event) =>
                          setIsPregnantOrBreastfeeding(event.target.checked)
                        }
                        disabled={submitting || success}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="pregnant" className="text-sm font-normal">
                        Je suis enceinte ou j'allaite (facultatif — ajoute un bonus
                        calorique adapté)
                      </Label>
                    </div>
                  ) : null}
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="weight">Poids actuel (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    placeholder="ex: 75"
                    value={weightKg}
                    onChange={(event) =>
                      setWeightKg(event.target.value)
                    }
                    disabled={submitting || success}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Taille (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min="100"
                    max="250"
                    step="0.5"
                    placeholder="ex: 175"
                    value={heightCm}
                    onChange={(event) =>
                      setHeightCm(event.target.value)
                    }
                    disabled={submitting || success}
                  />
                </div>
              </div>

              {bmi !== null && bmiInfo ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Votre IMC actuel
                  </span>

                  <div className="text-right">
                    <span className="text-lg font-bold text-foreground">
                      {bmi}
                    </span>
                    <p className={`text-xs font-medium ${bmiInfo.color}`}>
                      {bmiInfo.label}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="targetWeight">Poids cible (kg)</Label>
                <Input
                  id="targetWeight"
                  type="number"
                  min="30"
                  max="300"
                  step="0.1"
                  placeholder="ex: 68"
                  value={targetWeightKg}
                  onChange={(event) =>
                    setTargetWeightKg(event.target.value)
                  }
                  disabled={submitting || success}
                />
              </div>

              {targetBmi !== null && targetBmiInfo ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    IMC cible
                  </span>

                  <div className="text-right">
                    <span className="text-lg font-bold text-foreground">
                      {targetBmi}
                    </span>
                    <p
                      className={`text-xs font-medium ${targetBmiInfo.color}`}
                    >
                      {targetBmiInfo.label}
                    </p>
                  </div>
                </div>
              ) : null}

              {!isMinorProfile ? (
                <div className="space-y-2">
                  <Label>Niveau d'activité physique</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {ACTIVITY_LEVELS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setActivityLevel(item.value)}
                        disabled={submitting || success}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                          activityLevel === item.value
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {item.label}
                        <span className="ml-1 text-xs text-muted-foreground">
                          — {item.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Votre objectif principal</Label>

                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setGoal(item.value)}
                      disabled={submitting || success}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                        goal === item.value
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {nutritionPreview && nutritionPreview.warnings.length === 0 ? (
                  <div className="space-y-1 rounded-lg border bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Calories/jour estimées :{" "}
                      <span className="font-medium text-foreground">
                        {nutritionPreview.targetKcal} kcal
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Protéines {nutritionPreview.targetProteinG}g — Glucides{" "}
                      {nutritionPreview.targetCarbsG}g — Lipides{" "}
                      {nutritionPreview.targetFatG}g
                    </p>
                  </div>
                ) : null}

                {nutritionPreview?.warnings.map((warning) => (
                  <Alert key={warning}>
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    <span className="break-words">{error}</span>
                  </AlertDescription>
                </Alert>
              ) : null}

              {success ? (
                <Alert>
                  <AlertDescription>
                    {needsEmailConfirm
                      ? "Compte créé ! Vérifiez votre boîte mail, ainsi que vos spams, pour confirmer votre inscription avant de vous connecter."
                      : "Compte créé avec succès ! Redirection en cours…"}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || success}
              >
                {submitting ? "Création…" : "Créer mon compte"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Déjà inscrit ?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Se connecter
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}