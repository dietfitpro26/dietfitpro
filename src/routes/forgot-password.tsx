import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";


export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — DietFitPro" },
      {
        name: "description",
        content: "Recevez un lien pour choisir un nouveau mot de passe.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});


function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);


  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (submittingRef.current) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Veuillez saisir votre adresse e-mail.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo: `${window.location.origin}/reset-password` },
      );

      if (resetError) {
        console.error("[forgot-password]", resetError);
        setError(
          "L'e-mail n'a pas pu être envoyé pour le moment. Patientez quelques minutes puis réessayez.",
        );
        return;
      }

      setSent(true);
    } catch (caughtError) {
      console.error("[forgot-password]", caughtError);
      setError("Une erreur est survenue. Réessayez dans quelques instants.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Connexion
          </Link>
        </div>

        <div className="rounded-3xl border bg-card p-8 shadow-sm">
          {sent ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-8 w-8" />
              </div>
              <h1 className="text-3xl font-extrabold">Vérifiez vos e-mails</h1>
              <p className="text-muted-foreground">
                Si un compte existe avec l'adresse{" "}
                <span className="font-semibold text-foreground">
                  {email.trim().toLowerCase()}
                </span>
                , vous allez recevoir un lien pour choisir un nouveau mot de passe.
              </p>
              <p className="text-sm text-muted-foreground">
                Pensez à regarder vos courriers indésirables. Le lien est valable un temps
                limité.
              </p>
              <Button asChild className="h-12 w-full rounded-full text-base font-bold">
                <Link to="/login">Retour à la connexion</Link>
              </Button>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Renvoyer un e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="text-3xl font-extrabold">Mot de passe oublié ?</h1>
                <p className="mt-2 text-muted-foreground">
                  Saisissez votre adresse e-mail. Nous vous envoyons un lien pour en
                  choisir un nouveau.
                </p>
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
                  disabled={submitting}
                  className="h-12 rounded-xl text-base"
                  placeholder="vous@exemple.fr"
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
                {submitting ? "Envoi…" : "Recevoir le lien"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}