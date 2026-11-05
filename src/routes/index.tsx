import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Apple,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  HeartHandshake,
  LineChart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DietFitPro — Nutrition, Sport, suivi et accompagnement" },
      {
        name: "description",
        content:
          "DietFitPro : programmes Nutrition et Sport conçus par des Diététiciens, Nutritionnistes et Personal Trainers, suivi personnalisé, accompagnement et communauté motivante.",
      },
      { property: "og:title", content: "DietFitPro — Votre coach Nutrition & Sport" },
      {
        property: "og:description",
        content: "Pas de régime, juste de meilleures habitudes. Essayez gratuitement.",
      },
    ],
  }),
  component: LandingPage,
});

/* ------------------------------------------------------------------ */
/* MÉDIAS : renseignez ces chemins quand vos fichiers sont prêts.      */
/* Placez les fichiers dans public/media/ puis écrivez par exemple :   */
/*   HERO_VIDEO = "/media/presentation.mp4"                            */
/*   PHOTOS = [{ src: "/media/photo-1.jpg", alt: "Séance de sport" }]  */
/* Tant que c'est vide, la section ne s'affiche pas.                   */
/* ------------------------------------------------------------------ */
const HERO_VIDEO: string = "";
const VIDEO_POSTER: string = "";
const PHOTOS: { src: string; alt: string }[] = [];

const MARQUEE = [
  "Suivi",
  "Accompagnement",
  "Nutrition",
  "Sport",
  "Motivation",
  "Résultats",
  "Communauté",
  "Habitudes durables",
];

const STEPS = [
  {
    n: "1",
    title: "Créez votre compte",
    desc: "Inscription en une minute, essai gratuit, sans engagement.",
  },
  {
    n: "2",
    title: "Suivez votre programme",
    desc: "Nutrition et Sport adaptés à votre objectif, simples à appliquer.",
  },
  {
    n: "3",
    title: "Progressez accompagné",
    desc: "Un suivi clair de vos résultats et une communauté qui vous motive.",
  },
];

const BASIC = [
  "3 programmes nutrition",
  "Journal alimentaire (historique 1 mois)",
  "Suivi de vos progrès",
  "Communauté : publier, commenter, rejoindre des groupes",
];

const PREMIUM = [
  "Tout le Basic",
  "12 programmes nutrition",
  "Programmes sport complets",
  "Journal alimentaire (historique 3 mois)",
  "Créer vos propres groupes",
  "Messagerie avec un professionnel",
  "Accès prioritaire",
];

const VISIO = [
  "20-30 min avec un expert",
  "Via WhatsApp",
  "Compte-rendu inclus",
  "Sans engagement",
];

const FAQ = [
  {
    q: "Dois-je compter mes calories ?",
    a: "Non. L'approche est comportementale : faim, satiété, humeur et énergie. Vous construisez de meilleures habitudes sans comptage permanent.",
  },
  {
    q: "Puis-je annuler quand je veux ?",
    a: "Oui. L'abonnement est sans engagement et annulable à tout moment depuis votre compte.",
  },
  {
    q: "Basic ou Premium : lequel choisir ?",
    a: "Le Basic est déjà un excellent départ : 3 programmes nutrition, votre journal, le suivi de vos progrès et toute la communauté pour vous motiver. Le Premium, c'est l'expérience complète : les 12 programmes nutrition, les programmes sport, un historique plus long, la création de vos propres groupes et la messagerie avec un professionnel. Commencez où vous voulez, vous pouvez passer au Premium à tout moment.",
  },
  {
    q: "Qui est derrière DietFitPro ?",
    a: "Une équipe de professionnels passionnés de la santé, de la nutrition et du sport. Leur mission : vous offrir un accompagnement sérieux, simple et motivant, pour des résultats qui durent.",
  },
];

const CHIP =
  "absolute flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold shadow-xl ring-1 ring-black/5 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm";

