import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Salad,
  BookOpen,
  Dumbbell,
  MessageSquare,
  Video,
  Bell,
  UserCheck,
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
  { to: "/pro/patients", label: "Mes patients", icon: Users },
  { to: "/pro/consultations", label: "Consultations", icon: Video },
  { to: "/pro/nutrition", label: "Programmes nutrition", icon: Salad },
  { to: "/pro/sport", label: "Programmes sport", icon: Dumbbell },
  { to: "/pro/messages", label: "Messagerie", icon: MessageSquare },
  { to: "/pro/notifications", label: "Notifications", icon: Bell },
  { to: "/pro/subscribers", label: "Abonnés", icon: UserCheck },
  { to: "/pro/recipes", label: "Mes recettes", icon: BookOpen },
  { to: "/pro/settings", label: "Paramètres", icon: Settings },
] as const;

export function ProLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { totalUnread: unreadMessages } = useConversations();

  const initials = (profile?.full_name ?? profile?.email ?? "?")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  const SidebarInner = (
    <div className="flex h-full w-64 flex-col bg-[#1A1A1A] text-white">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <Logo className="[&_span]:text-white [&_span:last-child]:text-white/60" />

        <button
          type="button"
          className="text-white/70 transition-colors hover:text-white md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Navigation professionnelle"
      >
        {NAV.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-[#6DB33F] font-medium text-white shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>

              {item.to === "/pro/messages" && unreadMessages > 0 ? (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#6DB33F] px-1 text-[10px] font-semibold text-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 p-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-[#6DB33F] text-xs text-white">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {profile?.full_name ?? profile?.email ?? "Professionnel"}
          </p>
          <span className="mt-0.5 inline-block rounded-full bg-[#6DB33F] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Professionnel
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => void handleSignOut()}
          aria-label="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <UpcomingConsultationReminder />

      <aside className="fixed inset-y-0 left-0 z-40 hidden md:block">
        {SidebarInner}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="relative">{SidebarInner}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Logo />

          <NotificationBell to="/pro/notifications" />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}