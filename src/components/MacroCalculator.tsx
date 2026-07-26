import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";


export interface MacroResult {
  mb: number;
  tdee: number;
  target_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  feculent_midi_cru_g: number;
  feculent_soir_cru_g: number;
  feculent_matin_pain_g: number;
  phase: 1 | 2 | 3;
}


interface Props {
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  gender: "homme" | "femme" | null;
  onValidate: (result: MacroResult) => void;
}


const NAP_OPTIONS = [
  { value: "1.40", label: "Sédentaire (bureau, peu de marche)" },
  { value: "1.55", label: "Légèrement actif (marche ~30min/j)" },
  { value: "1.70", label: "Modérément actif (sport 3×/sem)" },
  { value: "1.85", label: "Très actif (sport 5×/sem)" },
  { value: "2.00", label: "Extrêmement actif (athlète)" },
];


const PHASE_OPTIONS = [
  { value: "1", label: "Phase 1 — Déficit léger (-150 kcal)", deficit: 150 },
  { value: "2", label: "Phase 2 — Déficit modéré (-400 kcal)", deficit: 400 },
  { value: "3", label: "Phase 3 — Déficit important (-700 kcal)", deficit: 700 },
];


const FECULENT_OPTIONS = [
  { value: "riz", label: "Riz", kcal: 350, glucides: 78 },
  { value: "pates", label: "Pâtes", kcal: 370, glucides: 74 },
  { value: "quinoa", label: "Quinoa", kcal: 368, glucides: 64 },
  { value: "patate_douce", label: "Patate douce", kcal: 86, glucides: 20 },
  { value: "lentilles", label: "Lentilles", kcal: 116, glucides: 20 },
  { value: "flocons", label: "Flocons avoine", kcal: 370, glucides: 66 },
];


function calcMB(
  weight: number,
  height: number,
  age: number,
  gender: "homme" | "femme"
): number {
  const base =
    1.083 *
    Math.pow(weight, 0.48) *
    Math.pow(height, 0.5) *
    Math.pow(age, -0.13) *
    1000;


  return Math.round(gender === "femme" ? base * 0.963 : base);
}


