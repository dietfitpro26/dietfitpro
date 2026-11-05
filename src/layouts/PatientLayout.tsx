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
import { WeeklyCheckinDialog } from "@/components/gamification/WeeklyCheckinDialog";
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



      <header className="sticky top-0 z-30 border-b bg-background/95 shadow-sm backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Logo />



          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <span
              className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 font-bold text-orange-600"
              title={`${streak} jours consécutifs`}
            >
              <Flame className="h-4 w-4" /> {streak}
            </span>



            {firstName && (
              <span className="hidden rounded-full bg-accent px-3 py-1.5 font-semibold text-accent-foreground sm:inline-flex">
                {firstName}
              </span>
            )}



            <MessagesBell to="/patient/messages" />



            <NotificationBell to="/patient/notifications" />



            <Link
              to="/patient/profil"
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
              title="Profil"
              aria-label="Profil"
            >
              <User className="h-5 w-5" />
            </Link>



            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>



      <main className="flex-1 pb-28">{children}</main>



      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur">
        <div
          className="mx-auto grid h-[4.75rem] w-full max-w-6xl grid-cols-6"
          aria-label="Navigation principale"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
            const Icon = tab.icon;
            const isMessages = tab.to === "/patient/messages";



            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-0.5 text-[11px] transition-colors sm:text-sm",
                  active
                    ? "font-bold text-primary"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-11 items-center justify-center rounded-full transition-colors sm:w-14",
                    active ? "bg-primary text-primary-foreground" : "bg-transparent",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {isMessages && unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>



                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>



      <WeeklyCheckinDialog />
    </div>
  );
}