import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";


export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <a href="/" className="text-sm font-medium text-[#2D7A1F] hover:underline">
            Retour à l'accueil
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Dernière mise à jour : {updatedAt}</p>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">{children}</div>
      </main>

      <footer className="border-t bg-background/95">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <a href="/mentions-legales" className="hover:underline">Mentions légales</a>
          <a href="/cgv" className="hover:underline">Conditions générales de vente</a>
          <a href="/confidentialite" className="hover:underline">Politique de confidentialité</a>
        </div>
      </footer>
    </div>
  );
}


export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}