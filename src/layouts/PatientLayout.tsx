import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, NotebookPen, ClipboardList, TrendingUp, MessageSquare, Flame } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/patient/home", label: "Accueil", icon: Home },
  { to: "/patient/journal", label: "Mon Journal", icon: NotebookPen },
  { to: "/patient/programs", label: "Mes Programmes", icon: ClipboardList },
  { to: "/patient/progress", label: "Ma Progression", icon: TrendingUp },
  { to: "/patient/messages", label: "Messages", icon: MessageSquare },
] as const;

export function PatientLayout({ children, streak = 0 }: { children: ReactNode; streak?: number }) {
  const { profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="h-14 flex items-center justify-between border-b px-4 bg-background sticky top-0 z-30">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          {firstName && <span className="font-medium">{firstName}</span>}
          <span className="flex items-center gap-1 text-[#6DB33F] font-semibold">
            <Flame className="h-4 w-4" /> {streak}
          </span>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t flex justify-around h-16">
        {TABS.map((tab) => {
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
