import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Plus, Search, Trash2, ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/pro/nutrition")({
  head: () => ({ meta: [{ title: "Programmes nutrition — DietFitPro" }] }),
  component: Page,
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface PatientLite { id: string; first_name: string; last_name: string }
interface NutritionRow {
  id: string; name: string; patient_id: string;
  daily_kcal_target: number | null; start_date: string;
  end_date: string | null; is_active: boolean; created_at: string;
  patient?: PatientLite | null;
}
interface Protein {
  id: string; name: string; kcal_per_100g: number; protein_per_100g: number; is_default: boolean;
}
interface Starch {
  id: string; name: string; carbs_per_100g: number; kcal_per_100g: number;
}
interface NutritionTemplate {
  id: string; name: string; objective: string; total_kcal: number;
  breakfast_pct: number; lunch_pct: number; dinner_pct: number;
  protein_pct: number; carbs_pct: number; fat_pct: number;
  breakfast_yogurt_g: number; breakfast_bread_g: number;
  breakfast_butter_or_jam: string; breakfast_butter_or_jam_g: number;
  breakfast_notes: string | null; lunch_notes: string | null; dinner_notes: string | null;
  created_at: string;
}
interface TemplateProtein { protein_id: string; meal: string; quantity_g: number; protein?: Protein }
interface TemplateStarch { starch_id: string; meal: string; starch?: Starch }

const OBJECTIVE_LABEL: Record<string, string> = {
  perte_poids: "Perte de poids", prise_masse: "Prise de masse", equilibre: "Équilibre",
};
const OBJECTIVE_COLOR: Record<string, string> = {
  perte_poids: "bg-blue-100 text-blue-700",
  prise_masse: "bg-orange-100 text-orange-700",
  equilibre: "bg-green-100 text-green-700",
};

function Page() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><Content /></ProLayout>
    </ProtectedRoute>
  );
}

function weeksBetween(start: string, end: string | null): string {
  if (!end) return "—";
  const d = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  return d > 0 ? `${Math.round(d / 7)} sem.` : "—";
}