export function MacroCalculator({
  weight_kg,
  height_cm,
  age,
  gender,
  onValidate,
}: Props) {
  const [weight, setWeight] = useState(weight_kg?.toString() ?? "");
  const [height, setHeight] = useState(height_cm?.toString() ?? "");
  const [ageVal, setAge] = useState(age?.toString() ?? "");
  const [sex, setSex] = useState<"homme" | "femme">(gender ?? "femme");
  const [nap, setNap] = useState("1.55");
  const [phase, setPhase] = useState<"1" | "2" | "3">("1");
  const [feculent, setFeculent] = useState("riz");


  const [mb, setMb] = useState<number | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);
  const [targetKcal, setTargetKcal] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fMidiCru, setFMidiCru] = useState("");
  const [fSoirCru, setFSoirCru] = useState("");
  const [painG, setPainG] = useState("");
  const [calculated, setCalculated] = useState(false);


  useEffect(() => {
    setCalculated(false);
  }, [weight, height, ageVal, sex, nap, phase, feculent]);


  function handleCalculate() {
    const w = parseFloat(weight.replace(",", "."));
    const h = parseFloat(height.replace(",", "."));
    const a = parseFloat(ageVal.replace(",", "."));
    if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(a)) return;


    const deficit = PHASE_OPTIONS.find((p) => p.value === phase)!.deficit;
    const napVal = parseFloat(nap);
    const mbVal = calcMB(w, h, a, sex) / 10;
    const tdeeVal = Math.round((mbVal * napVal) / 4.185);
    const kcal = tdeeVal - deficit;


    const proteinKcal = kcal * 0.2;
    const fatKcal = kcal * 0.2;
    const carbsKcal = kcal * 0.6;


    const prot = Math.round(proteinKcal / 4);
    const fat = Math.round(fatKcal / 9);
    const carbs = Math.max(0, Math.round(carbsKcal / 4));


    const fecMidi = phase === "1" ? 80 : phase === "2" ? 50 : 0;
    const fecSoir = phase === "1" ? 40 : phase === "2" ? 25 : 0;
    const pain = sex === "femme" ? 30 : 50;


    setMb(mbVal);
    setTdee(tdeeVal);
    setTargetKcal(kcal.toString());
    setProteinG(prot.toString());
    setFatG(fat.toString());
    setCarbsG(carbs.toString());
    setFMidiCru(fecMidi.toString());
    setFSoirCru(fecSoir.toString());
    setPainG(pain.toString());
    setCalculated(true);
  }


  function handleValidate() {
    if (!calculated) return;


    onValidate({
      mb: mb!,
      tdee: tdee!,
      target_kcal: parseInt(targetKcal, 10),
      protein_g: parseInt(proteinG, 10),
      fat_g: parseInt(fatG, 10),
      carbs_g: parseInt(carbsG, 10),
      feculent_midi_cru_g: parseInt(fMidiCru, 10),
      feculent_soir_cru_g: parseInt(fSoirCru, 10),
      feculent_matin_pain_g: parseInt(painG, 10),
      phase: parseInt(phase, 10) as 1 | 2 | 3,
    });
  }


  const fecSelected = FECULENT_OPTIONS.find((f) => f.value === feculent)!;


  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          🧮 Calculateur de macros — Méthode Black & al.
        </CardTitle>
      </CardHeader>


      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Données patient
          </p>


          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Poids (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>


            <div className="space-y-1">
              <Label>Taille (cm) *</Label>
              <Input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>


            <div className="space-y-1">
              <Label>Âge *</Label>
              <Input
                type="number"
                value={ageVal}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>


            <div className="space-y-1">
              <Label>Sexe *</Label>
              <Select
                value={sex}
                onValueChange={(v) => setSex(v as "homme" | "femme")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="femme">Femme</SelectItem>
                  <SelectItem value="homme">Homme</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>


        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Paramètres
          </p>


          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Niveau d'activité (NAP)</Label>
              <Select value={nap} onValueChange={setNap}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NAP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-1">
              <Label>Phase de déficit</Label>
              <Select
                value={phase}
                onValueChange={(v) => setPhase(v as "1" | "2" | "3")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-1">
              <Label>Féculent principal</Label>
              <Select value={feculent} onValueChange={setFeculent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FECULENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>


        <Button onClick={handleCalculate} className="w-full">
          ⚡ Calculer les macros
        </Button>


        {calculated && (
          <>
            <Separator />


            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Métabolisme de base</p>
                <p className="text-lg font-bold text-primary">
                  {mb} <span className="text-xs font-normal">MJ</span>
                </p>
              </div>


              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">TDEE (dépense totale)</p>
                <p className="text-lg font-bold">
                  {tdee} <span className="text-xs font-normal">kcal</span>
                </p>
              </div>


              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Objectif calorique</p>
                <p className="text-lg font-bold text-green-600">
                  {targetKcal} <span className="text-xs font-normal">kcal</span>
                </p>
              </div>
            </div>


            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Macros journaliers — modifiables
            </p>


            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>🎯 Kcal cible</Label>
                <Input
                  type="number"
                  value={targetKcal}
                  onChange={(e) => setTargetKcal(e.target.value)}
                />
              </div>


              <div className="space-y-1">
                <Label>🥩 Protéines (g)</Label>
                <Input
                  type="number"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {proteinG ? Math.round((+proteinG / +weight) * 10) / 10 : "—"} g/kg
                </p>
              </div>


              <div className="space-y-1">
                <Label>🫒 Lipides (g)</Label>
                <Input
                  type="number"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">20% des kcal</p>
              </div>


              <div className="space-y-1">
                <Label>🌾 Glucides (g)</Label>
                <Input
                  type="number"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                />
              </div>
            </div>


            <Separator />


            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Féculents par repas ({fecSelected.label} — cru × 2 = cuit)
            </p>


            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>🌅 Matin — Pain céréales</Label>
                <Input
                  type="number"
                  value={painG}
                  onChange={(e) => setPainG(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{painG}g cru</p>
              </div>


              <div className="space-y-1">
                <Label>☀️ Midi — {fecSelected.label}</Label>
                <Input
                  type="number"
                  value={fMidiCru}
                  onChange={(e) => setFMidiCru(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {fMidiCru}g cru → {fMidiCru ? +fMidiCru * 2 : 0}g cuit
                  {fMidiCru ? ` · ${Math.round((+fMidiCru * fecSelected.kcal) / 100)} kcal` : ""}
                </p>
              </div>


              <div className="space-y-1">
                <Label>🌙 Soir — {fecSelected.label}</Label>
                <Input
                  type="number"
                  value={fSoirCru}
                  onChange={(e) => setFSoirCru(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {fSoirCru}g cru → {fSoirCru ? +fSoirCru * 2 : 0}g cuit
                  {fSoirCru ? ` · ${Math.round((+fSoirCru * fecSelected.kcal) / 100)} kcal` : ""}
                </p>
              </div>
            </div>


            <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
              <p className="font-semibold">📋 Résumé du plan alimentaire</p>
              <p>🌅 <strong>Matin :</strong> {painG}g pain céréales + protéine (yaourt/œuf) + 10g lipides crus</p>
              <p>
                ☀️ <strong>Midi :</strong> Protéines + légumes à volonté +{" "}
                {fMidiCru ? `${fMidiCru}g cru (${+fMidiCru * 2}g cuit)` : "sans féculent"}{" "}
                {fecSelected.label} + 10g lipides crus
              </p>
              <p>
                🌙 <strong>Soir :</strong> Protéines + légumes à volonté +{" "}
                {fSoirCru ? `${fSoirCru}g cru (${+fSoirCru * 2}g cuit)` : "sans féculent"}{" "}
                {fecSelected.label} + 10g lipides crus
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                💧 Lipides : huile d'olive ou colza de préférence — jamais chauffés
              </p>
            </div>


            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <p className="font-semibold text-primary mb-1">⚖️ Bilan calorique estimé</p>
              <p>Protéines : {proteinG}g × 4 = <strong>{+proteinG * 4} kcal</strong></p>
              <p>Lipides : {fatG}g × 9 = <strong>{+fatG * 9} kcal</strong></p>
              <p>Glucides : {carbsG}g × 4 = <strong>{+carbsG * 4} kcal</strong></p>

              <div className="font-bold mt-1 flex items-center gap-2">
                <span>Total : {+proteinG * 4 + +fatG * 9 + +carbsG * 4} kcal</span>
                <Badge variant="outline" className="text-xs">
                  Objectif : {targetKcal} kcal
                </Badge>
              </div>
            </div>


            <Button onClick={handleValidate} className="w-full" size="lg">
              ✅ Valider et enregistrer ce programme
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}