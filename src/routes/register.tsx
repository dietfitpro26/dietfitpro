import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Activity, Eye, EyeOff, Mail } from "lucide-react";

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
import { startCheckout } from "@/lib/billing";
import {
  savePendingRegistration,
  type PendingProfileData,
} from "@/lib/pendingRegistration";
import {
  calculateNutritionProfile,
  isMinor,
  type ActivityLevel,
  type Gender,
  type NutritionGoal,
} from "@/lib/nutritionCalc";

export {
  PENDING_PROFILE_KEY,
  PENDING_PLAN_KEY,
} from "@/lib/pendingRegistration";

export type { PendingProfileData } from "@/lib/pendingRegistration";

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

const LEGAL_DOCUMENTS_VERSION = "2026-10-14";

const GOALS: { value: NutritionGoal; label: string }[] = [
  { value: "perte_de_poids", label: "🥗 Perte de poids" },
  { value: "prise_de_masse", label: "💪 Prise de masse" },
  { value: "maintien", label: "⚖️ Maintien du poids" },
  { value: "equilibre", label: "❤️ Santé générale" },
];

const ACTIVITY_LEVELS: {
  value: ActivityLevel;
  label: string;
  hint: string;
}[] = [
  {
    value: "sedentaire",
    label: "🪑 Sédentaire",
    hint: "Bureau, peu ou pas de sport",
  },
  {
    value: "actif",
    label: "🏃 Actif",
    hint: "Sport 2-3x / semaine",
  },
  {
    value: "tres_actif",
    label: "🔥 Très actif",
    hint: "Sport 4-6x / semaine ou métier physique",
  },
];

function calcBMI(weight: number, height: number): number | null {
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    weight <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return Math.round((weight / (height / 100) ** 2) * 10) / 10;
}

