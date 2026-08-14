<<<<<<< HEAD
import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Apple, Dumbbell, Brain, MessageCircle, CheckCircle2, Play, Users, Star, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DietFitPro — Coach Nutrition & Sport Personnalisé" },
      {
        name: "description",
        content:
          "DietFitPro : votre coach nutrition et sport personnalisé. Pas de régime, juste de meilleures habitudes.",
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
=======
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})
>>>>>>> 99408d3e5828c26f7f68f4143aa8c5d8c6e2d77e

function IndexComponent() {
  useEffect(() => {
    async function checkAuthAndRedirect() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Pas connecté → login
        window.location.href = '/login'
        return
      }

      // Connecté·´e → charger profil et rediriger selon rôle
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, profile_complete')
        .eq('id', session.user.id)
        .single()

      if (!profile) {
        // Profil introuvable → logout + login
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }

      if (!profile.profile_complete) {
        // Profil incomplet → bienvenue
        window.location.href = '/bienvenue'
        return
      }

      // Redirection selon rôle
      switch (profile.role) {
        case 'pro':
          window.location.href = '/pro/dashboard'
          break
        case 'patient':
          window.location.href = '/patient/dashboard'
          break
        case 'subscriber':
          window.location.href = '/subscriber/nutrition'
          break
        default:
          window.location.href = '/login'
      }
    }

    checkAuthAndRedirect()
  }, [])

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50/50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Se connecter</Link>
            </Button>
            <Button className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]" asChild>
              <Link to="/register">Essai gratuit</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800">
            <Star className="h-4 w-4 fill-green-600 text-green-600" />
            <span>Par David — Diététicien-nutritionniste & Coach sportif</span>
          </div>

          {/* Titre principal */}
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Pas de régime,
            <br />
            <span className="text-[#6DB33F]">juste de meilleures habitudes.</span>
          </h1>

          {/* Sous-titre */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Une expérience humaine, guidée par l'IA, contrôlée par un professionnel.
            <br />
            Votre coach nutrition, sport et bien-être en poche.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button 
              size="lg" 
              className="h-14 w-full px-8 text-lg font-semibold sm:w-auto" 
              asChild
            >
              <Link to="/register">
                <Play className="mr-2 h-5 w-5" />
                Démarrer mon essai gratuit
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="h-14 w-full px-8 text-lg sm:w-auto" 
              asChild
            >
              <Link to="/login">
                Se connecter
              </Link>
            </Button>
          </div>

          {/* Trust signals */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#6DB33F]" />
              <span>3 jours gratuits</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#6DB33F]" />
              <span>Sans engagement</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#6DB33F]" />
              <span>Annulable à tout moment</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-[#2D7A1F]">500+</p>
              <p className="text-sm text-muted-foreground">Clients accompagnés</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <p className="text-3xl font-bold text-[#2D7A1F]">4.9/5</p>
              <p className="text-sm text-muted-foreground">Satisfaction client</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <p className="text-3xl font-bold text-[#2D7A1F]">10+</p>
              <p className="text-sm text-muted-foreground">Ans d'expérience</p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-border bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
              Tout ce dont vous avez besoin pour{" "}
              <span className="text-[#6DB33F]">avancer durablement</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Des outils concrets, un accompagnement personnalisé et une approche scientifique
              pour transformer vos habitudes sans frustration.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <Card key={f.title} className="group p-6 transition-all hover:shadow-lg hover:shadow-green-100">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-[#2D7A1F] transition-colors group-hover:bg-[#6DB33F] group-hover:text-white">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Plans Section */}
        <section className="border-t border-border bg-gradient-to-b from-green-50/50 to-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
              Des formules simples et{" "}
              <span className="text-[#6DB33F]">transparentes</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Choisissez l'offre qui correspond à vos objectifs. Changez à tout moment.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {/* Basic */}
              <Card className="p-8 transition-shadow hover:shadow-lg">
                <div className="mb-4 flex items-center gap-2">
                  <Apple className="h-6 w-6 text-[#6DB33F]" />
                  <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Basic
                  </p>
                </div>
                <p className="text-4xl font-bold">
                  9,99€<span className="text-base font-normal text-muted-foreground">/mois</span>
                </p>
                <p className="mt-2 text-sm text-green-600">7 jours d'essai offerts</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Coach IA (5 messages/jour)",
                    "Programmes automatiques",
                    "Feed & gamification",
                    "Suivi de vos progrès",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6DB33F]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full" variant="outline" asChild>
                  <Link to="/register">Commencer l'essai</Link>
                </Button>
              </Card>

              {/* Premium */}
              <Card className="relative border-2 border-[#6DB33F] p-8 shadow-xl">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#6DB33F] px-3 py-1 text-xs font-semibold text-white">
                  ⭐ Recommandé
                </span>
                <div className="mb-4 flex items-center gap-2">
                  <Star className="h-6 w-6 fill-[#6DB33F] text-[#6DB33F]" />
                  <p className="text-sm font-medium uppercase tracking-wider text-[#6DB33F]">
                    Premium
                  </p>
                </div>
                <p className="text-4xl font-bold">
                  25,99€<span className="text-base font-normal text-muted-foreground">/mois</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Tout Basic, en illimité",
                    "Coach IA illimité",
                    "Recettes du pro",
                    "Programmes sport sur-mesure",
                    "Messagerie avec David",
                    "Accès prioritaire",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 fill-[#6DB33F] text-[#6DB33F]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full bg-[#6DB33F] text-white hover:bg-[#2D7A1F]" asChild>
                  <Link to="/register">Commencer l'essai</Link>
                </Button>
              </Card>

              {/* Visio */}
              <Card className="p-8 transition-shadow hover:shadow-lg">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-6 w-6 text-[#6DB33F]" />
                  <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Visio
                  </p>
                </div>
                <p className="text-4xl font-bold">
                  30€<span className="text-base font-normal text-muted-foreground">/session</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "20-30 min avec David",
                    "Via WhatsApp",
                    "Compte-rendu inclus",
                    "Sans engagement",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6DB33F]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full" variant="outline" asChild>
                  <Link to="/register">Réserver</Link>
                </Button>
              </Card>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border bg-[#6DB33F] py-20 text-center text-white">
          <div className="mx-auto max-w-4xl px-6">
            <TrendingUp className="mx-auto mb-6 h-12 w-12" />
            <h2 className="text-3xl font-bold md:text-4xl">
              Prêt à transformer vos habitudes ?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-green-100">
              Rejoignez les centaines de clients qui ont déjà amélioré leur santé avec DietFitPro.
            </p>
            <Button 
              size="lg" 
              className="mt-8 h-14 bg-white text-[#6DB33F] hover:bg-green-50" 
              asChild
            >
              <Link to="/register">
                Démarrer mon essai gratuit maintenant
              </Link>
            </Button>
            <p className="mt-4 text-sm text-green-100">
              3 jours gratuits · Sans engagement · Annulable à tout moment
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <p>© 2026 DietFitPro · Diet N Trainer · David</p>
          <p className="mt-2 text-xs">
            Votre coach nutrition et sport personnalisé
          </p>
        </div>
      </footer>
=======
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirection...</p>
      </div>
>>>>>>> 99408d3e5828c26f7f68f4143aa8c5d8c6e2d77e
    </div>
  )
}