// ─── Génération PDF ──────────────────────────────────────────────────────────
async function generateNutritionPdf(
  template: NutritionTemplate,
  patient: PatientLite,
  lunchProteins: TemplateProtein[],
  dinnerProteins: TemplateProtein[],
  lunchStarches: TemplateStarch[],
  dinnerStarches: TemplateStarch[],
): Promise<Blob> {
  const breakfastKcal = Math.round(template.total_kcal * template.breakfast_pct / 100);
  const lunchKcal = Math.round(template.total_kcal * template.lunch_pct / 100);
  const dinnerKcal = Math.round(template.total_kcal * template.dinner_pct / 100);
  const proteinGLunch = Math.round(lunchKcal * template.protein_pct / 100 / 4);
  const proteinGDinner = Math.round(dinnerKcal * template.protein_pct / 100 / 4);
  const carbsGLunch = Math.round(lunchKcal * template.carbs_pct / 100 / 4);
  const carbsGDinner = Math.round(dinnerKcal * template.carbs_pct / 100 / 4);

  const starchEquiv = (starchesList: TemplateStarch[], carbsG: number) =>
    starchesList.map(ts => {
      if (!ts.starch) return "";
      const qty = Math.round(carbsG / ts.starch.carbs_per_100g * 100);
      return `${ts.starch.name} : ${qty}g`;
    }).filter(Boolean).join("  |  ");

  const html = `<html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:32px;width:794px;}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:16px;border-bottom:3px solid #6DB33F;}
    .logo{font-size:20px;font-weight:800;color:#6DB33F;}
    .logo span{color:#1a1a1a;}
    .patient-name{font-size:16px;font-weight:700;text-align:right;}
    .patient-sub{font-size:12px;color:#666;text-align:right;margin-top:2px;}
    h1{font-size:22px;font-weight:800;margin-bottom:6px;}
    .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:#6DB33F22;color:#2D7A1F;margin-bottom:20px;}
    .kcal-row{display:flex;gap:0;margin-bottom:24px;border:1px solid #e9ecef;border-radius:10px;overflow:hidden;}
    .kcal-item{flex:1;text-align:center;padding:12px 8px;border-right:1px solid #e9ecef;}
    .kcal-item:last-child{border-right:none;}
    .kcal-item .val{font-size:18px;font-weight:800;color:#6DB33F;}
    .kcal-item .lbl{font-size:10px;color:#666;margin-top:2px;}
    .meal{border:1px solid #e9ecef;border-radius:10px;overflow:hidden;margin-bottom:16px;}
    .meal-header{background:#6DB33F;color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;}
    .meal-header h2{font-size:14px;font-weight:700;}
    .meal-kcal{font-size:12px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:999px;}
    .meal-body{padding:14px 16px;}
    .row{display:flex;gap:8px;margin-bottom:8px;}
    .row:last-child{margin-bottom:0;}
    .dot{width:6px;height:6px;border-radius:50%;background:#6DB33F;margin-top:5px;flex-shrink:0;}
    .row-label{font-size:12px;font-weight:600;}
    .row-detail{font-size:11px;color:#555;margin-top:2px;}
    .equiv{background:#f4fdf0;border:1px solid #6DB33F30;border-radius:6px;padding:7px 10px;margin-top:5px;}
    .equiv-title{font-size:10px;font-weight:700;color:#2D7A1F;margin-bottom:3px;text-transform:uppercase;}
    .equiv-list{font-size:11px;color:#444;}
    .note{background:#fffbf0;border-left:3px solid #f59e0b;padding:7px 10px;border-radius:0 5px 5px 0;margin-top:8px;font-size:11px;color:#555;font-style:italic;}
    .footer{margin-top:28px;padding-top:12px;border-top:1px solid #e9ecef;text-align:center;font-size:10px;color:#999;}
  </style></head><body>
  <div class="header">
    <div class="logo">Diet<span>Fit</span>Pro</div>
    <div><div class="patient-name">${patient.first_name} ${patient.last_name}</div><div class="patient-sub">Programme personnalise - ${new Date().toLocaleDateString("fr-FR")}</div></div>
  </div>
  <h1>${template.name}</h1>
  <div class="badge">${OBJECTIVE_LABEL[template.objective] ?? template.objective}</div>
  <div class="kcal-row">
    <div class="kcal-item"><div class="val">${template.total_kcal}</div><div class="lbl">Calories / jour</div></div>
    <div class="kcal-item"><div class="val">${Math.round(template.total_kcal * template.protein_pct / 100 / 4)}g</div><div class="lbl">Proteines</div></div>
    <div class="kcal-item"><div class="val">${Math.round(template.total_kcal * template.carbs_pct / 100 / 4)}g</div><div class="lbl">Glucides</div></div>
    <div class="kcal-item"><div class="val">${Math.round(template.total_kcal * template.fat_pct / 100 / 9)}g</div><div class="lbl">Lipides</div></div>
    <div class="kcal-item"><div class="val">${template.protein_pct}/${template.carbs_pct}/${template.fat_pct}</div><div class="lbl">P/G/L %</div></div>
  </div>
  <div class="meal">
    <div class="meal-header"><h2>Petit-dejeuner</h2><span class="meal-kcal">${breakfastKcal} kcal</span></div>
    <div class="meal-body">
      <div class="row"><div class="dot"></div><div><div class="row-label">${template.breakfast_yogurt_g}g de yaourt nature</div></div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">${template.breakfast_bread_g}g de pain aux cereales</div></div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">${template.breakfast_butter_or_jam_g}g de ${template.breakfast_butter_or_jam}</div></div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">1 fruit de saison</div></div></div>
      ${template.breakfast_notes ? `<div class="note">${template.breakfast_notes}</div>` : ""}
    </div>
  </div>
  <div class="meal">
    <div class="meal-header"><h2>Dejeuner</h2><span class="meal-kcal">${lunchKcal} kcal</span></div>
    <div class="meal-body">
      <div class="row"><div class="dot"></div><div><div class="row-label">Proteine : ${proteinGLunch}g</div><div class="row-detail">${lunchProteins.map(tp => tp.protein?.name ?? "").filter(Boolean).join(" - ") || "Au choix"}</div></div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">Feculents (${carbsGLunch}g de glucides)</div>${lunchStarches.length > 0 ? `<div class="equiv"><div class="equiv-title">Equivalences</div><div class="equiv-list">${starchEquiv(lunchStarches, carbsGLunch)}</div></div>` : ""}</div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">Legumes a volonte</div><div class="row-detail">Crus ou cuits, 1 c. a soupe d'huile d'olive</div></div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">1 fruit de saison</div></div></div>
      ${template.lunch_notes ? `<div class="note">${template.lunch_notes}</div>` : ""}
    </div>
  </div>
  <div class="meal">
    <div class="meal-header"><h2>Diner</h2><span class="meal-kcal">${dinnerKcal} kcal</span></div>
    <div class="meal-body">
      <div class="row"><div class="dot"></div><div><div class="row-label">Proteine : ${proteinGDinner}g</div><div class="row-detail">${dinnerProteins.map(tp => tp.protein?.name ?? "").filter(Boolean).join(" - ") || "Au choix"}</div></div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">Feculents reduits (${carbsGDinner}g de glucides)</div>${dinnerStarches.length > 0 ? `<div class="equiv"><div class="equiv-title">Equivalences</div><div class="equiv-list">${starchEquiv(dinnerStarches, carbsGDinner)}</div></div>` : ""}</div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">Legumes a volonte</div></div></div>
      <div class="row"><div class="dot"></div><div><div class="row-label">1 yaourt nature</div></div></div>
      ${template.dinner_notes ? `<div class="note">${template.dinner_notes}</div>` : ""}
    </div>
  </div>
  <div class="footer">Document genere par DietFitPro - ${new Date().toLocaleDateString("fr-FR")} - Ce programme est personnalise et confidentiel</div>
  </body></html>`;

  // Créer un conteneur hors-écran
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;background:#fff;";
  container.innerHTML = html;
  document.body.appendChild(container);

  await new Promise((r) => setTimeout(r, 300));

  const { default: html2canvas } = await import("html2canvas");
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    width: 794,
    windowWidth: 794,
  });

  document.body.removeChild(container);

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = (canvas.height * pdfW) / canvas.width;

  // Si le contenu dépasse une page, on découpe
  const pageH = pdf.internal.pageSize.getHeight();
  if (pdfH <= pageH) {
    pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
  } else {
    let yOffset = 0;
    while (yOffset < canvas.height) {
      const sliceH = Math.min((pageH * canvas.width) / pdfW, canvas.height - yOffset);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, -yOffset);
      const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(sliceData, "JPEG", 0, 0, pdfW, (sliceH * pdfW) / canvas.width);
      yOffset += sliceH;
    }
  }

  return pdf.output("blob");
}
// ─── Content principal ────────────────────────────────────────────────────────
function Content() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<NutritionRow[] | null>(null);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [templates, setTemplates] = useState<NutritionTemplate[] | null>(null);
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [starches, setStarches] = useState<Starch[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState("");
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [assignTemplate, setAssignTemplate] = useState<NutritionTemplate | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: progs }, { data: pats }, { data: tmpl }, { data: prot }, { data: stch }] = await Promise.all([
      supabase.from("nutrition_programs").select("id, name, patient_id, daily_kcal_target, start_date, end_date, is_active, created_at").eq("pro_id", user.id).order("created_at", { ascending: false }),
      supabase.from("patients").select("id, first_name, last_name").eq("pro_id", user.id),
      supabase.from("nutrition_templates").select("*").eq("pro_id", user.id).order("created_at", { ascending: false }),
      supabase.from("nutrition_proteins").select("*").or(`is_default.eq.true,pro_id.eq.${user.id}`),
      supabase.from("nutrition_starches").select("*").order("name"),
    ]);
    const pmap = new Map((pats ?? []).map((p) => [p.id, p as PatientLite]));
    setPatients((pats ?? []) as PatientLite[]);
    setRows(((progs ?? []) as NutritionRow[]).map((r) => ({ ...r, patient: pmap.get(r.patient_id) ?? null })));
    setTemplates((tmpl ?? []) as NutritionTemplate[]);
    setProteins((prot ?? []) as Protein[]);
    setStarches((stch ?? []) as Starch[]);
  };

  useEffect(() => { void load(); }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const pname = r.patient ? `${r.patient.first_name} ${r.patient.last_name}`.toLowerCase() : "";
      return r.name.toLowerCase().includes(q) || pname.includes(q);
    });
  }, [rows, search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("nutrition_programs").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev?.filter((x) => x.id !== deleteId) ?? null);
    toast.success("Programme supprimé"); setDeleteId(null); setDeleteName("");
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    setDeletingTemplate(true);
    const { error } = await supabase.from("nutrition_templates").delete().eq("id", deleteTemplateId);
    setDeletingTemplate(false);
    if (error) { toast.error(error.message); return; }
    setTemplates((prev) => prev?.filter((x) => x.id !== deleteTemplateId) ?? null);
    toast.success("Template supprimé"); setDeleteTemplateId(null); setDeleteTemplateName("");
  };

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Programmes nutrition</h1>
        <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
      </header>

      <div className="p-6">
        <Tabs defaultValue="programmes">
          <TabsList className="mb-4">
            <TabsTrigger value="programmes">Programmes patients</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          {/* ── Onglet Programmes ── */}
          <TabsContent value="programmes" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> Nouveau programme
              </Button>
            </div>
            <div className="rounded-lg border bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead><TableHead>Patient</TableHead>
                    <TableHead>Calories/j</TableHead><TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead><TableHead>Créé le</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered === null
                    ? Array.from({ length: 4 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>)
                    : filtered.length === 0
                      ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Aucun programme.</TableCell></TableRow>
                      : filtered.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/pro/nutrition/$programId", params: { programId: r.id } })}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "—"}</TableCell>
                          <TableCell>{r.daily_kcal_target ?? "—"}</TableCell>
                          <TableCell>{weeksBetween(r.start_date, r.end_date)}</TableCell>
                          <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.is_active ? "bg-[#6DB33F]/15 text-[#2D7A1F]" : "bg-muted text-muted-foreground"}`}>{r.is_active ? "Actif" : "Inactif"}</span></TableCell>
                          <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); setDeleteName(r.name); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Onglet Templates ── */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Créez un template une fois, assignez-le à plusieurs patients.</p>
              <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setTemplateModalOpen(true)}>
                <Plus className="h-4 w-4" /> Nouveau template
              </Button>
            </div>

            {templates === null ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">Aucun template. Créez votre premier template.</div>
            ) : (
              <div className="space-y-3">
                {templates.map((t) => (
                  <div key={t.id} className="rounded-lg border bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}>
                          {expandedTemplate === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.name}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${OBJECTIVE_COLOR[t.objective] ?? ""}`}>{OBJECTIVE_LABEL[t.objective] ?? t.objective}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.total_kcal} kcal · Petit-déj {t.breakfast_pct}% · Déj {t.lunch_pct}% · Dîner {t.dinner_pct}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setAssignTemplate(t)}>
                          <Copy className="h-3 w-3" /> Assigner
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { setDeleteTemplateId(t.id); setDeleteTemplateName(t.name); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {expandedTemplate === t.id && (
                      <div className="border-t px-4 py-4 bg-muted/20 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MealCard title="🌅 Petit-déjeuner" kcal={Math.round(t.total_kcal * t.breakfast_pct / 100)}
                          items={[`${t.breakfast_yogurt_g}g yaourt nature`, `${t.breakfast_bread_g}g pain aux céréales`, `${t.breakfast_butter_or_jam_g}g ${t.breakfast_butter_or_jam}`, "1 fruit"]}
                          notes={t.breakfast_notes} />
                        <MealCard title="☀️ Déjeuner" kcal={Math.round(t.total_kcal * t.lunch_pct / 100)}
                          items={["Protéine (voir sélection)", "Féculents avec équivalences", "Légumes à volonté", "1 fruit"]}
                          notes={t.lunch_notes} />
                        <MealCard title="🌙 Dîner" kcal={Math.round(t.total_kcal * t.dinner_pct / 100)}
                          items={["Protéine (voir sélection)", "Féculents réduits", "Légumes à volonté", "1 yaourt nature"]}
                          notes={t.dinner_notes} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals suppression */}
      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) { setDeleteId(null); setDeleteName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer le programme ?</DialogTitle><DialogDescription>"{deleteName}" sera définitivement supprimé.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteId(null); setDeleteName(""); }}>Annuler</Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>{deleting ? "Suppression…" : "Supprimer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTemplateId} onOpenChange={(v) => { if (!v) { setDeleteTemplateId(null); setDeleteTemplateName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer le template ?</DialogTitle><DialogDescription>"{deleteTemplateName}" sera définitivement supprimé.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteTemplateId(null); setDeleteTemplateName(""); }}>Annuler</Button>
            <Button variant="destructive" disabled={deletingTemplate} onClick={handleDeleteTemplate}>{deletingTemplate ? "Suppression…" : "Supprimer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewProgramDialog open={modalOpen} onOpenChange={setModalOpen} patients={patients} onCreated={() => { setModalOpen(false); void load(); }} />
      <NewTemplateDialog open={templateModalOpen} onOpenChange={setTemplateModalOpen} proteins={proteins} starches={starches} userId={user?.id ?? ""} onCreated={() => { setTemplateModalOpen(false); void load(); }} />
      {assignTemplate && (
        <AssignTemplateDialog
          template={assignTemplate}
          patients={patients}
          proteins={proteins}
          starches={starches}
          userId={user?.id ?? ""}
          onClose={() => setAssignTemplate(null)}
          onDone={() => { setAssignTemplate(null); void load(); }}
        />
      )}
    </div>
  );
}

