import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Utensils,
  Dumbbell,
  TrendingUp,
  Rss,
  MessageSquare,
  Flame,
  LogOut,
  User,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useAccessRights } from "@/hooks/useAccessRights";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: React.ElementType;
};

const BASE_TABS: Tab[] = [
  { to: "/home", label: "Accueil", icon: Home },
  { to: "/subscriber/nutrition", label: "Nutrition", icon: Utensils },
  { to: "/subscriber/sport", label: "Sport", icon: Dumbbell },
  { to: "/progress", label: "Progression", icon: TrendingUp },
  { to: "/feed", label: "Feed", icon: Rss },
];

const MESSAGES_TAB: Tab = {
  to: "/messages",
  label: "Messages",
  icon: MessageSquare,
};

export function SubscriberLayout({
  children,
  streak = 0,
}: {
  children: ReactNode;
  streak?: number;
}) {
  const { profile, signOut } = useAuth();
  const { rights } = useAccessRights();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const tabs: Tab[] = rights?.access_messaging
    ? [...BASE_TABS, MESSAGES_TAB]
    : BASE_TABS;

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />

          <div className="flex items-center gap-3 text-sm">
            {firstName && (
              <span className="hidden font-medium sm:inline">{firstName}</span>
            )}

            <span className="flex items-center gap-1 text-[#6DB33F] font-semibold">
              <Flame className="h-4 w-4" /> {streak}
            </span>

            <Link
              to="/subscriber/profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Profil"
              aria-label="Profil"
            >
              <User className="h-4 w-4" />
            </Link>

            <button
              onClick={handleSignOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background">
        <div className="grid h-16 grid-cols-6">
          {tabs.map((tab) => {
            const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
            const Icon = tab.icon;

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-1 text-[10px] sm:text-[11px]",
                  active ? "text-[#6DB33F]" : "text-muted-foreground",
                )}
              >
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