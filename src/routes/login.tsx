import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
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
import { startCheckout } from "@/lib/billing";
import {
  clearPendingProfile,
  getPendingRegistration,
  takePendingPlan,
} from "@/lib/pendingRegistration";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — DietFitPro" },
      {
        name: "description",
        content: "Connectez-vous à votre espace DietFitPro.",
      },
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();

    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        throw new Error(
          "Votre session n'a pas pu être récupérée. Réessayez de vous connecter.",
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, profile_complete")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[login] Lecture du profil :", profileError);
        throw new Error(
          "Votre connexion a réussi, mais votre profil n'a pas pu être chargé. Réessayez dans quelques instants.",
        );
      }

      if (!profile) {
        throw new Error(
          "Aucun profil n'est associé à ce compte. Contactez votre professionnel.",
        );
      }

      if (profile.role === "pro") {
        await navigate({ to: "/pro/dashboard", replace: true });
        return;
      }

      if (profile.role === "patient") {
        await navigate({ to: "/patient/dashboard", replace: true });
        return;
      }

      if (profile.role !== "subscriber") {
        throw new Error(
          "Le rôle de ce compte n'est pas reconnu. Contactez votre professionnel.",
        );
      }

      const pending = getPendingRegistration(session.user.id);
      let pendingCleanupSucceeded = true;

      if (pending?.profile) {
        // Un profil déjà terminé ne doit pas être écrasé
        // par une ancienne copie conservée dans le navigateur.
        if (profile.profile_complete !== true) {
          const { data: updatedProfile, error: updateError } =
            await supabase
              .from("profiles")
              .update(pending.profile)
              .eq("id", session.user.id)
              .eq("role", "subscriber")
              .select("id")
              .maybeSingle();

          if (updateError || !updatedProfile) {
            console.error(
              "[login] Application du profil en attente :",
              updateError,
            );

            throw new Error(
              "Vous êtes connecté, mais vos informations d'inscription n'ont pas pu être enregistrées. Réessayez ; elles restent en attente sur ce navigateur.",
            );
          }
        }

        pendingCleanupSucceeded = clearPendingProfile(session.user.id);

        if (!pendingCleanupSucceeded) {
          toast.warning(
            "Le nettoyage des informations temporaires a échoué. Vérifiez votre profil avant de poursuivre.",
          );
        }
      }

      const pendingPlan = pendingCleanupSucceeded
        ? takePendingPlan(session.user.id)
        : null;

      if (pendingPlan) {
        try {
          await startCheckout({
            kind: "subscription",
            plan: pendingPlan,
          });
          return;
        } catch (checkoutError) {
          console.error(
            "[login] Ouverture du paiement :",
            checkoutError,
          );

          toast.error(
            checkoutError instanceof Error
              ? checkoutError.message
              : "Le paiement n'a pas pu s'ouvrir. Retrouvez votre formule depuis votre profil.",
          );
        }
      }

      await navigate({ to: "/home", replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Erreur de connexion. Réessayez.",
      );
    } finally {
      submittingRef.current = false;
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
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Accédez à votre espace personnel
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  disabled={submitting}
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
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={submitting}
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

              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? "Connexion…" : "Se connecter"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Pas de compte ?{" "}
                <Link
                  to="/register"
                  className="font-medium text-primary hover:underline"
                >
                  S&apos;inscrire
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}