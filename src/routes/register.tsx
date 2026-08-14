<<<<<<< HEAD
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

const GOALS = [
  { value: "weight_loss", label: "🥗 Perte de poids" },
  { value: "muscle_gain", label: "💪 Prise de masse" },
  { value: "maintenance", label: "⚖️ Maintien du poids" },
  { value: "general_health", label: "❤️ Santé générale" },
];

const DAILY_KCAL: Record<string, number> = {
  weight_loss: 1800,
  muscle_gain: 2600,
  maintenance: 2200,
  general_health: 2000,
};

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
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [goal, setGoal] = useState("");
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

    setSubmitting(true);

    try {
      const weight = weightKg ? Number(weightKg) : null;
      const height = heightCm ? Number(heightCm) : null;
      const targetWeight = targetWeightKg
        ? Number(targetWeightKg)
        : null;
      const numericAge = age ? Number(age) : null;

      const currentBmi =
        weight !== null && height !== null
          ? calcBMI(weight, height)
          : null;

      const calculatedTargetBmi =
        targetWeight !== null && height !== null
          ? calcBMI(targetWeight, height)
          : null;

      /*
       * Important :
       * Toutes les données sont envoyées dans les métadonnées Auth.
       *
       * Nous ne faisons plus :
       * - getSession() juste après signUp()
       * - update() manuel de profiles
       *
       * Quand la confirmation email est active, Supabase ne fournit
       * normalement pas encore de session après signUp().
       */
      const result = await signUp(cleanEmail, password, {
        full_name: cleanName,
        role: "subscriber",
        age: numericAge,
        weight_kg: weight,
        height_cm: height,
        bmi: currentBmi,
        goal,
        target_weight_kg: targetWeight,
        target_bmi: calculatedTargetBmi,
        daily_kcal_target: DAILY_KCAL[goal],
        plan,
        // ✅ Nouveau : profil incomplet par défaut
        profile_complete: false,
      });

      setSuccess(true);

      if (result.data.session) {
        window.setTimeout(() => {
          // ✅ Rediriger vers /bienvenue pour finaliser le profil
          void navigate({ to: "/bienvenue" as never });
        }, 1000);

        return;
      }

      setNeedsEmailConfirm(true);
    } catch (err) {
      console.error("[register] Erreur complète inscription :", err);
      setError(getErrorMessage(err));
=======
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
})

function RegisterComponent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient' as 'pro' | 'patient' | 'subscriber',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validations
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractè·´res')
      return
    }

    setLoading(true)

    try {
      // 1. Créer utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Erreur création compte')

      // 2. Créer profil avec profile_complete=false et subscription_tier=basic
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: formData.email,
        role: formData.role,
        profile_complete: false,
        subscription_tier: 'basic',
      })

      if (profileError) throw profileError

      // 3. Rediriger vers bienvenue pour compléter profil
      navigate({ to: '/bienvenue' })
    } catch (err: any) {
      console.error('Register error:', err)
      setError(err.message || 'Une erreur est survenue')
>>>>>>> 99408d3e5828c26f7f68f4143aa8c5d8c6e2d77e
    } finally {
      setLoading(false)
    }
  }

  return (
<<<<<<< HEAD
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

                {goal ? (
                  <p className="text-xs text-muted-foreground">
                    Calories/jour estimées :{" "}
                    <span className="font-medium text-foreground">
                      {DAILY_KCAL[goal]} kcal
                    </span>
                  </p>
                ) : null}
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
=======
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cré·´er un compte</CardTitle>
          <CardDescription>
            Rejoignez DietFitPro pour commencer votre parcours santé
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Je suis</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['pro', 'patient', 'subscriber'] as const).map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant={formData.role === role ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setFormData({ ...formData, role })}
                    disabled={loading}
                  >
                    {role === 'pro' && 'Pro'}
                    {role === 'patient' && 'Patient'}
                    {role === 'subscriber' && 'Subscriber'}
                  </Button>
                ))}
              </div>
            </div>
>>>>>>> 99408d3e5828c26f7f68f4143aa8c5d8c6e2d77e
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              S'inscrire
            </Button>
          </CardFooter>
        </form>
        <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
          Déjà·´ un compte ?{' '}
          <Button variant="link" className="p-0" onClick={() => navigate({ to: '/login' })}>
            Se connecter
          </Button>
        </div>
      </Card>
    </div>
  )
}
