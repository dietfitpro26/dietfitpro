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
        content: "Pas de régime, juste de meilleures habitudes. 7 jours d'essai gratuit.",
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

const TRIAL_LABEL = "7 jours d'essai gratuit";

const STEPS = [
  {
    n: "1",
    title: "Créez votre compte",
    desc: "Inscription en une minute, 7 jours d'essai gratuit, sans engagement.",
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

const FAQ = [
  {
    q: "Dois-je compter mes calories ?",
    a: "Non. L'approche est comportementale : faim, satiété, humeur et énergie. Vous construisez de meilleures habitudes sans comptage permanent.",
  },
  {
    q: "Combien de temps dure l'essai gratuit ?",
    a: "L'essai dure 7 jours, aussi bien pour le Basic que pour le Premium. Il est offert lors de votre première souscription, et vous pouvez annuler avant la fin de l'essai.",
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

function Check({ dark = false }: { dark?: boolean }) {
  return (
    <CheckCircle2
      className={`mt-0.5 h-5 w-5 shrink-0 ${dark ? "text-brand" : "text-primary"}`}
    />
  );
}

function ProductPreview() {
  return (
    <div className="mx-auto w-full max-w-[36rem]">
      <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_24px_70px_-34px_rgba(24,54,32,0.35)]">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Apple className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">Votre espace</p>
              <p className="text-xs text-muted-foreground">Nutrition · suivi · communauté</p>
            </div>
          </div>
          <span className="rounded-full border border-stone-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Démonstration
          </span>
        </div>

        <div className="grid gap-4 bg-[#fafaf7] p-4 sm:grid-cols-[1.1fr_0.9fr] sm:gap-5 sm:p-6">
          <section className="rounded-2xl border border-stone-200/80 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Mardi · aperçu fictif</p>
                <h3 className="mt-1 text-lg font-bold tracking-tight">Mon suivi du jour</h3>
              </div>
              <span className="rounded-full bg-[#eef4e9] px-2.5 py-1 text-[11px] font-semibold text-primary">Nutrition</span>
            </div>
            <div className="mt-6 space-y-4">
              {[
                ["Repas notés", "3 moments"],
                ["Énergie", "Au rendez-vous"],
                ["Hydratation", "En cours"],
              ].map(([label, value], index) => (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-600">{label}</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: ["76%", "62%", "48%"][index] }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-[#f5f6f1] p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary"><HeartHandshake className="h-4 w-4" /></span>
              <p className="text-xs leading-relaxed text-stone-600">Un accompagnement pensé autour de vos habitudes, sans comptage permanent.</p>
            </div>
          </section>

          <div className="grid gap-4">
            <section className="rounded-2xl border border-stone-200/80 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Progression fictive</p>
                  <h3 className="mt-1 text-sm font-bold">Mes repères de la semaine</h3>
                </div>
                <LineChart className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-5 flex h-20 items-end gap-2" aria-label="Graphique décoratif de démonstration">
                {[38, 54, 45, 70, 58, 82, 64].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end rounded-t-md bg-[#edf1e8]">
                    <div className={`w-full rounded-t-md ${index === 5 ? "bg-primary" : "bg-primary/55"}`} style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Lun.</span><span>Dim.</span></div>
            </section>

            <section className="rounded-2xl border border-stone-200/80 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Communauté · aperçu fictif</p>
                  <h3 className="mt-1 text-sm font-bold">On avance ensemble</h3>
                </div>
                <Users className="h-4 w-4 shrink-0 text-primary" />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-stone-600">« Cette semaine, j'ai pris le temps de préparer mes repas. Une petite habitude à la fois ! »</p>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="h-5 w-5 rounded-full bg-[#dce8d3]" aria-hidden="true" />
                Un exemple de publication, sans donnée réelle
              </div>
            </section>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Aperçu illustratif de DietFitPro · données de démonstration</p>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-3" aria-label="Navigation principale">
            <a href="#offres" className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">Les formules</a>
            <Button variant="ghost" size="sm" className="rounded-full px-3 sm:px-4" asChild>
              <Link to="/login">Se connecter</Link>
            </Button>
            <Button size="sm" className="rounded-full px-4 font-semibold sm:px-5" asChild>
              <Link to="/register">Essai gratuit</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-stone-200/70">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-10 lg:py-24">
            <div className="max-w-xl">
              <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <span className="h-px w-8 bg-primary" /> Nutrition & Sport, à votre rythme
              </p>
              <h1 className="max-w-[13ch] text-[2.7rem] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[3.65rem]">
                Pas de régime.<br />
                <span className="font-normal text-primary">Juste de meilleures habitudes.</span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Un suivi personnalisé, un accompagnement par des professionnels et une
                communauté qui vous motive : tout pour transformer durablement votre
                alimentation et votre forme.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 rounded-full px-6 text-base font-semibold shadow-sm"
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
                  className="h-12 rounded-full border-stone-300 bg-white px-6 text-base font-medium"
                  asChild
                >
                  <Link to="/login">Se connecter</Link>
                </Button>
              </div>

              <ul className="mt-7 flex flex-col gap-2 text-sm font-medium text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
                {[TRIAL_LABEL, "Sans engagement", "Annulable à tout moment"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <ProductPreview />
          </div>
        </section>

        {/* Promesse produit */}
        <section className="border-b border-stone-200/70 bg-[#f8f8f4]">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
            {[
              [BadgeCheck, "Conçu par des Diététiciens, Nutritionnistes et Personal Trainers"],
              [LineChart, "Un suivi clair de vos résultats"],
              [HeartHandshake, "Un accompagnement humain, sans frustration"],
              [ShieldCheck, "Simple à utiliser, à tout âge"],
            ].map(([Icon, text]) => {
              const IconComponent = Icon as typeof BadgeCheck;
              return <div key={text as string} className="flex items-start gap-3 py-2">
                <IconComponent className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm font-medium leading-6 text-stone-700">{text as string}</p>
              </div>;
            })}
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
                className="rounded-2xl border border-stone-200/80 bg-card p-7 transition-colors hover:border-primary/30 sm:p-8"
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
        <section className="border-y border-stone-200/70 bg-[#f8f8f4] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl">
              Un suivi et un accompagnement{" "}
              <span className="text-primary">pour avancer durablement</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
              Des outils concrets et un accompagnement humain pour transformer vos habitudes.
            </p>

            <div className="mt-12 grid gap-5 md:grid-cols-6">
              <div className="rounded-3xl bg-[#eaf1e4] p-8 text-foreground md:col-span-4">
                <Apple className="mb-5 h-10 w-10" />
                <h3 className="text-2xl">Nutrition comportementale</h3>
                <p className="mt-3 max-w-lg text-lg text-muted-foreground">
                  Sans comptage calorique. Faim, satiété, humeur, énergie : l'essentiel pour
                  manger mieux, durablement.
                </p>
              </div>

              <div className="rounded-3xl border border-stone-200/80 bg-card p-8 md:col-span-2">
                <Dumbbell className="mb-5 h-9 w-9 text-primary" />
                <h3 className="text-xl">Sport sur-mesure</h3>
                <p className="mt-2 text-muted-foreground">
                  Des programmes conçus selon votre profil et vos objectifs.
                </p>
              </div>

              <div className="rounded-3xl border border-stone-200/80 bg-card p-8 md:col-span-2">
                <BookOpen className="mb-5 h-9 w-9 text-primary" />
                <h3 className="text-xl">Journal & suivi</h3>
                <p className="mt-2 text-muted-foreground">
                  Notez vos repas simplement et visualisez vos progrès semaine après semaine.
                </p>
              </div>

              <div className="rounded-3xl bg-foreground p-8 text-background md:col-span-4">
                <Users className="mb-5 h-10 w-10 text-brand" />
                <h3 className="text-2xl">Une communauté qui motive</h3>
                <p className="mt-3 max-w-lg text-lg text-background/80">
                  Partagez vos victoires, encouragez les autres et rejoignez des groupes pour
                  vous entraider au quotidien.
                </p>
              </div>

              <div className="flex flex-col items-start gap-4 rounded-3xl border border-stone-200/80 bg-card p-8 md:col-span-6 md:flex-row md:items-center">
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
        <section id="offres" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl">
            Des formules <span className="text-primary">simples et transparentes</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            Choisissez l'offre qui vous convient. Changez à tout moment.
          </p>

          <div className="mx-auto mt-14 grid max-w-4xl items-stretch gap-6 md:grid-cols-2">
            {/* Basic */}
            <div className="flex flex-col rounded-3xl border border-stone-200 bg-card p-8">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Apple className="h-5 w-5 text-primary" /> Basic
              </div>
              <p className="text-5xl font-extrabold">
                9,99€<span className="text-base font-medium text-muted-foreground">/mois</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-primary">{TRIAL_LABEL}</p>
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
            <div className="relative flex flex-col rounded-3xl bg-foreground p-8 text-background shadow-lg">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-foreground">
                Le plus choisi
              </span>
              <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand">
                <Star className="h-5 w-5 fill-current" /> Premium
              </div>
              <p className="text-5xl font-extrabold">
                25,99€<span className="text-base font-medium text-background/70">/mois</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-brand">{TRIAL_LABEL}</p>
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
          </div>

          {/* Option programme personnalisé */}
          <div className="mx-auto mt-14 flex max-w-4xl flex-col gap-6 rounded-3xl border border-stone-200 bg-[#f8f8f4] p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <Sparkles className="mt-1 h-8 w-8 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-primary">
                  Option
                </p>
                <h3 className="text-2xl">Programme ultra-personnalisé</h3>
                <p className="mt-2 text-muted-foreground">
                  Avec votre abonnement Premium, ajoutez un programme nutrition conçu
                  spécialement pour vous, à partir de votre profil et de vos objectifs.
                </p>
              </div>
            </div>

            <div className="shrink-0 text-left md:text-right">
              <p className="text-4xl font-extrabold">5 €</p>
              <p className="text-sm font-medium text-muted-foreground">
                une seule fois, à ajouter depuis votre espace
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-y border-stone-200/70 bg-[#f8f8f4] py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-3xl sm:text-4xl">Vos questions</h2>
            <div className="mt-10 space-y-3">
              {FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-stone-200/80 bg-card p-5"
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
        <section className="bg-foreground py-20 text-center text-background">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-4xl sm:text-5xl">Prêt à changer vos habitudes ?</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-background/80">
              Commencez aujourd'hui avec 7 jours d'essai gratuit, un suivi personnalisé et
              un accompagnement à vos côtés.
            </p>
            <Button
              size="lg"
              className="mt-9 h-14 rounded-full bg-brand px-10 text-lg font-semibold text-foreground hover:bg-brand/90"
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