// ─── Carte repas ──────────────────────────────────────────────────────────────
function MealCard({ title, kcal, items, notes }: { title: string; kcal: number; items: string[]; notes: string | null }) {
  return (
    <Card className="shadow-none border">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          {title}<span className="text-xs font-normal text-muted-foreground">{kcal} kcal</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ul className="space-y-1">{items.map((item, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1"><span className="text-[#6DB33F] mt-0.5">•</span>{item}</li>)}</ul>
        {notes && <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">{notes}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Modal Assigner ───────────────────────────────────────────────────────────
function AssignTemplateDialog({
  template, patients, proteins, starches, userId, onClose, onDone,
}: {
  template: NutritionTemplate; patients: PatientLite[];
  proteins: Protein[]; starches: Starch[];
  userId: string; onClose: () => void; onDone: () => void;
}) {
  const [patientId, setPatientId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!patientId) { toast.error("Sélectionne un patient"); return; }
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    setAssigning(true);
    toast.info("Génération du PDF en cours…");

    try {
      // Charger les protéines et féculents du template
      const [{ data: tmplProteins }, { data: tmplStarches }] = await Promise.all([
        supabase.from("nutrition_template_proteins").select("*, protein:nutrition_proteins(*)").eq("template_id", template.id),
        supabase.from("nutrition_template_starches").select("*, starch:nutrition_starches(*)").eq("template_id", template.id),
      ]);

      const lunchProteins = ((tmplProteins ?? []) as any[]).filter(p => p.meal === "lunch").map(p => ({ ...p, protein: p.protein }));
      const dinnerProteins = ((tmplProteins ?? []) as any[]).filter(p => p.meal === "dinner").map(p => ({ ...p, protein: p.protein }));
      const lunchStarches = ((tmplStarches ?? []) as any[]).filter(s => s.meal === "lunch").map(s => ({ ...s, starch: s.starch }));
      const dinnerStarches = ((tmplStarches ?? []) as any[]).filter(s => s.meal === "dinner").map(s => ({ ...s, starch: s.starch }));

      // Générer le PDF
      const pdfBlob = await generateNutritionPdf(template, patient, lunchProteins, dinnerProteins, lunchStarches, dinnerStarches);

      // Upload dans message-attachments
      const fileName = `nutrition-${Date.now()}.pdf`;
      const filePath = `${userId}/patient-docs/${patientId}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: false });

      if (uploadError) { toast.error("Erreur upload PDF : " + uploadError.message); setAssigning(false); return; }

      // Insérer dans patient_documents
      const { error: docError } = await supabase.from("patient_documents").insert({
        patient_id: patientId,
        pro_id: userId,
        title: template.name,
        file_url: filePath,
        file_name: `${template.name}.pdf`,
        category: "nutrition",
      });

      if (docError) { toast.error("Erreur sauvegarde : " + docError.message); setAssigning(false); return; }

      // Créer aussi un nutrition_program lié
      await supabase.from("nutrition_programs").insert({
        pro_id: userId,
        patient_id: patientId,
        name: template.name,
        daily_kcal_target: template.total_kcal,
        start_date: new Date().toISOString().slice(0, 10),
        is_active: true,
        notes: `Généré depuis le template : ${template.name}`,
      });

      toast.success(`✅ Programme assigné à ${patient.first_name} ${patient.last_name} et PDF généré !`);
      onDone();
    } catch (err) {
      toast.error("Erreur inattendue : " + String(err));
      setAssigning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assigner le template</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">"{template.name}"</span> · {template.total_kcal} kcal · {OBJECTIVE_LABEL[template.objective]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Choisir le patient *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un patient…" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>✅ Un <strong>programme nutrition</strong> sera créé pour ce patient</p>
            <p>✅ Un <strong>PDF personnalisé</strong> sera généré automatiquement</p>
            <p>✅ Le PDF apparaîtra dans le <strong>dashboard du patient</strong></p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" disabled={assigning || !patientId} onClick={handleAssign}>
            {assigning ? "Génération en cours…" : "Assigner & Générer PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Nouveau Template (3 étapes) ────────────────────────────────────────
function NewTemplateDialog({
  open, onOpenChange, proteins, starches, userId, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  proteins: Protein[]; starches: Starch[]; userId: string; onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("equilibre");
  const [totalKcal, setTotalKcal] = useState("1800");
  const [breakfastPct, setBreakfastPct] = useState("30");
  const [lunchPct, setLunchPct] = useState("40");
  const [dinnerPct, setDinnerPct] = useState("30");
  const [proteinPct, setProteinPct] = useState("30");
  const [carbsPct, setCarbsPct] = useState("50");
  const [fatPct, setFatPct] = useState("20");
  const [yogurtG, setYogurtG] = useState("125");
  const [breadG, setBreadG] = useState("40");
  const [butterOrJam, setButterOrJam] = useState("beurre");
  const [butterOrJamG, setButterOrJamG] = useState("10");
  const [breakfastNotes, setBreakfastNotes] = useState("");
  const [lunchNotes, setLunchNotes] = useState("");
  const [dinnerNotes, setDinnerNotes] = useState("");
  const [selectedLunchProteins, setSelectedLunchProteins] = useState<string[]>([]);
  const [selectedDinnerProteins, setSelectedDinnerProteins] = useState<string[]>([]);
  const [selectedLunchStarches, setSelectedLunchStarches] = useState<string[]>([]);
  const [selectedDinnerStarches, setSelectedDinnerStarches] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const kcal = Number(totalKcal) || 1800;
  const breakfastKcal = Math.round(kcal * Number(breakfastPct) / 100);
  const lunchKcal = Math.round(kcal * Number(lunchPct) / 100);
  const dinnerKcal = Math.round(kcal * Number(dinnerPct) / 100);
  const totalPct = Number(breakfastPct) + Number(lunchPct) + Number(dinnerPct);
  const macroTotal = Number(proteinPct) + Number(carbsPct) + Number(fatPct);

  const reset = () => {
    setStep(1); setName(""); setObjective("equilibre"); setTotalKcal("1800");
    setBreakfastPct("30"); setLunchPct("40"); setDinnerPct("30");
    setProteinPct("30"); setCarbsPct("50"); setFatPct("20");
    setYogurtG("125"); setBreadG("40"); setButterOrJam("beurre"); setButterOrJamG("10");
    setBreakfastNotes(""); setLunchNotes(""); setDinnerNotes("");
    setSelectedLunchProteins([]); setSelectedDinnerProteins([]);
    setSelectedLunchStarches([]); setSelectedDinnerStarches([]);
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("Le nom est obligatoire"); return; }
    if (totalPct !== 100) { toast.error("La répartition des repas doit totaliser 100%"); return; }
    if (macroTotal !== 100) { toast.error("La répartition des macros doit totaliser 100%"); return; }
    setSubmitting(true);
    const { data: tmpl, error } = await supabase.from("nutrition_templates").insert({
      pro_id: userId, name: name.trim(), objective, total_kcal: kcal,
      breakfast_pct: Number(breakfastPct), lunch_pct: Number(lunchPct), dinner_pct: Number(dinnerPct),
      protein_pct: Number(proteinPct), carbs_pct: Number(carbsPct), fat_pct: Number(fatPct),
      breakfast_yogurt_g: Number(yogurtG), breakfast_bread_g: Number(breadG),
      breakfast_butter_or_jam: butterOrJam, breakfast_butter_or_jam_g: Number(butterOrJamG),
      breakfast_notes: breakfastNotes.trim() || null,
      lunch_notes: lunchNotes.trim() || null,
      dinner_notes: dinnerNotes.trim() || null,
    }).select().single();
    if (error || !tmpl) { toast.error(error?.message ?? "Erreur"); setSubmitting(false); return; }
    const templateId = (tmpl as { id: string }).id;
    const proteinRows = [
      ...selectedLunchProteins.map((pid) => ({ template_id: templateId, protein_id: pid, meal: "lunch", quantity_g: Math.round(lunchKcal * Number(proteinPct) / 100 / 4) })),
      ...selectedDinnerProteins.map((pid) => ({ template_id: templateId, protein_id: pid, meal: "dinner", quantity_g: Math.round(dinnerKcal * Number(proteinPct) / 100 / 4) })),
    ];
    const starchRows = [
      ...selectedLunchStarches.map((sid) => ({ template_id: templateId, starch_id: sid, meal: "lunch" })),
      ...selectedDinnerStarches.map((sid) => ({ template_id: templateId, starch_id: sid, meal: "dinner" })),
    ];
    if (proteinRows.length > 0) await supabase.from("nutrition_template_proteins").insert(proteinRows);
    if (starchRows.length > 0) await supabase.from("nutrition_template_starches").insert(starchRows);
    setSubmitting(false);
    toast.success("Template créé !");
    reset(); onCreated();
  };

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau template nutritionnel</DialogTitle>
          <DialogDescription>Étape {step} / 3 — {step === 1 ? "Informations & petit-déjeuner" : step === 2 ? "Répartition & macros" : "Protéines & féculents"}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Nom du template *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Perte de poids 1600 kcal" /></div>
              <div className="space-y-1"><Label>Objectif</Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perte_poids">Perte de poids</SelectItem>
                    <SelectItem value="prise_masse">Prise de masse</SelectItem>
                    <SelectItem value="equilibre">Équilibre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Calories / jour</Label><Input type="number" min={800} max={5000} value={totalKcal} onChange={(e) => setTotalKcal(e.target.value)} /></div>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium text-sm">🌅 Petit-déjeuner</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Yaourt nature (g)</Label><Input type="number" value={yogurtG} onChange={(e) => setYogurtG(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Pain aux céréales (g)</Label><Input type="number" value={breadG} onChange={(e) => setBreadG(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Beurre ou confiture</Label>
                  <Select value={butterOrJam} onValueChange={setButterOrJam}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="beurre">Beurre</SelectItem><SelectItem value="confiture">Confiture</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Quantité (g)</Label><Input type="number" value={butterOrJamG} onChange={(e) => setButterOrJamG(e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Notes petit-déjeuner</Label><Textarea value={breakfastNotes} onChange={(e) => setBreakfastNotes(e.target.value)} rows={2} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Notes déjeuner</Label><Textarea value={lunchNotes} onChange={(e) => setLunchNotes(e.target.value)} rows={2} /></div>
            <div className="space-y-1"><Label className="text-xs">Notes dîner</Label><Textarea value={dinnerNotes} onChange={(e) => setDinnerNotes(e.target.value)} rows={2} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Répartition des repas</h3>
                <span className={`text-xs font-medium ${totalPct === 100 ? "text-green-600" : "text-red-500"}`}>Total : {totalPct}% {totalPct !== 100 ? "(doit être 100%)" : "✓"}</span>
              </div>
              {[{ label: "🌅 Petit-déjeuner", val: breakfastPct, set: setBreakfastPct, k: breakfastKcal },
                { label: "☀️ Déjeuner", val: lunchPct, set: setLunchPct, k: lunchKcal },
                { label: "🌙 Dîner", val: dinnerPct, set: setDinnerPct, k: dinnerKcal }].map(({ label, val, set, k }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm w-36 shrink-0">{label}</span>
                  <Input type="number" min={0} max={100} value={val} onChange={(e) => set(e.target.value)} className="w-20" />
                  <span className="text-xs text-muted-foreground">% = {k} kcal</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Répartition des macros</h3>
                <span className={`text-xs font-medium ${macroTotal === 100 ? "text-green-600" : "text-red-500"}`}>Total : {macroTotal}% {macroTotal !== 100 ? "(doit être 100%)" : "✓"}</span>
              </div>
              {[{ label: "🥩 Protéines", val: proteinPct, set: setProteinPct },
                { label: "🍚 Glucides", val: carbsPct, set: setCarbsPct },
                { label: "🫒 Lipides", val: fatPct, set: setFatPct }].map(({ label, val, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm w-28 shrink-0">{label}</span>
                  <Input type="number" min={0} max={100} value={val} onChange={(e) => set(e.target.value)} className="w-20" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-muted/30 p-4 space-y-2">
              <h3 className="font-medium text-sm">Aperçu automatique</h3>
              {[{ meal: "Déjeuner", mkcal: lunchKcal }, { meal: "Dîner", mkcal: dinnerKcal }].map(({ meal, mkcal }) => (
                <div key={meal} className="text-xs space-y-0.5">
                  <p className="font-medium">{meal} ({mkcal} kcal)</p>
                  <p className="text-muted-foreground">→ Protéine : ~{Math.round(mkcal * Number(proteinPct) / 100 / 4)}g · Glucides : ~{Math.round(mkcal * Number(carbsPct) / 100 / 4)}g · Lipides : ~{Math.round(mkcal * Number(fatPct) / 100 / 9)}g</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            {[
              { title: `🥩 Protéines au déjeuner (~${Math.round(lunchKcal * Number(proteinPct) / 100 / 4)}g)`, list: selectedLunchProteins, setList: setSelectedLunchProteins, prefix: "lp" },
              { title: `🥩 Protéines au dîner (~${Math.round(dinnerKcal * Number(proteinPct) / 100 / 4)}g)`, list: selectedDinnerProteins, setList: setSelectedDinnerProteins, prefix: "dp" },
            ].map(({ title, list, setList, prefix }) => (
              <div key={prefix} className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-sm">{title}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {proteins.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox id={`${prefix}-${p.id}`} checked={list.includes(p.id)} onCheckedChange={() => toggleItem(p.id, list, setList)} />
                      <label htmlFor={`${prefix}-${p.id}`} className="text-sm cursor-pointer">{p.name}</label>
                      <span className="text-xs text-muted-foreground ml-auto">{p.kcal_per_100g} kcal/100g</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {[
              { title: `🍚 Féculents au déjeuner (pour ~${Math.round(lunchKcal * Number(carbsPct) / 100 / 4)}g glucides)`, list: selectedLunchStarches, setList: setSelectedLunchStarches, prefix: "ls", carbsG: Math.round(lunchKcal * Number(carbsPct) / 100 / 4) },
              { title: `🍚 Féculents au dîner (portion réduite — 60% du déj)`, list: selectedDinnerStarches, setList: setSelectedDinnerStarches, prefix: "ds", carbsG: Math.round(lunchKcal * Number(carbsPct) / 100 / 4 * 0.6) },
            ].map(({ title, list, setList, prefix, carbsG }) => (
              <div key={prefix} className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-sm">{title}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {starches.map((s) => {
                    const qty = Math.round(carbsG / s.carbs_per_100g * 100);
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <Checkbox id={`${prefix}-${s.id}`} checked={list.includes(s.id)} onCheckedChange={() => toggleItem(s.id, list, setList)} />
                        <label htmlFor={`${prefix}-${s.id}`} className="text-sm cursor-pointer">{s.name}</label>
                        <span className="text-xs text-muted-foreground ml-auto">~{qty}g</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <div className="flex gap-1">{[1, 2, 3].map((s) => <div key={s} className={`h-2 w-8 rounded-full ${step >= s ? "bg-[#6DB33F]" : "bg-muted"}`} />)}</div>
          <div className="flex gap-2">
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Précédent</Button>}
            {step < 3
              ? <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" onClick={() => setStep(step + 1)}>Suivant</Button>
              : <Button className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white" disabled={submitting} onClick={submit}>{submitting ? "Création…" : "Créer le template"}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Nouveau Programme ──────────────────────────────────────────────────
function NewProgramDialog({ open, onOpenChange, patients, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; patients: PatientLite[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(""); const [patientId, setPatientId] = useState("");
  const [kcal, setKcal] = useState(""); const [weeks, setWeeks] = useState("");
  const [notes, setNotes] = useState(""); const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const reset = () => { setName(""); setPatientId(""); setKcal(""); setWeeks(""); setNotes(""); setIsActive(true); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !patientId) { toast.error("Nom et patient obligatoires"); return; }
    setSubmitting(true);
    const start = new Date();
    const end = weeks ? new Date(start.getTime() + Number(weeks) * 7 * 86400000) : null;
    const { error } = await supabase.from("nutrition_programs").insert({
      pro_id: user.id, patient_id: patientId, name: name.trim(),
      daily_kcal_target: kcal ? Number(kcal) : null,
      start_date: start.toISOString().slice(0, 10),
      end_date: end ? end.toISOString().slice(0, 10) : null,
      notes: notes.trim() || null, is_active: isActive,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Programme créé"); reset(); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouveau programme nutrition</DialogTitle><DialogDescription>Renseignez les informations principales.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} /></div>
          <div className="space-y-1"><Label>Patient *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Calories / jour</Label><Input type="number" min={0} value={kcal} onChange={(e) => setKcal(e.target.value)} /></div>
            <div className="space-y-1"><Label>Semaines</Label><Input type="number" min={1} value={weeks} onChange={(e) => setWeeks(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="active">Programme actif</Label>
            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">{submitting ? "Création…" : "Créer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}