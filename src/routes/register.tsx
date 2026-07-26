import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Inscription — DietFitPro" },
      { name: "description", content: "Créez votre compte abonné DietFitPro." },
    ],
  }),
  component: RegisterPage,
});

const GOALS = [
  { value: "weight_loss",    label: "🥗 Perte de poids" },
  { value: "muscle_gain",    label: "💪 Prise de masse" },
  { value: "maintenance",    label: "⚖️ Maintien du poids" },
  { value: "general_health", label: "❤️ Santé générale" },
];

const DAILY_KCAL: Record<string, number> = {
  weight_loss:    1800,
  muscle_gain:    2600,
  maintenance:    2200,
  general_health: 2000,
};

function calcBMI(weight: number, height: number): number | null {
  if (!weight || !height || height <= 0) return null;
  const h = height / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

function getBMILabel(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Insuffisance pondérale", color: "text-blue-500" };
  if (bmi < 25)   return { label: "Poids normal ✅",        color: "text-green-500" };
  if (bmi < 30)   return { label: "Surpoids",               color: "text-orange-500" };
  return           { label: "Obésité",                      color: "text-red-500" };
}

function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName,       setFullName]       = useState("");
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [age,            setAge]            = useState("");
  const [weightKg,       setWeightKg]       = useState("");
  const [heightCm,       setHeightCm]       = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [goal,           setGoal]           = useState("");
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState(false);
  const [submitting,     setSubmitting]     = useState(false);

  // IMC actuel en temps réel
  const bmi     = calcBMI(parseFloat(weightKg), parseFloat(heightCm));
  const bmiInfo = bmi ? getBMILabel(bmi) : null;

  // IMC cible en temps réel
  const targetBmi     = calcBMI(parseFloat(targetWeightKg), parseFloat(heightCm));
  const targetBmiInfo = targetBmi ? getBMILabel(targetBmi) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (!goal) {
      setError("Veuillez sélectionner votre objectif.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password, {
        full_name: fullName,
        role: "subscriber",
      });

      // Récupère la session pour avoir l'userId
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (userId) {
        const weight    = weightKg       ? parseFloat(weightKg)       : null;
        const height    = heightCm       ? parseFloat(heightCm)       : null;
        const targetW   = targetWeightKg ? parseFloat(targetWeightKg) : null;
        const tBmi      = targetW && height
          ? Math.round((targetW / ((height / 100) * (height / 100))) * 10) / 10
          : null;

        await supabase
          .from("profiles")
          .update({
            age:                age ? parseInt(age) : null,
            weight_kg:          weight,
            height_cm:          height,
            goal,
            target_weight_kg:   targetW,
            target_bmi:         tBmi,
            daily_kcal_target:  goal ? DAILY_KCAL[goal] : null,
          })
          .eq("id", userId);
      }

      setSuccess(true);
      setTimeout(() => void navigate({ to: "/home" as never }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Activity className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-foreground">DietFitPro</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créer un compte</CardTitle>
            <CardDescription>Rejoignez la communauté DietFitPro</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── Nom complet ── */}
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input
                  id="full_name" type="text" required
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              {/* ── Email ── */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {/* ── Mot de passe ── */}
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password" type="password" required minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">6 caractères minimum.</p>
              </div>

              {/* ── Séparateur ── */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Votre profil physique</p>
              </div>

              {/* ── Âge ── */}
              <div className="space-y-2">
                <Label htmlFor="age">Âge</Label>
                <Input
                  id="age" type="number" min="10" max="120" placeholder="ex: 35"
                  value={age} onChange={(e) => setAge(e.target.value)}
                />
              </div>

              {/* ── Poids + Taille ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="weight">Poids actuel (kg)</Label>
                  <Input
                    id="weight" type="number" min="30" max="300" step="0.1" placeholder="ex: 75"
                    value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Taille (cm)</Label>
                  <Input
                    id="height" type="number" min="100" max="250" step="0.5" placeholder="ex: 175"
                    value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
                  />
                </div>
              </div>

              {/* ── IMC actuel ── */}
              {bmi && bmiInfo && (
                <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Votre IMC actuel</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-foreground">{bmi}</span>
                    <p className={`text-xs font-medium ${bmiInfo.color}`}>{bmiInfo.label}</p>
                  </div>
                </div>
              )}

              {/* ── Poids cible ── */}
              <div className="space-y-2">
                <Label htmlFor="targetWeight">Poids cible (kg)</Label>
                <Input
                  id="targetWeight" type="number" min="30" max="300" step="0.1" placeholder="ex: 68"
                  value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)}
                />
              </div>

              {/* ── IMC cible ── */}
              {targetBmi && targetBmiInfo && (
                <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">IMC cible</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-foreground">{targetBmi}</span>
                    <p className={`text-xs font-medium ${targetBmiInfo.color}`}>{targetBmiInfo.label}</p>
                  </div>
                </div>
              )}

              {/* ── Objectif ── */}
              <div className="space-y-2">
                <Label>Votre objectif principal</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGoal(g.value)}
                      className={`rounded-lg border px-3 py-2 text-sm text-left transition-all ${
                        goal === g.value
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                {goal && (
                  <p className="text-xs text-muted-foreground">
                    Calories/jour estimées : <span className="font-medium text-foreground">{DAILY_KCAL[goal]} kcal</span>
                  </p>
                )}
              </div>

              {/* ── Erreur / Succès ── */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <AlertDescription>
                    Compte créé ! Vérifiez vos emails pour confirmer votre inscription.
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={submitting || success}>
                {submitting ? "Création…" : "Créer mon compte"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Déjà inscrit ?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
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