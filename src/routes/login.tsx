import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  HeartHandshake,
  LineChart,
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panneau de présentation (ordinateur uniquement) */}
      <aside className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />

        <Link
          to="/"
          className="relative inline-flex items-center gap-2 text-sm font-semibold text-background/80 hover:text-background"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'accueil
        </Link>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="rotate-2 rounded-[2rem] bg-white p-6 shadow-2xl">
            <img src="/logo.png" alt="DietFitPro" className="w-full object-contain" />
          </div>
        </div>

        <div className="relative space-y-5">
          <h2 className="text-4xl font-extrabold leading-tight">
            Content de vous revoir.
            <br />
            <span className="text-brand">Continuez sur votre lancée.</span>
          </h2>

          <ul className="space-y-3 text-lg font-medium text-background/90">
            <li className="flex items-center gap-3">
              <LineChart className="h-6 w-6 text-brand" />
              Un suivi clair de vos résultats
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
        </div>
      </aside>

      {/* Formulaire */}
      <main className="flex items-center justify-center bg-background px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
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
            <h1 className="text-4xl font-extrabold">Connexion</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Accédez à votre espace personnel
            </p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
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


            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-base font-semibold">
                  Mot de passe
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
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


            {error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}


            <Button
              type="submit"
              className="h-12 w-full rounded-full text-base font-bold shadow-lg shadow-primary/30"
              disabled={submitting}
            >
              {submitting ? "Connexion…" : "Se connecter"}
            </Button>


            <p className="text-center text-base text-muted-foreground">
              Pas de compte ?{" "}
              <Link
                to="/register"
                className="font-bold text-primary hover:underline"
              >
                S&apos;inscrire
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}