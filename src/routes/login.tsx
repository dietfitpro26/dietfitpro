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
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    
    try {
      await signIn(email.trim(), password);
      
      // ✅ Récupérer la session et le profil pour rediriger
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Récupérer le profil pour connaître le rôle
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        
        const userRole = profile?.role as "pro" | "patient" | "subscriber" | null;
        
        // ✅ Rediriger selon le rôle
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

  const handleInvitation = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmedCode = code.trim().toUpperCase();

    if (trimmedCode.length !== 8) {
      setError("Le code d'invitation doit contenir 8 caractères.");
      return;
    }

    setSubmitting(true);

    try {
      await signIn(email.trim(), password);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Connexion impossible.");

      const { error: invitationError } = await supabase.rpc("activate_invitation_code", {
        p_code: trimmedCode,
      });

      if (invitationError) throw invitationError;

      // ✅ Nouveau patient avec code → /bienvenue pour finaliser
      await navigate({ to: "/bienvenue" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'activation du compte");
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
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-inv">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="password-inv"
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
                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
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