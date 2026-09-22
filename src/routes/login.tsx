import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Activity, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { PENDING_PROFILE_KEY } from "@/routes/register";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — DietFitPro" },
      { name: "description", content: "Connectez-vous à votre espace DietFitPro." },
    ],
  }),
  component: LoginPage,
});

// Si un profil nutrition (poids, taille, objectif, calculs BMR/TDEE...) a été
// mis en attente lors de l'inscription (cas "confirmation email requise"),
// on l'applique ici à la table profiles, une seule fois, puis on nettoie.
async function applyPendingProfileIfAny(userId: string) {
  if (typeof window === "undefined") return;

  const raw = window.localStorage.getItem(PENDING_PROFILE_KEY);
  if (!raw) return;

  try {
    const pendingProfile = JSON.parse(raw);

    const { error } = await supabase
      .from("profiles")
      .update(pendingProfile)
      .eq("id", userId);

    if (error) {
      console.error("[login] Erreur application profil en attente :", error);
      return; // on garde le pending en local, on retentera au prochain login
    }

    window.localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch (err) {
    console.error("[login] Erreur lecture profil en attente :", err);
  }
}

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    
    try {
      await signIn(email.trim(), password);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Rattrapage : applique le profil nutrition resté en attente
        // depuis une inscription qui nécessitait une confirmation email.
        await applyPendingProfileIfAny(session.user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        
        const userRole = profile?.role as "pro" | "patient" | "subscriber" | null;
        
        if (userRole === "pro") {
          void navigate({ to: "/pro/dashboard" });
        } else if (userRole === "patient") {
          void navigate({ to: "/patient/dashboard" });
        } else if (userRole === "subscriber") {
          void navigate({ to: "/home" });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
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
            <CardTitle>Connexion</CardTitle>
            <CardDescription>Accédez à votre espace personnel</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="login">Connexion</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        disabled={submitting}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Connexion…" : "Se connecter"}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Pas de compte ?{" "}
                    <Link to="/register" className="font-medium text-primary hover:underline">
                      S'inscrire
                    </Link>
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}