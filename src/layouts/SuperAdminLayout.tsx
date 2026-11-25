import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { SuperAdminAccessGate } from "@/components/admin/SuperAdminAccess";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { to: "/admin", label: "Vue d’ensemble", icon: LayoutDashboard },
  { to: "/admin/community", label: "Communauté et modération", icon: MessagesSquare },
  { to: "/admin/premium", label: "Droits Premium", icon: ShieldCheck },
  { to: "/admin/security", label: "Compte et sécurité", icon: Settings2 },
] as const;

function AdminShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login", replace: true });
  };

  const sidebar = (
    <div className="flex h-full w-[17rem] flex-col border-r border-white/10 bg-[#191b18] text-white">
      <div className="flex h-[4.5rem] items-center justify-between border-b border-white/10 px-5">
        <Logo className="[&_span]:!text-white [&_span:last-child]:!text-[#6DB33F]" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 pb-2 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          Espace de travail
        </p>
        <p className="mt-1 text-sm font-medium text-white/90">Super Administrateur</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Navigation administrateur">
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                active
                  ? "bg-[#6DB33F] font-semibold text-[#182116]"
                  : "text-white/72 hover:bg-white/8 hover:text-white",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <Link
          to="/pro/dashboard"
          className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-white/65 transition-colors hover:bg-white/8 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Espace professionnel
        </Link>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6DB33F] text-xs font-bold text-[#182116]">
            {(profile?.full_name ?? profile?.email ?? "SA").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{profile?.full_name ?? profile?.email ?? "Administrateur"}</p>
            <p className="mt-0.5 text-[10px] text-white/50">Super Administrateur</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/65 hover:bg-white/10 hover:text-white"
            onClick={() => void handleSignOut()}
            aria-label="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside className="fixed inset-y-0 left-0 z-40 hidden md:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-[17rem]">
        <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b border-stone-200/80 bg-background/95 px-4 backdrop-blur-sm md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Ouvrir le menu administrateur"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
          <ShieldCheck className="h-5 w-5 text-primary" aria-label="Espace administrateur" />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <SuperAdminAccessGate>
      <AdminShell>{children}</AdminShell>
    </SuperAdminAccessGate>
  );
}
