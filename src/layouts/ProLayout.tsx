import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Salad,
  BookOpen,
  Dumbbell,
  MessageSquare,
  Calendar,
  Video,
  Bell,
  Rss,
  UserCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { UpcomingConsultationReminder } from "@/components/UpcomingConsultationReminder";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/hooks/useMessages";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/pro/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pro/patients", label: "Mes Patients", icon: Users },
  { to: "/pro/nutrition", label: "Programmes Nutrition", icon: Salad },
  { to: "/pro/recipes", label: "Mes Recettes", icon: BookOpen },
  { to: "/pro/sport", label: "Programmes Sport", icon: Dumbbell },
  { to: "/pro/messages", label: "Messagerie", icon: MessageSquare },
  { to: "/pro/calendar", label: "Agenda", icon: Calendar },
  { to: "/pro/visio", label: "Visios", icon: Video },
  { to: "/pro/notifications", label: "Notifications", icon: Bell },
  { to: "/pro/feed", label: "Feed", icon: Rss },
  { to: "/pro/subscribers", label: "Abonnés", icon: UserCheck },
  { to: "/pro/analytics", label: "Statistiques", icon: BarChart3 },
  { to: "/pro/settings", label: "Paramètres", icon: Settings },
] as const;

export function ProLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { totalUnread: unreadMessages } = useConversations();

  const initials = (profile?.full_name ?? profile?.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const SidebarInner = (
    <div className="flex h-full w-60 flex-col bg-[#1A1A1A] text-white">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <Logo className="[&_span]:text-white [&_span:last-child]:text-white/60" />
        <button
          className="md:hidden text-white/70"
          onClick={() => setOpen(false)}
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[#6DB33F] text-white"
                  : "text-white/80 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{item.label}</span>
              {item.to === "/pro/messages" && unreadMessages > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#6DB33F] text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-[#6DB33F] text-white text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {profile?.full_name ?? profile?.email ?? "Pro"}
          </p>
          <span className="inline-block mt-0.5 rounded-full bg-[#6DB33F] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Pro
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => void signOut()}
          aria-label="Déconnexion"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <UpcomingConsultationReminder />
      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed inset-y-0 left-0 z-40">{SidebarInner}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative">{SidebarInner}</div>
        </div>
      )}

      <div className="flex-1 md:ml-60 flex flex-col">
        <header className="md:hidden h-14 flex items-center justify-between border-b px-4 bg-background">
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
          <NotificationBell to="/pro/notifications" />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
