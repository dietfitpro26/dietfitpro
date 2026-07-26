import { useEffect, useState, useRef, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Upload, FileText, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface MacroPlanData {
  phase?: 1 | 2 | 3;
  mb?: number;
  tdee?: number;
  matin?: { pain_cereales_g?: number; proteines?: boolean; lipides_crus_g?: number };
  midi?: { feculent_cru_g?: number; feculent_cuit_g?: number; legumes?: string; proteines?: boolean; lipides_crus_g?: number };
  soir?: { feculent_cru_g?: number; feculent_cuit_g?: number; legumes?: string; proteines?: boolean; lipides_crus_g?: number };
}

interface Program {
  id: string;
  name: string;
  patient_id: string;
  daily_kcal_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  notes: string | null;
  meals: Meal[] | MacroPlanData | null;
  pdf_url: string | null;
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
  const [uploading, setUploading] = useState(false);
  const [deletingPdf, setDeletingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("nutrition_programs")
      .select("id, name, patient_id, daily_kcal_target, daily_protein_g, daily_carbs_g, daily_fat_g, notes, meals, pdf_url")
      .eq("id", programId)
      .eq("pro_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("Erreur chargement programme:", error.message);
      toast.error("Erreur de chargement : " + error.message);
      setLoading(false);
      return;
    }
    if (!data) { setLoading(false); return; }
    setProgram(data as Program);
    const { data: p } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("id", (data as Program).patient_id)
      .maybeSingle();
    setPatient((p as PatientLite) ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user, programId]);

  const isMealArray = (m: Program["meals"]): m is Meal[] => Array.isArray(m);

  const addMeal = async (meal: Meal) => {
    if (!program) return;
    const currentMeals = isMealArray(program.meals) ? program.meals : [];
    const next = [...currentMeals, meal];
    const { error } = await supabase
      .from("nutrition_programs").update({ meals: next }).eq("id", program.id);
    if (error) { toast.error(error.message); return; }
    setProgram({ ...program, meals: next });
    toast.success("Repas ajouté");
    setMealOpen(false);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !program) return;
    if (file.type !== "application/pdf") { toast.error("Seuls les fichiers PDF sont acceptés"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop lourd (max 10 Mo)"); return; }
    setUploading(true);
    if (program.pdf_url) {
      await supabase.storage.from("program-pdfs").remove([program.pdf_url]);
    }
    const path = `${user.id}/${program.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("program-pdfs")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (uploadError) { toast.error("Erreur upload : " + uploadError.message); setUploading(false); return; }
    const { error: updateError } = await supabase
      .from("nutrition_programs").update({ pdf_url: path }).eq("id", program.id);
    if (updateError) { toast.error("Erreur sauvegarde : " + updateError.message); setUploading(false); return; }
    setProgram({ ...program, pdf_url: path });
    toast.success("✅ PDF uploadé avec succès");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePdfDelete = async () => {
    if (!program?.pdf_url || !user) return;
    if (!confirm("Supprimer le PDF de ce programme ?")) return;
    setDeletingPdf(true);
    await supabase.storage.from("program-pdfs").remove([program.pdf_url]);
    const { error } = await supabase
      .from("nutrition_programs").update({ pdf_url: null }).eq("id", program.id);
    if (error) { toast.error(error.message); setDeletingPdf(false); return; }
    setProgram({ ...program, pdf_url: null });
    toast.success("PDF supprimé");
    setDeletingPdf(false);
  };

  const handlePdfDownload = async () => {
    if (!program?.pdf_url) return;
    const { data, error } = await supabase.storage
      .from("program-pdfs").createSignedUrl(program.pdf_url, 60);
    if (error || !data?.signedUrl) { toast.error("Impossible d'ouvrir le PDF"); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!program) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate({ to: "/pro/nutrition" })}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <p className="mt-4 text-destructive">Programme introuvable.</p>
      </div>
    );
  }

  const mealsArray = isMealArray(program.meals) ? program.meals : [];
  const macroPlan: MacroPlanData = !isMealArray(program.meals) && program.meals ? program.meals : {};
  const hasMacroPlan = macroPlan.matin || macroPlan.midi || macroPlan.soir;

  const grouped: Record<MealMoment, Meal[]> = { matin: [], midi: [], soir: [], collation: [] };
  mealsArray.forEach((m) => { (grouped[m.moment] ??= []).push(m); });

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

      <div className="p-6 space-y-6">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Kcal / jour" value={program.daily_kcal_target ? `${program.daily_kcal_target} kcal` : "—"} />
          <KpiCard label="Protéines" value={program.daily_protein_g ? `${program.daily_protein_g} g` : "—"} />
          <KpiCard label="Glucides" value={program.daily_carbs_g ? `${program.daily_carbs_g} g` : "—"} />
          <KpiCard label="Lipides" value={program.daily_fat_g ? `${program.daily_fat_g} g` : "—"} />
        </div>

        {hasMacroPlan && (
          <>
            <h2 className="text-base font-semibold">Plan alimentaire journalier (visible par le patient)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MealCard
                title="🌅 Matin"
                items={[
                  "Café ou thé sans sucre",
                  macroPlan.matin?.pain_cereales_g ? `${macroPlan.matin.pain_cereales_g} g de pain aux céréales` : "Pain aux céréales",
                  macroPlan.matin?.proteines ? "1 laitage : yaourt nature, fromage blanc 0% ou 1 œuf" : "Une source de protéines",
                  macroPlan.matin?.lipides_crus_g ? `${macroPlan.matin.lipides_crus_g} g de beurre ou 1 c. à café d'huile` : "Un peu de matière grasse crue",
                  "1 fruit de saison",
                ]}
                note="À éviter : viennoiseries, céréales sucrées, jus de fruits industriels."
              />
              <MealCard
                title="☀️ Midi"
                items={[
                  macroPlan.midi?.proteines ? "Protéine : viande blanche, poisson, œuf ou volaille" : "Une source de protéines",
                  macroPlan.midi?.feculent_cru_g
                    ? `${macroPlan.midi.feculent_cru_g} g cru (${macroPlan.midi.feculent_cuit_g ?? macroPlan.midi.feculent_cru_g * 2} g cuit) de féculents`
                    : "Une portion de féculents",
                  macroPlan.midi?.legumes ?? "Légumes à volonté",
                  macroPlan.midi?.lipides_crus_g ? `${macroPlan.midi.lipides_crus_g} g d'huile d'olive crue` : "1 c. à soupe d'huile d'olive",
                  "1 fruit de saison en dessert",
                ]}
                note="À privilégier : cuisson vapeur, grillée ou au four. Éviter les fritures et sauces grasses."
              />
              <MealCard
                title="🌙 Soir"
                items={[
                  macroPlan.soir?.proteines ? "Protéine : poisson, œuf ou viande blanche" : "Une source de protéines",
                  macroPlan.soir?.feculent_cru_g
                    ? `${macroPlan.soir.feculent_cru_g} g cru (${macroPlan.soir.feculent_cuit_g ?? macroPlan.soir.feculent_cru_g * 2} g cuit) de féculents`
                    : "Féculents en quantité réduite",
                  macroPlan.soir?.legumes ?? "Légumes à volonté",
                  macroPlan.soir?.lipides_crus_g ? `${macroPlan.soir.lipides_crus_g} g d'huile d'olive crue` : "1 c. à café d'huile d'olive",
                  "1 yaourt nature en fin de repas",
                ]}
                note="Repas plus léger que le midi. Éviter le sucre et les féculents raffinés le soir."
              />
            </div>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📌 Règles générales à respecter</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>✅ Boire 1,5 à 2L d'eau par jour, en dehors des repas de préférence.</p>
                <p>✅ Privilégier les cuissons sans matière grasse ajoutée (vapeur, four, grill, poêle anti-adhésive).</p>
                <p>✅ Manger lentement, à heures régulières, et écouter sa satiété.</p>
                <p>❌ Éviter les grignotages entre les repas, les boissons sucrées et l'alcool.</p>
                <p>❌ Limiter les produits ultra-transformés et la charcuterie.</p>
                {program.notes && <p className="pt-2 border-t mt-2 italic">📝 Note du coach : {program.notes}</p>}
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#6DB33F]" />
              Document PDF complémentaire (optionnel)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {program.pdf_url ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-[#6DB33F]/5 border-[#6DB33F]/20">
                <FileText className="h-8 w-8 text-[#6DB33F] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Programme nutrition — PDF</p>
                  <p className="text-xs text-muted-foreground">Visible par le patient dans son espace</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={handlePdfDownload} title="Voir le PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handlePdfDelete} disabled={deletingPdf}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 border-2 border-dashed rounded-lg text-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Aucun PDF associé à ce programme</p>
                  <p className="text-xs text-muted-foreground">Max 10 Mo · Format PDF uniquement</p>
                </div>
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {uploading ? "Upload en cours…" : "Importer un PDF"}
                </Button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
            {program.pdf_url && (
              <div className="mt-3">
                <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3" />
                  {uploading ? "Upload en cours…" : "Remplacer le PDF"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Repas personnalisés (manuel)</h2>
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
                  ? <p className="text-sm text-muted-foreground">Aucun repas ajouté manuellement</p>
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-[#2D7A1F]">{value}</p>
    </div>
  );
}

function MealCard({ title, items, note }: { title: string; items: string[]; note?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-[#6DB33F] mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {note && <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">{note}</p>}
      </CardContent>
    </Card>
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