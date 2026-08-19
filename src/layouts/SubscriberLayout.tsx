import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Utensils,
  Dumbbell,
  TrendingUp,
  LogOut,
  User,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
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
];

export function SubscriberLayout({
  children,
  streak = 0,
}: {
  children: ReactNode;
  streak?: number;
}) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

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

            {streak > 0 ? (
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

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] backdrop-blur">
        <div
          className="mx-auto grid h-[4.5rem] w-full max-w-6xl grid-cols-4"
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
    </div>
  );
}