import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";


export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — DietFitPro" },
      {
        name: "description",
        content: "Choisissez un nouveau mot de passe pour votre compte.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

type LinkState = "checking" | "ready" | "invalid";


function ResetPasswordPage() {
  const navigate = useNavigate();

  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setLinkState("ready");
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setLinkState((previous) =>
        data.session ? "ready" : previous === "ready" ? "ready" : "invalid",
      );
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (submittingRef.current) return;

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error("[reset-password]", updateError);
        const text = updateError.message.toLowerCase();

        setError(
          text.includes("different from the old password")
            ? "Choisissez un mot de passe différent de l'ancien."
            : text.includes("weak") || text.includes("password should")
              ? "Ce mot de passe est trop faible. Choisissez-en un plus long ou plus varié."
              : "Le mot de passe n'a pas pu être modifié. Le lien a peut-être expiré : demandez-en un nouveau.",
        );
        return;
      }

      await supabase.auth.signOut();
      toast.success("Mot de passe modifié. Connectez-vous avec le nouveau.");
      await navigate({ to: "/login", replace: true });
    } catch (caughtError) {
      console.error("[reset-password]", caughtError);
      setError("Une erreur est survenue. Réessayez dans quelques instants.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Logo />
        </div>

        <div className="rounded-3xl border bg-card p-8 shadow-sm">
          {linkState === "checking" && (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              Vérification du lien…
            </div>
          )}

          {linkState === "invalid" && (
            <div className="space-y-5 text-center">
              <h1 className="text-3xl font-extrabold">Lien expiré ou invalide</h1>
              <p className="text-muted-foreground">
                Ce lien n'est plus valable. Demandez-en un nouveau, il ne prend
                qu'une minute.
              </p>
              <Button asChild className="h-12 w-full rounded-full text-base font-bold">
                <Link to="/forgot-password">Demander un nouveau lien</Link>
              </Button>
              <Link
                to="/login"
                className="block text-sm font-semibold text-primary hover:underline"
              >
                Retour à la connexion
              </Link>
            </div>
          )}

          {linkState === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="text-3xl font-extrabold">Nouveau mot de passe</h1>
                <p className="mt-2 text-muted-foreground">
                  Choisissez un mot de passe d'au moins 6 caractères.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-base font-semibold">
                  Nouveau mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={submitting}
                    className="h-12 rounded-xl pr-12 text-base"
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
                    disabled={submitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-base font-semibold">
                  Confirmer le mot de passe
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                  className="h-12 rounded-xl text-base"
                />
              </div>

              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-full text-base font-bold shadow-lg shadow-primary/30"
              >
                {submitting ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}