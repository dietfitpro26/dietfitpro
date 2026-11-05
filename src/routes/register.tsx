import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartHandshake,
  LineChart,
  Mail,
  Star,
  Users,
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
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


const PLAN_CARDS = [
  {
    value: "basic",
    name: "Basic",
    price: "9,99 €",
    tagline: "Un excellent départ",
    points: [
      "3 programmes nutrition",
      "Journal alimentaire",
      "Communauté et groupes",
    ],
    note: "7 jours d'essai pour vous décider",
    badge: null,
  },
  {
    value: "premium",
    name: "Premium",
    price: "25,99 €",
    tagline: "L'expérience complète",
    points: [
      "12 programmes nutrition",
      "Programmes sport complets",
      "Créer vos propres groupes",
    ],
    note: null,
    badge: "Le plus choisi",
  },
] as const;


const CHOICE_BASE =
  "rounded-xl border-2 px-4 py-3 text-left text-base transition-all disabled:opacity-60";
const CHOICE_ON =
  "border-primary bg-accent font-semibold text-accent-foreground ring-2 ring-primary/20";
const CHOICE_OFF =
  "border-border bg-background text-foreground hover:border-primary/50";
const FIELD = "h-12 rounded-xl text-base";


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


function SectionTitle({ n, title, children }: { n: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t pt-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-primary-foreground">
        {n}
      </span>
      <div>
        <h2 className="text-xl font-extrabold">{title}</h2>
        {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
      </div>
    </div>
  );
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
          <div className="mb-8">
            <Logo />
          </div>

          <div className="space-y-5 rounded-3xl border bg-card p-8 shadow-sm">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-8 w-8" />
              </div>
              <h1 className="mt-4 text-3xl font-extrabold">
                Vérifiez votre adresse e-mail
              </h1>
              <p className="mt-2 text-muted-foreground">
                Un message de confirmation a été demandé pour{" "}
                <span className="font-semibold text-foreground">
                  {email.trim().toLowerCase()}
                </span>
                .
              </p>
            </div>

            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Ouvrez votre boîte mail et vos courriers indésirables.</li>
              <li>Cliquez sur le lien de confirmation.</li>
              <li>
                Reconnectez-vous sur ce navigateur avec ce compte. Votre formule
                choisie est {plan === "premium" ? "Premium" : "Basic"}.
              </li>
            </ol>

            <p className="text-sm text-muted-foreground">
              Sur un autre appareil, vous pourrez compléter votre profil et choisir votre
              formule depuis votre espace.
            </p>

            {storageWarning && (
              <Alert>
                <AlertDescription>{storageWarning}</AlertDescription>
              </Alert>
            )}

            <Button asChild className="h-12 w-full rounded-full text-base font-bold">
              <Link to="/login">Aller à la connexion</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panneau de présentation fixe (ordinateur uniquement) */}
      <aside className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />

        <Link
          to="/"
          className="relative inline-flex items-center gap-2 text-sm font-semibold text-background/80 hover:text-background"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'accueil
        </Link>

        <div className="relative mx-auto w-full max-w-xs">
          <div className="-rotate-2 rounded-[2rem] bg-white p-6 shadow-2xl">
            <img src="/logo.png" alt="DietFitPro" className="w-full object-contain" />
          </div>
        </div>

        <div className="relative space-y-5">
          <h2 className="text-4xl font-extrabold leading-tight">
            Votre nouvelle routine
            <br />
            <span className="text-brand">commence ici.</span>
          </h2>

          <ul className="space-y-3 text-lg font-medium text-background/90">
            <li className="flex items-center gap-3">
              <LineChart className="h-6 w-6 text-brand" />
              Un programme adapté à votre profil
            </li>
            <li className="flex items-center gap-3">
              <HeartHandshake className="h-6 w-6 text-brand" />
              Un accompagnement par des professionnels
            </li>
            <li className="flex items-center gap-3">
              <Users className="h-6 w-6 text-brand" />
              Une communauté qui vous motive
            </li>
          </ul>

          <p className="text-sm text-background/70">
            Sans engagement · Annulable à tout moment
          </p>
        </div>
      </aside>

      {/* Formulaire */}
      <main className="flex justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
            <Link
              to="/"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Accueil
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-extrabold">Créer mon compte</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Rejoignez la communauté DietFitPro
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Compte */}
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-primary-foreground">
                1
              </span>
              <h2 className="text-xl font-extrabold">Votre compte</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-base font-semibold">
                Nom complet
              </Label>
              <Input
                id="full_name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                disabled={disabled}
                className={FIELD}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-semibold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={disabled}
                className={FIELD}
                placeholder="vous@exemple.fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-semibold">
                Mot de passe
              </Label>
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
                  className={`${FIELD} pr-12`}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  disabled={disabled}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">6 caractères minimum.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password" className="text-base font-semibold">
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
                  className={`${FIELD} pr-12`}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm((value) => !value)}
                  aria-label={
                    showConfirm
                      ? "Masquer la confirmation"
                      : "Afficher la confirmation"
                  }
                  disabled={disabled}
                >
                  {showConfirm ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* 2. Offre */}
            <SectionTitle n="2" title="Votre offre">
              Vous pourrez changer de formule à tout moment.
            </SectionTitle>

            <div className="grid gap-4 sm:grid-cols-2">
              {PLAN_CARDS.map((card) => {
                const selected = plan === card.value;

                return (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => setPlan(card.value)}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`relative rounded-2xl border-2 p-5 text-left transition-all disabled:opacity-60 ${
                      selected
                        ? "border-primary bg-accent ring-4 ring-primary/15"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    {card.badge ? (
                      <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-foreground">
                        <Star className="h-3 w-3 fill-current" />
                        {card.badge}
                      </span>
                    ) : null}

                    <p className="text-lg font-extrabold">{card.name}</p>
                    <p className="text-sm text-muted-foreground">{card.tagline}</p>

                    <p className="mt-3 text-3xl font-extrabold text-primary">
                      {card.price}
                      <span className="text-sm font-medium text-muted-foreground">
                        /mois
                      </span>
                    </p>

                    <ul className="mt-3 space-y-1.5 text-sm">
                      {card.points.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>

                    {card.note ? (
                      <p className="mt-3 text-sm font-semibold text-primary">{card.note}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Sans engagement — Annulable à tout moment. Après votre inscription, vous
              serez dirigé vers le paiement sécurisé de la formule choisie.
            </p>

            {/* 3. Profil */}
            <SectionTitle n="3" title="Votre profil">
              Ces informations servent à personnaliser vos programmes.
            </SectionTitle>

            <div className="space-y-2">
              <Label htmlFor="age" className="text-base font-semibold">
                Âge
              </Label>
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
                className={FIELD}
              />
            </div>

            {isMinorProfile ? (
              <Alert>
                <AlertDescription>
                  Les moins de 18 ans nécessitent un accompagnement personnalisé. Après
                  la création du compte, votre professionnel prendra contact avec vous
                  directement pour établir votre programme.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Sexe</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["homme", "femme"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setGender(value)}
                        disabled={disabled}
                        aria-pressed={gender === value}
                        className={`${CHOICE_BASE} ${
                          gender === value ? CHOICE_ON : CHOICE_OFF
                        }`}
                      >
                        {value === "homme" ? "👨 Homme" : "👩 Femme"}
                      </button>
                    ))}
                  </div>
                </div>

                {gender === "femme" && (
                  <div className="flex items-center gap-3 rounded-xl border bg-muted/50 px-4 py-3">
                    <input
                      id="pregnant"
                      type="checkbox"
                      checked={isPregnantOrBreastfeeding}
                      onChange={(event) =>
                        setIsPregnantOrBreastfeeding(event.target.checked)
                      }
                      disabled={disabled}
                      className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                    />
                    <Label htmlFor="pregnant" className="text-sm font-normal leading-snug">
                      Je suis enceinte ou j&apos;allaite (facultatif — ajoute un bonus
                      calorique adapté)
                    </Label>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-base font-semibold">
                  Poids actuel (kg)
                </Label>
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
                  className={FIELD}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-base font-semibold">
                  Taille (cm)
                </Label>
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
                  className={FIELD}
                />
              </div>
            </div>

            {bmi !== null && bmiInfo && (
              <div className="flex items-center justify-between rounded-xl border bg-muted/50 px-4 py-3">
                <span className="text-muted-foreground">Votre IMC actuel</span>
                <div className="text-right">
                  <span className="text-xl font-extrabold">{bmi}</span>
                  <p className={`text-sm font-semibold ${bmiInfo.color}`}>
                    {bmiInfo.label}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="targetWeight" className="text-base font-semibold">
                Poids cible (kg)
              </Label>
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
                className={FIELD}
              />
            </div>

            {targetBmi !== null && targetBmiInfo && (
              <div className="flex items-center justify-between rounded-xl border bg-muted/50 px-4 py-3">
                <span className="text-muted-foreground">IMC cible</span>
                <div className="text-right">
                  <span className="text-xl font-extrabold">{targetBmi}</span>
                  <p className={`text-sm font-semibold ${targetBmiInfo.color}`}>
                    {targetBmiInfo.label}
                  </p>
                </div>
              </div>
            )}

            {!isMinorProfile && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  Niveau d&apos;activité physique
                </Label>
                <div className="grid gap-3">
                  {ACTIVITY_LEVELS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setActivityLevel(item.value)}
                      disabled={disabled}
                      aria-pressed={activityLevel === item.value}
                      className={`${CHOICE_BASE} ${
                        activityLevel === item.value ? CHOICE_ON : CHOICE_OFF
                      }`}
                    >
                      {item.label}
                      <span className="block text-sm font-normal text-muted-foreground">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-base font-semibold">Votre objectif principal</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {GOALS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setGoal(item.value)}
                    disabled={disabled}
                    aria-pressed={goal === item.value}
                    className={`${CHOICE_BASE} ${
                      goal === item.value ? CHOICE_ON : CHOICE_OFF
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {nutritionPreview && nutritionPreview.warnings.length === 0 && (
                <div className="space-y-1 rounded-xl border bg-accent px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Calories/jour estimées :{" "}
                    <span className="font-bold text-foreground">
                      {nutritionPreview.targetKcal} kcal
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
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

            {/* Consentements */}
            <div className="space-y-3 border-t pt-6">
              <div className="flex items-start gap-3 rounded-xl border bg-muted/50 px-4 py-3">
                <input
                  id="accept_cgv"
                  type="checkbox"
                  checked={acceptCgv}
                  onChange={(event) => setAcceptCgv(event.target.checked)}
                  disabled={disabled}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
                <Label htmlFor="accept_cgv" className="text-sm font-normal leading-snug">
                  J&apos;ai lu et j&apos;accepte les{" "}
                  <a
                    href="/cgv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    conditions générales de vente
                  </a>
                  .
                </Label>
              </div>

              <div className="flex items-start gap-3 rounded-xl border bg-muted/50 px-4 py-3">
                <input
                  id="accept_health"
                  type="checkbox"
                  checked={acceptHealthData}
                  onChange={(event) => setAcceptHealthData(event.target.checked)}
                  disabled={disabled}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
                <Label htmlFor="accept_health" className="text-sm font-normal leading-snug">
                  Je consens expressément (ou mon représentant légal si je suis mineur) à
                  ce que DietFitPro traite mes données de santé (âge, poids, taille,
                  objectifs, suivi alimentaire) pour personnaliser mes programmes, comme
                  décrit dans la{" "}
                  <a
                    href="/confidentialite"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    politique de confidentialité
                  </a>
                  . Je peux retirer mon consentement à tout moment en supprimant mon
                  compte.
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
              className="h-14 w-full rounded-full text-lg font-bold shadow-lg shadow-primary/30"
              disabled={disabled}
            >
              {submitting ? "Création…" : "Créer mon compte"}
            </Button>

            <p className="text-center text-base text-muted-foreground">
              Déjà inscrit ?{" "}
              <Link to="/login" className="font-bold text-primary hover:underline">
                Se connecter
              </Link>
            </p>

            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2 text-sm text-muted-foreground">
              <a href="/mentions-legales" className="hover:underline">
                Mentions légales
              </a>
              <a href="/cgv" className="hover:underline">
                CGV
              </a>
              <a href="/confidentialite" className="hover:underline">
                Confidentialité
              </a>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}