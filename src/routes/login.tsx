import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_HOME } from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — DietFitPro" },
      { name: "description", content: "Connectez-vous à votre espace DietFitPro." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, role, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      // Redirige selon le rôle ; rôle null/inconnu → /home par défaut
      const target = role ? ROLE_HOME[role] : "/home";
      void navigate({ to: target });
    }
  }, [user, role, loading, navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvitation = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) {
      setError("Le code d'invitation doit contenir 8 caractères.");
      return;
    }
    setSubmitting(true);
    try {
      // Connexion d'abord
      await signIn(email, password);
      // Récupère l'utilisateur fraîchement connecté
      const { data: sessionData } = await supabase.auth.getUser();
      const uid = sessionData.user?.id;
      if (!uid) throw new Error("Connexion impossible.");

      // Vérifie le code
      const { data: codeRow, error: codeErr } = await supabase
        .from("invitation_codes")
        .select("id, pro_id, used_by, expires_at")
        .eq("code", trimmed)
        .maybeSingle();
      if (codeErr) throw codeErr;
      if (!codeRow) throw new Error("Code d'invitation invalide.");
      if (codeRow.used_by) throw new Error("Ce code a déjà été utilisé.");
      if (new Date(codeRow.expires_at) < new Date()) throw new Error("Code expiré.");

      // Marque le code utilisé + met à jour le profil
      const { error: upErr } = await supabase
        .from("invitation_codes")
        .update({ used_by: uid, used_at: new Date().toISOString() })
        .eq("id", codeRow.id);
      if (upErr) throw upErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ role: "patient", pro_id: codeRow.pro_id, plan: "patient" })
        .eq("id", uid);
      if (profErr) throw profErr;

      void navigate({ to: "/patient/home" as never });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="invitation">Code d'invitation</TabsTrigger>
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
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
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

              <TabsContent value="invitation" className="mt-4">
                <form onSubmit={handleInvitation} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-inv">Email</Label>
                    <Input
                      id="email-inv"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-inv">Mot de passe</Label>
                    <Input
                      id="password-inv"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code d'invitation (8 caractères)</Label>
                    <Input
                      id="code"
                      type="text"
                      required
                      maxLength={8}
                      minLength={8}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ABCD1234"
                      className="font-mono uppercase tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground">
                      Saisissez le code fourni par votre coach pour activer votre compte patient.
                    </p>
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Validation…" : "Activer mon compte patient"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
