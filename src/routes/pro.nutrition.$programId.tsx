import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
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

export const Route = createFileRoute("/pro/nutrition/$programId")({
  head: () => ({ meta: [{ title: "Programme nutrition — DietFitPro" }] }),
  component: Page,
});

type MealMoment = "matin" | "midi" | "soir" | "collation";
const MOMENT_LABEL: Record<MealMoment, string> = {
  matin: "Matin", midi: "Midi", soir: "Soir", collation: "Collation",
};

interface Meal {
  id: string;
  moment: MealMoment;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
interface Program {
  id: string;
  name: string;
  patient_id: string;
  daily_kcal_target: number | null;
  notes: string | null;
  meals: Meal[];
}
interface PatientLite { id: string; first_name: string; last_name: string }

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><Content /></ProLayout>
    </ProtectedRoute>
  );
}

function Content() {
  const { user } = useAuth();
  const { programId } = Route.useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [patient, setPatient] = useState<PatientLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [mealOpen, setMealOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("nutrition_programs")
      .select("id, name, patient_id, daily_kcal_target, notes, meals")
      .eq("id", programId)
      .eq("pro_id", user.id)
      .maybeSingle();
    if (error || !data) { setLoading(false); return; }
    const prog = { ...(data as Program), meals: Array.isArray(data.meals) ? (data.meals as Meal[]) : [] };
    setProgram(prog);
    const { data: p } = await supabase
      .from("patients").select("id, first_name, last_name").eq("id", prog.patient_id).maybeSingle();
    setPatient((p as PatientLite) ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user, programId]);

  const addMeal = async (meal: Meal) => {
    if (!program) return;
    const next = [...program.meals, meal];
    const { error } = await supabase
      .from("nutrition_programs").update({ meals: next }).eq("id", program.id);
    if (error) { toast.error(error.message); return; }
    setProgram({ ...program, meals: next });
    toast.success("Repas ajouté");
    setMealOpen(false);
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!program) {
    return <div className="p-6"><Button variant="ghost" onClick={() => navigate({ to: "/pro/nutrition" })}><ArrowLeft className="h-4 w-4" /> Retour</Button><p className="mt-4 text-destructive">Programme introuvable.</p></div>;
  }

  const grouped: Record<MealMoment, Meal[]> = { matin: [], midi: [], soir: [], collation: [] };
  program.meals.forEach((m) => { (grouped[m.moment] ??= []).push(m); });

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pro/nutrition" })}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{program.name}</h1>
          <p className="text-sm text-muted-foreground">
            {patient ? `${patient.first_name} ${patient.last_name}` : "—"}
            {program.daily_kcal_target ? ` • ${program.daily_kcal_target} kcal/j` : ""}
          </p>
        </div>
        <Button variant="outline"><Pencil className="h-4 w-4" /> Modifier</Button>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Repas</h2>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setMealOpen(true)}>
            <Plus className="h-4 w-4" /> Ajouter un repas
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(MOMENT_LABEL) as MealMoment[]).map((m) => (
            <Card key={m}>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">{MOMENT_LABEL[m]}</h3>
                {grouped[m].length === 0
                  ? <p className="text-sm text-muted-foreground">Aucun repas</p>
                  : <ul className="space-y-2">
                      {grouped[m].map((meal) => (
                        <li key={meal.id} className="rounded-md border p-2 text-sm">
                          <div className="font-medium">{meal.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {meal.kcal} kcal • P {meal.protein_g}g • G {meal.carbs_g}g • L {meal.fat_g}g
                          </div>
                        </li>
                      ))}
                    </ul>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <AddMealDialog open={mealOpen} onOpenChange={setMealOpen} onAdd={addMeal} />
    </div>
  );
}

function AddMealDialog({
  open, onOpenChange, onAdd,
}: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (m: Meal) => void }) {
  const [moment, setMoment] = useState<MealMoment>("matin");
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Nom obligatoire"); return; }
    onAdd({
      id: crypto.randomUUID(),
      moment, name: name.trim(),
      kcal: Number(kcal) || 0,
      protein_g: Number(p) || 0,
      carbs_g: Number(c) || 0,
      fat_g: Number(f) || 0,
    });
    setName(""); setKcal(""); setP(""); setC(""); setF("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter un repas</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Moment</Label>
            <Select value={moment} onValueChange={(v) => setMoment(v as MealMoment)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MOMENT_LABEL) as MealMoment[]).map((m) => (
                  <SelectItem key={m} value={m}>{MOMENT_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nom du repas *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1"><Label>Kcal</Label><Input type="number" min={0} value={kcal} onChange={(e) => setKcal(e.target.value)} /></div>
            <div className="space-y-1"><Label>Prot. (g)</Label><Input type="number" min={0} value={p} onChange={(e) => setP(e.target.value)} /></div>
            <div className="space-y-1"><Label>Gluc. (g)</Label><Input type="number" min={0} value={c} onChange={(e) => setC(e.target.value)} /></div>
            <div className="space-y-1"><Label>Lip. (g)</Label><Input type="number" min={0} value={f} onChange={(e) => setF(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">Ajouter</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
