import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Video, User, Flame, MessageSquare } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { MessagesBell } from "@/components/MessagesBell";
import { UpcomingConsultationReminder } from "@/components/UpcomingConsultationReminder";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useMessages";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patient/consultations", label: "Consultations", icon: Video },
  { to: "/patient/messages", label: "Messages", icon: MessageSquare },
  { to: "/patient/profil", label: "Mon profil", icon: User },
] as const;

export function PatientLayout({ children, streak = 0 }: { children: ReactNode; streak?: number }) {
  const { profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <UpcomingConsultationReminder />
      <header className="h-14 flex items-center justify-between border-b px-4 bg-background sticky top-0 z-30">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          {firstName && <span className="font-medium">{firstName}</span>}
          <span className="flex items-center gap-1 text-[#6DB33F] font-semibold">
            <Flame className="h-4 w-4" /> {streak}
          </span>
          <MessagesBell to="/patient/messages" />
          <NotificationBell to="/patient/notifications" />
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t flex justify-around h-16">
        {TABS.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(tab.to + "/");
          const Icon = tab.icon;
          const isMessages = tab.to === "/patient/messages";
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-1 text-[11px] relative",
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
      </nav>
    </div>
  );
}
