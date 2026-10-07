import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/bienvenue")({
  component: Bienvenue,
});

const LINK_ERROR =
  "Ce lien d'invitation est expiré ou a déjà été utilisé. Demandez une nouvelle invitation à votre professionnel.";

function Bienvenue() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Un lien d'invitation ne sert qu'une fois : on ne le traite qu'une seule fois.
    if (started.current) return;
    started.current = true;

    const loadSession = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const query = url.searchParams;

        const hashError = hash.get("error_description") || hash.get("error");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const tokenHash = query.get("token_hash");
        const otpType = query.get("type");
        const code = query.get("code");

        const hasLink = Boolean(accessToken || tokenHash || code || hashError);

        if (hashError) {
          window.history.replaceState({}, "", url.pathname);
          setError(LINK_ERROR);
          return;
        }

        // Le lien d'invitation est prioritaire sur une session déjà ouverte.
        if (accessToken && refreshToken) {
          const { error: setError_ } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setError_) throw setError_;
        } else if (tokenHash && otpType) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as EmailOtpType,
          });
          if (otpError) throw otpError;
        } else if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;
        }

        if (hasLink) {
          window.history.replaceState({}, "", url.pathname);
        }

        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !data.session?.user?.email) {
          setError(
            "Session invalide ou expirée. Demandez une nouvelle invitation à votre professionnel.",
          );
          return;
        }

        setUserEmail(data.session.user.email);
      } catch (caughtError) {
        console.error("[bienvenue] Erreur lien d'invitation :", caughtError);
        setError(LINK_ERROR);
      }
    };

    void loadSession();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      // Étape suivante : le questionnaire santé (anamnèse), 5 à 7 minutes.
      window.setTimeout(() => {
        void navigate({ to: "/patient/anamnese" });
      }, 1800);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Une erreur est survenue.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <section className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
          <h1 className="mb-3 text-2xl font-bold text-green-700">Mot de passe enregistré</h1>
          <p className="text-gray-600">
            Dernière étape : quelques questions (5 à 7 minutes) pour préparer votre
            accompagnement. Vous allez être redirigé.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Bienvenue sur DietFit Pro
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          Créez votre mot de passe pour activer votre espace patient.
        </p>

        {userEmail && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="email">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              value={userEmail}
              disabled
              className="w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="password">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Au moins 8 caractères"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="confirm-password"
            >
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Répétez votre mot de passe"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label={
                  showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"
                }
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !userEmail}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Enregistrement..." : "Valider mon mot de passe"}
          </button>
        </form>
      </section>
    </main>
  );
}