function Check({ dark = false }: { dark?: boolean }) {
  return (
    <CheckCircle2
      className={`mt-0.5 h-5 w-5 shrink-0 ${dark ? "text-brand" : "text-primary"}`}
    />
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes dfp-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes dfp-sway { 0%,100% { transform: rotate(1deg) translateY(0); } 50% { transform: rotate(3.5deg) translateY(-8px); } }
        @keyframes dfp-pulse { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: .7; transform: scale(1.08); } }
        @keyframes dfp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes dfp-shimmer { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }
        @keyframes dfp-words {
          0%,16% { transform: translateY(0); }
          20%,36% { transform: translateY(-20%); }
          40%,56% { transform: translateY(-40%); }
          60%,76% { transform: translateY(-60%); }
          80%,100% { transform: translateY(-80%); }
        }
        .dfp-float { animation: dfp-float 5s ease-in-out infinite; }
        .dfp-float-slow { animation: dfp-float 7s ease-in-out infinite; }
        .dfp-sway { animation: dfp-sway 6s ease-in-out infinite; }
        .dfp-pulse { animation: dfp-pulse 4s ease-in-out infinite; }
        .dfp-marquee { animation: dfp-marquee 28s linear infinite; }
        .dfp-words { animation: dfp-words 10s ease-in-out infinite; }
        .dfp-shimmer {
          background-image: linear-gradient(110deg, var(--primary) 0%, var(--brand) 35%, var(--primary) 70%, var(--brand) 100%);
          background-size: 200% 100%;
          animation: dfp-shimmer 4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .dfp-float, .dfp-float-slow, .dfp-sway, .dfp-pulse, .dfp-marquee, .dfp-words, .dfp-shimmer { animation: none; }
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Se connecter</Link>
            </Button>
            <Button className="rounded-full px-5 font-bold" asChild>
              <Link to="/register">Essai gratuit</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Pastille dynamique */}
              <div className="dfp-shimmer mb-7 inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-base font-extrabold text-white shadow-lg shadow-primary/30 sm:text-lg">
                <Sparkles className="h-5 w-5 shrink-0" />
                <span>Nutrition & Sport :</span>
                <span className="inline-block h-[1.5em] overflow-hidden rounded-full bg-white px-3 align-middle text-primary">
                  <span className="dfp-words flex flex-col items-center leading-[1.5]">
                    <span>Suivi</span>
                    <span>Accompagnement</span>
                    <span>Motivation</span>
                    <span>Résultats</span>
                    <span>Suivi</span>
                  </span>
                </span>
              </div>

              <h1 className="text-5xl font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl">
                Pas de régime.
                <br />
                <span className="text-primary">Juste de meilleures habitudes.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
                Un suivi personnalisé, un accompagnement par des professionnels et une
                communauté qui vous motive : tout pour transformer durablement votre
                alimentation et votre forme.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="h-14 rounded-full px-8 text-lg font-bold shadow-lg shadow-primary/30"
                  asChild
                >
                  <Link to="/register">
                    Démarrer mon essai gratuit
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-full px-8 text-lg"
                  asChild
                >
                  <Link to="/login">Se connecter</Link>
                </Button>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
                {["Essai gratuit", "Sans engagement", "Annulable à tout moment"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Logo animé + pastilles */}
            <div className="relative mx-auto w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
              <div className="dfp-pulse absolute inset-0 -z-10 scale-110 rounded-[2.5rem] bg-brand/40 blur-2xl" />
              <div className="dfp-sway rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-black/5">
                <img src="/logo.png" alt="DietFitPro" className="w-full object-contain" />
              </div>

              <div className={`${CHIP} dfp-float -left-2 -top-3 bg-white sm:-left-10`}>
                <Apple className="h-4 w-4 text-primary sm:h-5 sm:w-5" /> Nutrition
              </div>
              <div
                className={`${CHIP} dfp-float-slow -right-2 top-4 bg-white sm:-right-10`}
                style={{ animationDelay: "0.6s" }}
              >
                <Dumbbell className="h-4 w-4 text-primary sm:h-5 sm:w-5" /> Sport
              </div>
              <div
                className={`${CHIP} dfp-float -left-3 top-[42%] bg-white sm:-left-14`}
                style={{ animationDelay: "1.1s" }}
              >
                <LineChart className="h-4 w-4 text-primary sm:h-5 sm:w-5" /> Suivi personnalisé
              </div>
              <div
                className={`${CHIP} dfp-float-slow -right-3 top-[58%] bg-white sm:-right-14`}
                style={{ animationDelay: "1.6s" }}
              >
                <HeartHandshake className="h-4 w-4 text-primary sm:h-5 sm:w-5" /> Accompagnement pro
              </div>
              <div
                className={`${CHIP} dfp-float -bottom-4 left-3 bg-foreground text-background sm:left-6`}
                style={{ animationDelay: "0.3s" }}
              >
                <Users className="h-4 w-4 text-brand sm:h-5 sm:w-5" /> Communauté
              </div>
              <div
                className={`${CHIP} dfp-float-slow -bottom-4 right-3 bg-primary text-primary-foreground sm:right-6`}
                style={{ animationDelay: "2s" }}
              >
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" /> Résultats
              </div>
            </div>
          </div>
        </section>

        {/* Bandeau défilant */}
        <section
          className="overflow-hidden border-y bg-foreground py-4 text-background"
          aria-hidden="true"
        >
          <div className="dfp-marquee flex w-max items-center gap-10 whitespace-nowrap text-lg font-extrabold uppercase tracking-widest">
            {[...MARQUEE, ...MARQUEE].map((w, i) => (
              <span key={`${w}-${i}`} className="flex items-center gap-10">
                {w}
                <Sparkles className="h-4 w-4 text-brand" />
              </span>
            ))}
          </div>
        </section>

        {/* Arguments de confiance */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: BadgeCheck,
                t: "Conçu par des Diététiciens, Nutritionnistes et Personal Trainers",
              },
              { icon: LineChart, t: "Un suivi clair de vos résultats" },
              { icon: HeartHandshake, t: "Un accompagnement humain, sans frustration" },
              { icon: ShieldCheck, t: "Simple à utiliser, à tout âge" },
            ].map((b) => (
              <div
                key={b.t}
                className="flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-sm"
              >
                <b.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <p className="text-sm font-semibold">{b.t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Photos et vidéo (affichées seulement si renseignées) */}
        {HERO_VIDEO || PHOTOS.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
            <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl">
              Découvrez <span className="text-primary">l'expérience DietFitPro</span>
            </h2>

            {HERO_VIDEO ? (
              <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-3xl bg-black shadow-2xl">
                <video
                  className="aspect-video w-full object-cover"
                  src={HERO_VIDEO}
                  poster={VIDEO_POSTER || undefined}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
            ) : null}

            {PHOTOS.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {PHOTOS.map((p) => (
                  <img
                    key={p.src}
                    src={p.src}
                    alt={p.alt}
                    loading="lazy"
                    className="h-64 w-full rounded-3xl object-cover shadow-lg transition-transform duration-500 hover:scale-[1.02]"
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Comment ça marche */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl">
            Commencez en <span className="text-primary">3 étapes</span>
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-3xl border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="text-xl">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fonctions */}
        <section className="bg-muted/60 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl">
              Un suivi et un accompagnement{" "}
              <span className="text-primary">pour avancer durablement</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
              Des outils concrets et un accompagnement humain pour transformer vos habitudes.
            </p>

            <div className="mt-12 grid gap-5 md:grid-cols-6">
              <div className="rounded-3xl bg-primary p-8 text-primary-foreground shadow-lg transition-all hover:-translate-y-1 md:col-span-4">
                <Apple className="mb-5 h-10 w-10" />
                <h3 className="text-2xl">Nutrition comportementale</h3>
                <p className="mt-3 max-w-lg text-lg text-primary-foreground/90">
                  Sans comptage calorique. Faim, satiété, humeur, énergie : l'essentiel pour
                  manger mieux, durablement.
                </p>
              </div>

              <div className="rounded-3xl border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl md:col-span-2">
                <Dumbbell className="mb-5 h-9 w-9 text-primary" />
                <h3 className="text-xl">Sport sur-mesure</h3>
                <p className="mt-2 text-muted-foreground">
                  Des programmes conçus selon votre profil et vos objectifs.
                </p>
              </div>

              <div className="rounded-3xl border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl md:col-span-2">
                <BookOpen className="mb-5 h-9 w-9 text-primary" />
                <h3 className="text-xl">Journal & suivi</h3>
                <p className="mt-2 text-muted-foreground">
                  Notez vos repas simplement et visualisez vos progrès semaine après semaine.
                </p>
              </div>

              <div className="rounded-3xl bg-foreground p-8 text-background shadow-lg transition-all hover:-translate-y-1 md:col-span-4">
                <Users className="mb-5 h-10 w-10 text-brand" />
                <h3 className="text-2xl">Une communauté qui motive</h3>
                <p className="mt-3 max-w-lg text-lg text-background/80">
                  Partagez vos victoires, encouragez les autres et rejoignez des groupes pour
                  vous entraider au quotidien.
                </p>
              </div>

              <div className="flex flex-col items-start gap-4 rounded-3xl border-2 border-primary/30 bg-accent p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl md:col-span-6 md:flex-row md:items-center">
                <MessageCircle className="h-10 w-10 shrink-0 text-primary" />
                <div>
                  <h3 className="text-2xl">Un accompagnement par des professionnels</h3>
                  <p className="mt-2 text-lg text-muted-foreground">
                    Diététiciens, Nutritionnistes et Personal Trainers vous guident et
                    répondent à vos questions pour que vous ne restiez jamais seul face à vos
                    objectifs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Offres */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl">
            Des formules <span className="text-primary">simples et transparentes</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            Choisissez l'offre qui vous convient. Changez à tout moment.
          </p>

          <div className="mt-14 grid items-stretch gap-6 md:grid-cols-3">
            {/* Basic */}
            <div className="flex flex-col rounded-3xl border bg-card p-8 shadow-sm transition-all hover:shadow-xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Apple className="h-5 w-5 text-primary" /> Basic
              </div>
              <p className="text-5xl font-extrabold">
                9,99€<span className="text-base font-medium text-muted-foreground">/mois</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-primary">Essai gratuit</p>
              <ul className="mt-6 flex-1 space-y-3">
                {BASIC.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-8 h-12 w-full rounded-full font-bold" variant="outline" asChild>
                <Link to="/register">Commencer l'essai</Link>
              </Button>
            </div>

            {/* Premium */}
            <div className="relative flex flex-col rounded-3xl bg-foreground p-8 text-background shadow-2xl md:-my-4">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-foreground">
                Le plus choisi
              </span>
              <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand">
                <Star className="h-5 w-5 fill-current" /> Premium
              </div>
              <p className="text-5xl font-extrabold">
                25,99€<span className="text-base font-medium text-background/70">/mois</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-brand">Essai gratuit</p>
              <ul className="mt-6 flex-1 space-y-3">
                {PREMIUM.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check dark />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-8 h-12 w-full rounded-full bg-brand font-bold text-foreground hover:bg-brand/90"
                asChild
              >
                <Link to="/register">Commencer l'essai</Link>
              </Button>
            </div>

            {/* Visio */}
            <div className="flex flex-col rounded-3xl border bg-card p-8 shadow-sm transition-all hover:shadow-xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <MessageCircle className="h-5 w-5 text-primary" /> Visio
              </div>
              <p className="text-5xl font-extrabold">
                30€<span className="text-base font-medium text-muted-foreground">/session</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-primary">Sans abonnement</p>
              <ul className="mt-6 flex-1 space-y-3">
                {VISIO.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-8 h-12 w-full rounded-full font-bold" variant="outline" asChild>
                <Link to="/register">Réserver</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-muted/60 py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-3xl sm:text-4xl">Vos questions</h2>
            <div className="mt-10 space-y-3">
              {FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border bg-card p-5 shadow-sm open:shadow-md"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                    {f.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Appel final */}
        <section className="relative overflow-hidden bg-foreground py-24 text-center text-background">
          <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/30 blur-3xl" />
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-4xl sm:text-5xl">Prêt à changer vos habitudes ?</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-background/80">
              Commencez aujourd'hui avec un essai gratuit, un suivi personnalisé et un
              accompagnement à vos côtés.
            </p>
            <Button
              size="lg"
              className="mt-9 h-14 rounded-full bg-brand px-10 text-lg font-bold text-foreground shadow-lg hover:bg-brand/90"
              asChild
            >
              <Link to="/register">
                Démarrer mon essai gratuit
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <p className="mt-4 text-sm text-background/70">
              Sans engagement · Annulable à tout moment
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-10 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium">
            <Link to="/cgv" className="hover:text-foreground">
              CGV
            </Link>
            <Link to="/confidentialite" className="hover:text-foreground">
              Confidentialité
            </Link>
            <Link to="/mentions-legales" className="hover:text-foreground">
              Mentions légales
            </Link>
          </nav>
          <p>© 2026 DietFitPro · Diet N Trainer</p>
        </div>
      </footer>
    </div>
  );
}