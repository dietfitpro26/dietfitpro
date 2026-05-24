import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Plus, Search, Clock, Flame, Drumstick } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/recipes")({
  head: () => ({ meta: [{ title: "Recettes — DietFitPro" }] }),
  component: Page,
});

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  dinner: "Dîner",
  snack: "Collation",
};

interface Ingredient { name: string; quantity: string; unit: string }
interface Recipe {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  meal_type: MealType | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  servings: number | null;
  kcal_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[] | null;
  is_public: boolean;
  created_by: string | null;
}

type Source = "all" | "mine" | "library";

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><Content /></ProLayout>
    </ProtectedRoute>
  );
}

function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MealType | "all">("all");
  const [source, setSource] = useState<Source>("all");
  const [selected, setSelected] = useState<Recipe | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("recipes")
      .select("id, name, description, image_url, meal_type, prep_time_min, cook_time_min, servings, kcal_per_serving, protein_g, carbs_g, fat_g, fiber_g, ingredients, steps, tags, is_public, created_by")
      .or(`created_by.eq.${user.id},is_public.eq.true`)
      .order("created_at", { ascending: false });
    setRecipes(((data ?? []) as unknown as Recipe[]).map((r) => ({
      ...r,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
    })));
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => {
    if (!recipes) return null;
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (category !== "all" && r.meal_type !== category) return false;
      if (source === "mine" && r.created_by !== user?.id) return false;
      if (source === "library" && r.created_by === user?.id) return false;
      return true;
    });
  }, [recipes, search, category, source, user]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Mes recettes</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white"
            onClick={() => navigate({ to: "/pro/recipes/new" })}>
            <Plus className="h-4 w-4" /> Nouvelle recette
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher une recette…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as MealType | "all")}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {(Object.keys(MEAL_LABEL) as MealType[]).map((k) => (
                <SelectItem key={k} value={k}>{MEAL_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={(v) => setSource(v as Source)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="mine">Mes recettes</SelectItem>
              <SelectItem value="library">Bibliothèque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered === null
          ? (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
            </div>)
          : filtered.length === 0
            ? <p className="text-center text-muted-foreground py-12">Aucune recette ne correspond.</p>
            : (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filtered.map((r) => {
                  const mine = r.created_by === user?.id;
                  return (
                    <Card key={r.id} className="cursor-pointer overflow-hidden hover:shadow-md transition" onClick={() => setSelected(r)}>
                      <div className="aspect-video bg-muted overflow-hidden">
                        {r.image_url
                          ? <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                          : <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">Pas d'image</div>}
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold leading-snug">{r.name}</h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${mine ? "bg-[#6DB33F]/15 text-[#2D7A1F]" : "bg-muted text-muted-foreground"}`}>
                            {mine ? "Mes recettes" : "Bibliothèque"}
                          </span>
                        </div>
                        {r.meal_type && <p className="text-xs text-muted-foreground">{MEAL_LABEL[r.meal_type]}</p>}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {r.kcal_per_serving != null && <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3" />{r.kcal_per_serving} kcal</span>}
                          {r.protein_g != null && <span className="inline-flex items-center gap-1"><Drumstick className="h-3 w-3" />{r.protein_g}g prot.</span>}
                          {r.prep_time_min != null && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.prep_time_min} min</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>)}
      </div>

      <RecipeDetailDialog recipe={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function RecipeDetailDialog({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [patientId, setPatientId] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!recipe || !user) return;
    void supabase.from("patients").select("id, first_name, last_name").eq("pro_id", user.id)
      .then(({ data }) => setPatients((data ?? []) as typeof patients));
  }, [recipe, user]);

  const assign = async () => {
    if (!recipe || !patientId) { toast.error("Sélectionnez un patient"); return; }
    setAssigning(true);
    const { error } = await supabase.from("patient_recipes").insert({
      patient_id: patientId,
      recipe_id: recipe.id,
      meal_type: recipe.meal_type,
    });
    setAssigning(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Recette assignée");
    setPatientId("");
  };

  return (
    <Dialog open={!!recipe} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {recipe && (
          <>
            <DialogHeader>
              <DialogTitle>{recipe.name}</DialogTitle>
            </DialogHeader>
            {recipe.image_url && (
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                <img src={recipe.image_url} alt={recipe.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              <Badge label="Calories" value={recipe.kcal_per_serving} suffix="kcal" />
              <Badge label="Protéines" value={recipe.protein_g} suffix="g" />
              <Badge label="Glucides" value={recipe.carbs_g} suffix="g" />
              <Badge label="Lipides" value={recipe.fat_g} suffix="g" />
            </div>

            <section>
              <h3 className="font-semibold mb-2">Ingrédients</h3>
              {recipe.ingredients.length === 0
                ? <p className="text-sm text-muted-foreground">Aucun ingrédient.</p>
                : <ul className="list-disc pl-5 text-sm space-y-1">
                    {recipe.ingredients.map((i, idx) => (
                      <li key={idx}>{i.quantity} {i.unit} — {i.name}</li>
                    ))}
                  </ul>}
            </section>

            <section>
              <h3 className="font-semibold mb-2">Instructions</h3>
              {recipe.steps.length === 0
                ? <p className="text-sm text-muted-foreground">Aucune instruction.</p>
                : <ol className="list-decimal pl-5 text-sm space-y-1">
                    {recipe.steps.map((s, idx) => <li key={idx}>{s}</li>)}
                  </ol>}
            </section>

            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recipe.tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t}</span>
                ))}
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Assigner à un patient</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={assign} disabled={assigning || !patientId} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
                {assigning ? "…" : "Assigner"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Badge({ label, value, suffix }: { label: string; value: number | null; suffix: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value ?? "—"}{value != null ? ` ${suffix}` : ""}</div>
    </div>
  );
}
