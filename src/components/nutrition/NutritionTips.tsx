import type { ReactNode } from "react";
import {
  Ban,
  Clock3,
  Cookie,
  Droplets,
  Flame,
  Footprints,
  Leaf,
  Moon,
  Salad,
  ShoppingBasket,
  Timer,
  Beef,
  Tag,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Tip {
  icon: ReactNode;
  title: string;
  text: string;
}

const ICON = "h-5 w-5";

/** Les 4 règles à retenir absolument (mises en avant). */
const ESSENTIAL_TIPS: Tip[] = [
  {
    icon: <Flame className={ICON} />,
    title: "Ne faites pas cuire vos matières grasses",
    text: "Ajoutez votre huile ou votre beurre crus, après la cuisson. Cuisez plutôt à la vapeur, à l'eau, au four ou à la poêle antiadhésive. Colza, noix et lin : toujours à cru.",
  },
  {
    icon: <Ban className={ICON} />,
    title: "Pas ou peu d'aliments industriels",
    text: "Évitez les plats cuisinés, les biscuits sucrés, le pain industriel, les pâtisseries, la pâte à tartiner… Préférez des produits bruts que vous cuisinez vous-même.",
  },
  {
    icon: <Clock3 className={ICON} />,
    title: "Ne sautez pas de repas",
    text: "Sauter un repas provoque fringales et grignotage plus tard. Gardez vos repas à heures régulières.",
  },
  {
    icon: <Cookie className={ICON} />,
    title: "Attention aux produits sucrés pris seuls",
    text: "Un produit sucré isolé, en dehors d'un repas, fait grimper vite la glycémie et relance la faim. Placez-le plutôt en fin de repas.",
  },
];

/** Les bons réflexes du quotidien. */
const DAILY_TIPS: Tip[] = [
  {
    icon: <Droplets className={ICON} />,
    title: "Hydratez-vous",
    text: "Environ 1,5 litre par jour : eau, thé ou tisane sans sucre. Limitez sodas et jus de fruits.",
  },
  {
    icon: <Salad className={ICON} />,
    title: "Des légumes à chaque repas",
    text: "Remplissez la moitié de votre assiette de légumes, crus ou cuits : ils rassasient pour peu de calories.",
  },
  {
    icon: <Beef className={ICON} />,
    title: "Des protéines à chaque repas",
    text: "Viande maigre, poisson, œufs, légumineuses ou laitages : elles aident à tenir jusqu'au repas suivant.",
  },
  {
    icon: <Timer className={ICON} />,
    title: "Prenez votre temps",
    text: "Comptez environ 20 minutes par repas, mâchez bien, et mangez sans écran pour sentir quand vous n'avez plus faim.",
  },
  {
    icon: <Tag className={ICON} />,
    title: "Lisez les étiquettes",
    text: "Choisissez des produits avec une liste d'ingrédients courte, sans sucre ajouté en début de liste.",
  },
  {
    icon: <Leaf className={ICON} />,
    title: "Assaisonnez sans exagérer le sel",
    text: "Herbes, épices, citron, ail et oignon donnent du goût sans ajouter de sel.",
  },
  {
    icon: <Footprints className={ICON} />,
    title: "Bougez chaque jour",
    text: "Au moins 30 minutes d'activité physique par jour : marche rapide, vélo, escaliers ou sport.",
  },
  {
    icon: <Moon className={ICON} />,
    title: "Soignez votre sommeil",
    text: "Visez 7 à 8 heures par nuit : dormir assez aide à mieux gérer l'appétit et les envies de sucre.",
  },
  {
    icon: <ShoppingBasket className={ICON} />,
    title: "Faites vos courses malin",
    text: "Avec une liste et après avoir mangé : vous achetez moins de produits tentants.",
  },
];

export function NutritionTips({
  planName,
  planTips = [],
}: {
  planName?: string;
  planTips?: string[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Les règles d'or</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quatre habitudes simples qui font la différence au quotidien.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ESSENTIAL_TIPS.map((tip, index) => (
          <div
            key={tip.title}
            className="relative overflow-hidden rounded-3xl border border-[#6DB33F]/30 bg-gradient-to-br from-[#6DB33F]/10 to-background p-5 shadow-sm"
          >
            <span className="absolute right-4 top-3 text-5xl font-bold text-[#6DB33F]/15">
              {index + 1}
            </span>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6DB33F] text-white">
              {tip.icon}
            </div>
            <h3 className="pr-8 text-base font-semibold leading-snug">{tip.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{tip.text}</p>
          </div>
        ))}
      </div>

      <Card className="rounded-3xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Les bons réflexes</CardTitle>
          <CardDescription>Pour installer de vraies habitudes, étape par étape.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DAILY_TIPS.map((tip) => (
              <div key={tip.title} className="rounded-2xl bg-muted/30 p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {tip.icon}
                </div>
                <p className="text-sm font-semibold">{tip.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tip.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {planTips.length > 0 ? (
        <Card className="rounded-3xl border border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {planName ? `Spécial « ${planName} »` : "Pour votre programme"}
                </CardTitle>
                <CardDescription>Des conseils propres à votre programme actuel.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {planTips.map((tip) => (
                <li key={tip} className="flex items-start gap-2 rounded-xl bg-background/70 px-3 py-2">
                  <span className="mt-0.5 text-[#6DB33F]">✓</span>
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}