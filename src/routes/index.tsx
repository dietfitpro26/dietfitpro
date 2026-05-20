import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Apple, Dumbbell, Brain, MessageCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DietFitPro (DFP) — Coach Nutrition, Diététique & Sport" },
      {
        name: "description",
        content:
          "DietFitPro : votre coach nutrition et sport personnalisé. Suivi diététique, programmes alimentaires et coaching sportif par un professionnel.",
      },
      { property: "og:title", content: "DietFitPro — Votre coach nutrition & sport" },
      {
        property: "og:description",
        content: "Pas de régime, juste de meilleures habitudes. Votre expert en poche.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Apple,
    title: "Nutrition comportementale",
    desc: "Sans comptage calorique. Faim, satiété, humeur, énergie — l'essentiel.",
  },
  {
    icon: Dumbbell,
    title: "Programmes sportifs sur-mesure",
    desc: "Conçus par votre coach selon votre profil et vos objectifs.",
  },
  {
    icon: Brain,
    title: "Coach IA 24/7",
    desc: "Un assistant qui connaît votre profil et vos progrès, jour et nuit.",
  },
  {
    icon: MessageCircle,
    title: "Messagerie avec David",
    desc: "Échangez directement avec votre coach quand vous en avez besoin.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/">Connexion</Link>
            </Button>
            <Button asChild>
              <Link to="/">Essai gratuit 3 jours</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Par David — Diététicien-nutritionniste & Coach sportif
          </p>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
            Pas de régime,
            <br />
            <span className="text-primary">juste de meilleures habitudes.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Une expérience humaine, guidée par l'IA, contrôlée par un professionnel. Votre coach
            nutrition, sport et bien-être en poche.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link to="/">Démarrer mon essai gratuit</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <Link to="/">J'ai un code d'invitation</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            3 jours gratuits · Sans engagement · Annulable à tout moment
          </p>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              Tout ce dont vous avez besoin pour avancer
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <Card key={f.title} className="p-6 transition-shadow hover:shadow-md">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">Des formules simples</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <Card className="p-8">
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Basic
                </p>
                <p className="mt-3 text-4xl font-bold">
                  9,99€<span className="text-base font-normal text-muted-foreground">/mois</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {["Journal comportemental", "Coach IA (5 msg/jour)", "Programmes auto", "Feed & gamification"].map(
                    (item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </Card>

              <Card className="relative border-primary p-8 shadow-lg">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Recommandé
                </span>
                <p className="text-sm font-medium uppercase tracking-wider text-primary">Premium</p>
                <p className="mt-3 text-4xl font-bold">
                  25,99€<span className="text-base font-normal text-muted-foreground">/mois</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Tout Basic, en illimité",
                    "Coach IA illimité",
                    "Recettes du pro",
                    "Programmes sport sur-mesure",
                    "Messagerie avec David",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-8">
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Visio
                </p>
                <p className="mt-3 text-4xl font-bold">
                  30€<span className="text-base font-normal text-muted-foreground">/session</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {["20-30 min avec David", "Via WhatsApp", "Compte-rendu inclus", "Sans engagement"].map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 2026 DietFitPro · Diet N Trainer · David
      </footer>
    </div>
  );
}