function getBMILabel(bmi: number) {
  if (bmi < 18.5) {
    return { label: "Insuffisance pondérale", color: "text-blue-500" };
  }

  if (bmi < 25) {
    return { label: "Poids normal ✅", color: "text-green-500" };
  }

  if (bmi < 30) {
    return { label: "Surpoids", color: "text-orange-500" };
  }

  return { label: "Obésité", color: "text-red-500" };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;
    const parts = [
      value.message,
      value.details,
      value.hint,
      value.code,
    ].filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    );

    if (parts.length) return parts.join(" — ");
  }

  return "Erreur inconnue pendant la création du compte.";
}

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const submittingRef = useRef(false);

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
  const [activityLevel, setActivityLevel] =
    useState<ActivityLevel | "">("");
  const [isPregnantOrBreastfeeding, setIsPregnantOrBreastfeeding] =
    useState(false);
  const [plan, setPlan] = useState<"basic" | "premium">("basic");

  const [acceptCgv, setAcceptCgv] = useState(false);
  const [acceptHealthData, setAcceptHealthData] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const disabled = submitting || success;

  const bmi = calcBMI(Number(weightKg), Number(heightCm));
  const bmiInfo = bmi !== null ? getBMILabel(bmi) : null;

  const targetBmi = calcBMI(Number(targetWeightKg), Number(heightCm));
  const targetBmiInfo =
    targetBmi !== null ? getBMILabel(targetBmi) : null;

  const numericAge = age ? Number(age) : null;
  const isMinorProfile =
    numericAge !== null &&
    Number.isFinite(numericAge) &&
    isMinor(numericAge);

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
          gender,
          activityLevel,
          goal,
          programStartDate: new Date().toISOString().slice(0, 10),
          isPregnantOrBreastfeeding,
        })
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submittingRef.current || success) return;

    setError(null);
    setStorageWarning(null);
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

    if (
      numericAge === null ||
      !Number.isInteger(numericAge) ||
      numericAge < 10 ||
      numericAge > 120
    ) {
      setError("Veuillez renseigner un âge entier entre 10 et 120 ans.");
      return;
    }

    if (!isMinor(numericAge) && (!gender || !activityLevel)) {
      setError("Veuillez renseigner votre sexe et votre niveau d'activité.");
      return;
    }

    if (!acceptCgv) {
      setError("Veuillez accepter les conditions générales de vente.");
      return;
    }

    if (!acceptHealthData) {
      setError(
        "Votre consentement au traitement de vos données de santé est nécessaire pour personnaliser vos programmes.",
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const weight = weightKg ? Number(weightKg) : null;
      const height = heightCm ? Number(heightCm) : null;
      const targetWeight = targetWeightKg ? Number(targetWeightKg) : null;
      const programStartDate = new Date().toISOString().slice(0, 10);
      const minor = isMinor(numericAge);

      const nutrition = minor
        ? null
        : calculateNutritionProfile({
            weightKg: weight ?? 0,
            heightCm: height ?? 0,
            age: numericAge,
            gender: gender as Gender,
            activityLevel: activityLevel as ActivityLevel,
            goal,
            programStartDate,
            isPregnantOrBreastfeeding,
          });

      const profileUpdate: PendingProfileData = {
        age: numericAge,
        gender: minor ? null : (gender as Gender),
        weight_kg: weight,
        height_cm: height,
        bmi:
          weight !== null && height !== null
            ? calcBMI(weight, height)
            : null,
        goal,
        activity_level: minor ? null : (activityLevel as ActivityLevel),
        is_pregnant_or_breastfeeding: minor
          ? false
          : isPregnantOrBreastfeeding,
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

      const consentAt = new Date().toISOString();

      const result = await signUp(cleanEmail, password, {
        full_name: cleanName,
        cgv_accepted_at: consentAt,
        health_consent_at: consentAt,
        legal_documents_version: LEGAL_DOCUMENTS_VERSION,
      });

      if (result.error) throw result.error;

      const createdUser = result.data.user;
      if (!createdUser) {
        throw new Error(
          "Impossible de confirmer la création du compte. Vérifiez vos e-mails ou essayez de vous connecter.",
        );
      }

      // Certains retours d'inscription ne permettent pas de confirmer
      // qu'un nouveau compte a été créé. On ne stocke rien dans ce cas.
      if (
        !result.data.session &&
        Array.isArray(createdUser.identities) &&
        createdUser.identities.length === 0
      ) {
        throw new Error(
          "La création d'un nouveau compte n'a pas pu être confirmée. Si vous êtes déjà inscrit, utilisez la connexion.",
        );
      }

      if (result.data.session) {
        const { data: currentProfile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, role")
            .eq("id", result.data.session.user.id)
            .maybeSingle();

        if (
          profileError ||
          !currentProfile ||
          currentProfile.role !== "subscriber"
        ) {
          setSuccess(true);
          setError(
            "Le compte est créé, mais son profil abonné n'a pas pu être vérifié. Ne recommencez pas l'inscription : passez par la connexion.",
          );
          return;
        }

        const saved = savePendingRegistration(
          result.data.session.user.id,
          profileUpdate,
          plan,
        );

        const { data: updatedProfile, error: updateError } =
          await supabase
            .from("profiles")
            .update(profileUpdate)
            .eq("id", result.data.session.user.id)
            .eq("role", "subscriber")
            .select("id")
            .maybeSingle();

        if (updateError || !updatedProfile) {
          console.error("[register] Mise à jour du profil :", updateError);
          setSuccess(true);
          setError(
            saved
              ? "Le compte est créé, mais votre profil n'a pas pu être finalisé. Passez par la connexion pour réessayer sans recréer de compte."
              : "Le compte est créé, mais votre profil n'a pas pu être finalisé. Connectez-vous puis complétez votre profil.",
          );
          return;
        }

        // Le parcours immédiat n'a plus besoin des données temporaires.
        const { clearPendingProfile, takePendingPlan } =
          await import("@/lib/pendingRegistration");

        const cleaned = clearPendingProfile(result.data.session.user.id);
        if (cleaned) {
          takePendingPlan(result.data.session.user.id);
        }

        setSuccess(true);

        try {
          await startCheckout({ kind: "subscription", plan });
          return;
        } catch (checkoutError) {
          console.error("[register] Ouverture du paiement :", checkoutError);
          setError(
            "Votre compte est créé, mais la page de paiement n'a pas pu s'ouvrir. Retrouvez votre formule depuis votre profil.",
          );

          window.setTimeout(() => {
            void navigate({ to: "/home" });
          }, 3000);
          return;
        }
      }

      const saved = savePendingRegistration(
        createdUser.id,
        profileUpdate,
        plan,
      );

      if (!saved) {
        setStorageWarning(
          "Ce navigateur n'a pas pu conserver vos informations en attente. Après confirmation, complétez votre profil et choisissez votre formule depuis votre espace.",
        );
      }

      setSuccess(true);
      setNeedsEmailConfirm(true);
    } catch (caughtError) {
      console.error("[register] Inscription :", caughtError);
      setError(getErrorMessage(caughtError));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (success && needsEmailConfirm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold">DietFitPro</span>
          </div>

          <Card>
            <CardHeader className="items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-7 w-7" />
              </div>
              <CardTitle className="mt-3">
                Vérifiez votre adresse e-mail
              </CardTitle>
              <CardDescription>
                Un message de confirmation a été demandé pour{" "}
                <span className="font-medium text-foreground">
                  {email.trim().toLowerCase()}
                </span>.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Ouvrez votre boîte mail et vos courriers indésirables.</li>
                <li>Cliquez sur le lien de confirmation.</li>
                <li>
                  Reconnectez-vous sur ce navigateur avec ce compte.
                  Votre formule choisie est{" "}
                  {plan === "premium" ? "Premium" : "Basic"}.
                </li>
              </ol>

              <p className="text-xs text-muted-foreground">
                Sur un autre appareil, vous pourrez compléter votre profil
                et choisir votre formule depuis votre espace.
              </p>

              {storageWarning && (
                <Alert>
                  <AlertDescription>{storageWarning}</AlertDescription>
                </Alert>
              )}

              <Button asChild className="w-full">
                <Link to="/login">Aller à la connexion</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Activity className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold">DietFitPro</span>
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
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  disabled={disabled}
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
                  disabled={disabled}
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
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={disabled}
                    className="pr-10"
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
                    disabled={disabled}
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
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={disabled}
                    className="pr-10"
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
                    disabled={disabled}
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
                <p className="mb-3 text-sm font-medium">
                  Choisissez votre offre
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {(["basic", "premium"] as const).map((offer) => (
                    <button
                      key={offer}
                      type="button"
                      onClick={() => setPlan(offer)}
                      disabled={disabled}
                      aria-pressed={plan === offer}
                      className={`rounded-lg border px-4 py-3 text-center text-sm font-medium transition-all ${
                        plan === offer
                          ? "border-[#6DB33F] bg-[#6DB33F]/10 text-[#2D7A1F]"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {offer === "basic" ? "🥗 Basic" : "⭐ Premium"}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {offer === "basic"
                          ? "Nutrition générale"
                          : "Fonctionnalités avancées"}
                      </span>
                      <span className="mt-2 block text-lg font-bold text-[#2D7A1F]">
                        {offer === "basic" ? "9,99 €" : "25,99 €"}
                        <span className="text-xs font-normal text-muted-foreground">
                          /mois
                        </span>
                      </span>
                      {offer === "basic" && (
                        <span className="mt-1 block text-xs font-medium text-green-600">
                          7 jours d&apos;essai pour vous décider
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Sans engagement — Annulable à tout moment
                </p>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Après votre inscription, vous serez dirigé vers le paiement
                  sécurisé de la formule choisie.
                </p>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">
                  Votre profil physique
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Âge</Label>
                <Input
                  id="age"
                  type="number"
                  min={10}
                  max={120}
                  step={1}
                  placeholder="ex : 35"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  disabled={disabled}
                />
              </div>

              {isMinorProfile ? (
                <Alert>
                  <AlertDescription>
                    Les moins de 18 ans nécessitent un accompagnement
                    personnalisé. Après la création du compte, votre
                    professionnel prendra contact avec vous directement
                    pour établir votre programme.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Sexe</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["homme", "femme"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setGender(value)}
                          disabled={disabled}
                          aria-pressed={gender === value}
                          className={`rounded-lg border px-4 py-2 text-sm ${
                            gender === value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {value === "homme" ? "👨 Homme" : "👩 Femme"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {gender === "femme" && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3">
                      <input
                        id="pregnant"
                        type="checkbox"
                        checked={isPregnantOrBreastfeeding}
                        onChange={(event) =>
                          setIsPregnantOrBreastfeeding(event.target.checked)
                        }
                        disabled={disabled}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="pregnant" className="text-sm font-normal">
                        Je suis enceinte ou j&apos;allaite
                        (facultatif — ajoute un bonus calorique adapté)
                      </Label>
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="weight">Poids actuel (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min={30}
                    max={300}
                    step={0.1}
                    placeholder="ex : 75"
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Taille (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min={100}
                    max={250}
                    step={0.5}
                    placeholder="ex : 175"
                    value={heightCm}
                    onChange={(event) => setHeightCm(event.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>

              {bmi !== null && bmiInfo && (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Votre IMC actuel
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-bold">{bmi}</span>
                    <p className={`text-xs font-medium ${bmiInfo.color}`}>
                      {bmiInfo.label}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="targetWeight">Poids cible (kg)</Label>
                <Input
                  id="targetWeight"
                  type="number"
                  min={30}
                  max={300}
                  step={0.1}
                  placeholder="ex : 68"
                  value={targetWeightKg}
                  onChange={(event) => setTargetWeightKg(event.target.value)}
                  disabled={disabled}
                />
              </div>

              {targetBmi !== null && targetBmiInfo && (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    IMC cible
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-bold">{targetBmi}</span>
                    <p className={`text-xs font-medium ${targetBmiInfo.color}`}>
                      {targetBmiInfo.label}
                    </p>
                  </div>
                </div>
              )}

              {!isMinorProfile && (
                <div className="space-y-2">
                  <Label>Niveau d&apos;activité physique</Label>
                  <div className="grid gap-2">
                    {ACTIVITY_LEVELS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setActivityLevel(item.value)}
                        disabled={disabled}
                        aria-pressed={activityLevel === item.value}
                        className={`rounded-lg border px-3 py-2 text-left text-sm ${
                          activityLevel === item.value
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground"
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
              )}

              <div className="space-y-2">
                <Label>Votre objectif principal</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setGoal(item.value)}
                      disabled={disabled}
                      aria-pressed={goal === item.value}
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${
                        goal === item.value
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {nutritionPreview && nutritionPreview.warnings.length === 0 && (
                  <div className="space-y-1 rounded-lg border bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Calories/jour estimées :{" "}
                      <span className="font-medium text-foreground">
                        {nutritionPreview.targetKcal} kcal
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Protéines {nutritionPreview.targetProteinG} g — Glucides{" "}
                      {nutritionPreview.targetCarbsG} g — Lipides{" "}
                      {nutritionPreview.targetFatG} g
                    </p>
                  </div>
                )}

                {nutritionPreview?.warnings.map((warning) => (
                  <Alert key={warning}>
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3">
                  <input
                    id="accept_cgv"
                    type="checkbox"
                    checked={acceptCgv}
                    onChange={(event) => setAcceptCgv(event.target.checked)}
                    disabled={disabled}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <Label htmlFor="accept_cgv" className="text-sm font-normal leading-snug">
                    J&apos;ai lu et j&apos;accepte les{" "}
                    <a
                      href="/cgv"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      conditions générales de vente
                    </a>.
                  </Label>
                </div>

                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3">
                  <input
                    id="accept_health"
                    type="checkbox"
                    checked={acceptHealthData}
                    onChange={(event) => setAcceptHealthData(event.target.checked)}
                    disabled={disabled}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <Label htmlFor="accept_health" className="text-sm font-normal leading-snug">
                    Je consens expressément (ou mon représentant légal si
                    je suis mineur) à ce que DietFitPro traite mes données
                    de santé (âge, poids, taille, objectifs, suivi alimentaire)
                    pour personnaliser mes programmes, comme décrit dans la{" "}
                    <a
                      href="/confidentialite"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      politique de confidentialité
                    </a>.
                    Je peux retirer mon consentement à tout moment en
                    supprimant mon compte.
                  </Label>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <span className="break-words">{error}</span>
                  </AlertDescription>
                </Alert>
              )}

              {success && !needsEmailConfirm && !error && (
                <Alert>
                  <AlertDescription>
                    Compte créé ! Redirection vers le paiement sécurisé…
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={disabled}
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

              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
                <a href="/mentions-legales" className="hover:underline">
                  Mentions légales
                </a>
                <a href="/cgv" className="hover:underline">CGV</a>
                <a href="/confidentialite" className="hover:underline">
                  Confidentialité
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}