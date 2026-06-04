import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  NotebookPen,
  Sparkles,
  TrendingUp,
  Rss,
  MessageSquare,
  Flame,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useAccessRights } from "@/hooks/useAccessRights";
import { cn } from "@/lib/utils";

const BASE_TABS = [
  { to: "/home", label: "Accueil", icon: Home },
  { to: "/journal", label: "Mon Journal", icon: NotebookPen },
  { to: "/ai-coach", label: "Coach IA", icon: Sparkles },
  { to: "/progress", label: "Ma Progression", icon: TrendingUp },
  { to: "/feed", label: "Feed", icon: Rss },
] as const;

const MESSAGES_TAB = { to: "/messages", label: "Messages", icon: MessageSquare } as const;

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

  const tabs = rights?.messaging ? [...BASE_TABS, MESSAGES_TAB] : BASE_TABS;

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="h-14 flex items-center justify-between border-b px-4 bg-background sticky top-0 z-30">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          {firstName && <span className="font-medium">{firstName}</span>}
          <span className="flex items-center gap-1 text-[#6DB33F] font-semibold">
            <Flame className="h-4 w-4" /> {streak}
          </span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t flex justify-around h-16">
        {tabs.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-1 text-[11px]",
                active ? "text-[#6DB33F]" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
