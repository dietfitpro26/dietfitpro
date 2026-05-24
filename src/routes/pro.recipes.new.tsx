import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/recipes/new")({
  head: () => ({ meta: [{ title: "Nouvelle recette — DietFitPro" }] }),
  component: Page,
});

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snack: "Collation",
};

interface Ingredient { name: string; quantity: string; unit: string }

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
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [prep, setPrep] = useState("");
  const [cook, setCook] = useState("");
  const [servings, setServings] = useState("1");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [steps, setSteps] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", quantity: "", unit: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const updateIng = (idx: number, field: keyof Ingredient, value: string) => {
    setIngredients((arr) => arr.map((i, k) => (k === idx ? { ...i, [field]: value } : i)));
  };
  const addIng = () => setIngredients((a) => [...a, { name: "", quantity: "", unit: "" }]);
  const removeIng = (idx: number) => setIngredients((a) => a.filter((_, k) => k !== idx));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) { toast.error("Nom obligatoire"); return; }
    setSubmitting(true);
    const cleanedIngs = ingredients.filter((i) => i.name.trim());
    const stepArr = steps.split("\n").map((s) => s.trim()).filter(Boolean);
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("recipes").insert({
      created_by: user.id,
      name: name.trim(),
      meal_type: mealType,
      prep_time_min: prep ? Number(prep) : null,
      cook_time_min: cook ? Number(cook) : null,
      servings: servings ? Number(servings) : 1,
      kcal_per_serving: kcal ? Number(kcal) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
      fiber_g: fiber ? Number(fiber) : null,
      image_url: imageUrl.trim() || null,
      ingredients: cleanedIngs,
      steps: stepArr,
      tags: tagArr.length ? tagArr : null,
      is_public: false,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Recette publiée");
    navigate({ to: "/pro/recipes" });
  };

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pro/recipes" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Nouvelle recette</h1>
      </header>

      <form onSubmit={submit} className="p-6 space-y-4 max-w-3xl">
        <Card><CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">Informations générales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => (
                    <SelectItem key={m} value={m}>{MEAL_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Portions</Label>
              <Input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Temps préparation (min)</Label>
              <Input type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Temps cuisson (min)</Label>
              <Input type="number" min={0} value={cook} onChange={(e) => setCook(e.target.value)} />
            </div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">Valeurs nutritionnelles (par portion)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="space-y-1"><Label>Calories</Label><Input type="number" min={0} value={kcal} onChange={(e) => setKcal(e.target.value)} /></div>
            <div className="space-y-1"><Label>Prot. (g)</Label><Input type="number" min={0} step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} /></div>
            <div className="space-y-1"><Label>Gluc. (g)</Label><Input type="number" min={0} step="0.1" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></div>
            <div className="space-y-1"><Label>Lip. (g)</Label><Input type="number" min={0} step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} /></div>
            <div className="space-y-1"><Label>Fibres (g)</Label><Input type="number" min={0} step="0.1" value={fiber} onChange={(e) => setFiber(e.target.value)} /></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Ingrédients</h2>
            <Button type="button" variant="outline" size="sm" onClick={addIng}><Plus className="h-4 w-4" /> Ajouter</Button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <Input className="col-span-6" placeholder="Nom" value={ing.name} onChange={(e) => updateIng(idx, "name", e.target.value)} maxLength={100} />
                <Input className="col-span-3" placeholder="Quantité" value={ing.quantity} onChange={(e) => updateIng(idx, "quantity", e.target.value)} maxLength={20} />
                <Input className="col-span-2" placeholder="Unité" value={ing.unit} onChange={(e) => updateIng(idx, "unit", e.target.value)} maxLength={20} />
                <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeIng(idx)} aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">Instructions</h2>
          <p className="text-xs text-muted-foreground">Une étape par ligne.</p>
          <Textarea rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} maxLength={5000} />
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">Photo & tags</h2>
          <div className="space-y-1">
            <Label>URL de l'image</Label>
            <Input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1">
            <Label>Tags (séparés par des virgules)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sans gluten, végétarien, riche en protéines" />
          </div>
        </CardContent></Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/pro/recipes" })}>Annuler</Button>
          <Button type="submit" disabled={submitting} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
            {submitting ? "Publication…" : "Publier"}
          </Button>
        </div>
      </form>
    </div>
  );
}
