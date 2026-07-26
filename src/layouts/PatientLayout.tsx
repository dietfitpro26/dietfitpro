import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Utensils,
  Dumbbell,
  TrendingUp,
  MessageSquare,
  Rss,
  Flame,
  LogOut,
  User,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { MessagesBell } from "@/components/MessagesBell";
import { UpcomingConsultationReminder } from "@/components/UpcomingConsultationReminder";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useMessages";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: React.ElementType;
};

const TABS: Tab[] = [
  { to: "/patient/dashboard", label: "Accueil", icon: Home },
  { to: "/patient/nutrition", label: "Nutrition", icon: Utensils },
  { to: "/patient/sport", label: "Sport", icon: Dumbbell },
  { to: "/patient/mesures", label: "Progression", icon: TrendingUp },
  { to: "/patient/messages", label: "Messages", icon: MessageSquare },
  { to: "/patient/feed", label: "Feed", icon: Rss },
];

export function PatientLayout({
  children,
  streak = 0,
}: {
  children: ReactNode;
  streak?: number;
}) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const { totalUnread: unread } = useConversations();

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <UpcomingConsultationReminder />

      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />

          <div className="flex items-center gap-2 sm:gap-3 text-sm">
            {firstName && (
              <span className="hidden font-medium sm:inline">{firstName}</span>
            )}

            <span className="flex items-center gap-1 text-[#6DB33F] font-semibold">
              <Flame className="h-4 w-4" /> {streak}
            </span>

            <MessagesBell to="/patient/messages" />

            <NotificationBell to="/patient/notifications" />

            <Link
              to="/patient/profil"
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
          {TABS.map((tab) => {
            const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
            const Icon = tab.icon;
            const isMessages = tab.to === "/patient/messages";

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 px-1 text-[10px] sm:text-[11px]",
                  active ? "text-[#6DB33F]" : "text-muted-foreground",
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {isMessages && unread > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#6DB33F] text-white text-[10px] font-semibold flex items-center justify-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>

                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}