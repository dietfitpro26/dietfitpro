import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Utensils,
  Dumbbell,
  TrendingUp,
  Rss,
  LogOut,
  User,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { WeeklyCheckinDialog } from "@/components/gamification/WeeklyCheckinDialog";
import { PastDueBanner } from "@/components/billing/PastDueBanner";
import { SuspendedAccountScreen } from "@/components/billing/SuspendedAccountScreen";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAccessState } from "@/hooks/useAccessState";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: React.ElementType;
};

const SUBSCRIBER_TABS: Tab[] = [
  { to: "/home", label: "Accueil", icon: Home },
  { to: "/subscriber/nutrition", label: "Nutrition", icon: Utensils },
  { to: "/subscriber/sport", label: "Sport", icon: Dumbbell },
  { to: "/progress", label: "Progression", icon: TrendingUp },
  { to: "/feed", label: "Feed", icon: Rss },
];

// Pages encore visibles quand l'abonnement est suspendu : uniquement le profil.
const PROFILE_PATH = "/subscriber/profile";

// Mémoire courte entre le rechargement de l'accueil et l'affichage du bandeau « Paiement confirmé ».
const CONFIRMED_KEY = "dietfitpro_checkout_confirmed";

// Après un retour de Stripe : on relit l'abonnement toutes les 2 secondes, pendant 30 secondes maximum.
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

export function SubscriberLayout({
  children,
  streak = 0,
}: {
  children: ReactNode;
  streak?: number;
}) {
  const { profile, role, signOut } = useAuth();
  const { state, loading: accessLoading } = useAccessState();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutDelayed, setCheckoutDelayed] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const isProfilePage = pathname === PROFILE_PATH || pathname.startsWith(`${PROFILE_PATH}/`);
  const isSuspended = state === "suspended";
  const showSuspendedScreen = isSuspended && !isProfilePage;

  // 1. Retour de Stripe : l'adresse contient ?checkout=success.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") setCheckoutPending(true);
  }, []);

  // 2. Bandeau « Paiement confirmé » après le rechargement de l'accueil.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.sessionStorage.getItem(CONFIRMED_KEY)) {
      window.sessionStorage.removeItem(CONFIRMED_KEY);
      setPaymentConfirmed(true);

      const timer = window.setTimeout(() => setPaymentConfirmed(false), 8000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  // 3. Tant que l'abonnement n'est pas actif, on le relit toutes les 2 secondes.
  useEffect(() => {
    if (!checkoutPending) return;

    let attempts = 0;

    const interval = window.setInterval(() => {
      attempts += 1;

      void queryClient.invalidateQueries({ queryKey: ["access-state"] });
      void queryClient.invalidateQueries({ queryKey: ["my-billing"] });

      if (attempts >= POLL_MAX_ATTEMPTS) {
        window.clearInterval(interval);
        setCheckoutDelayed(true);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [checkoutPending, queryClient]);

  // 4. Abonnement actif : on recharge l'accueil proprement pour relire les droits Basic / Premium.
  useEffect(() => {
    if (!checkoutPending) return;
    if (role !== "subscriber" || accessLoading) return;
    if (state === "suspended") return;

    window.sessionStorage.setItem(CONFIRMED_KEY, "1");
    window.location.replace("/home");
  }, [checkoutPending, role, accessLoading, state]);

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />

          <div className="flex items-center gap-2 text-sm sm:gap-3">
            {firstName ? (
              <span className="hidden font-medium sm:inline">{firstName}</span>
            ) : null}

            {streak > 0 && !isSuspended ? (
              <span
                className="hidden items-center gap-1 rounded-full bg-[#6DB33F]/10 px-2.5 py-1 font-semibold text-[#6DB33F] sm:flex"
                title={`${streak} jours consécutifs`}
              >
                {streak} jours
              </span>
            ) : null}

            <Link
              to="/subscriber/profile"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border bg-background",
                "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              )}
              title="Mon profil"
              aria-label="Mon profil"
            >
              <User className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border bg-background",
                "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              )}
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {state === "past_due" ? <PastDueBanner /> : null}

      {paymentConfirmed ? (
        <div className="border-b border-[#6DB33F]/30 bg-[#6DB33F]/10 px-4 py-3 text-center text-sm font-medium text-[#2D7A1F]">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Paiement confirmé, merci ! Votre accès est activé.
          </span>
        </div>
      ) : null}

      <main className="flex-1 pb-24">
        {checkoutPending && isSuspended ? (
          <div className="p-4 sm:p-6">
            <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-8 text-center shadow-sm">
              {checkoutDelayed ? (
                <>
                  <h2 className="text-xl font-semibold">L'activation prend un peu plus de temps</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Votre paiement a bien été transmis, mais la confirmation n'est pas encore
                    arrivée. Actualisez la page dans un instant. Si rien ne change, contactez
                    votre professionnel : votre paiement ne sera pas perdu.
                  </p>
                  <Button
                    className="mt-5 rounded-2xl"
                    onClick={() => window.location.replace("/home?checkout=success")}
                  >
                    Actualiser
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#6DB33F]" />
                  <h2 className="mt-4 text-xl font-semibold">Paiement reçu</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Activation de votre abonnement en cours, cela ne prend que quelques secondes…
                  </p>
                </>
              )}
            </div>
          </div>
        ) : showSuspendedScreen ? (
          <SuspendedAccountScreen />
        ) : (
          children
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] backdrop-blur">
        <div
          className="mx-auto grid h-[4.5rem] w-full max-w-6xl grid-cols-5"
          aria-label="Navigation principale"
        >
          {SUBSCRIBER_TABS.map((tab) => {
            const active =
              pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 px-1 text-[10px] transition-colors sm:text-[11px]",
                  active
                    ? "font-semibold text-[#6DB33F]"
                    : "text-muted-foreground hover:text-foreground",
                  isSuspended && "opacity-50",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active ? (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-[#6DB33F]" />
                ) : null}

                <Icon className="h-5 w-5" />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {!isSuspended ? <WeeklyCheckinDialog /> : null}
    </div>
  );
}