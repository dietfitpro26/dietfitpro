import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export type MetricKey =
  | "weight_kg" | "bmi" | "body_fat_pct"
  | "muscle_mass_kg" | "water_pct" | "metabolic_age"
  | "bone_mass_kg" | "visceral_fat";

export const METRICS_CONFIG: Record<MetricKey, { label: string; color: string; unit: string }> = {
  weight_kg:      { label: "Poids",            color: "#01696f", unit: "kg"  },
  bmi:            { label: "IMC",               color: "#006494", unit: ""    },
  body_fat_pct:   { label: "Masse grasse",      color: "#da7101", unit: "%"   },
  muscle_mass_kg: { label: "Masse musculaire",  color: "#437a22", unit: "kg"  },
  water_pct:      { label: "Masse hydrique",    color: "#4f98a3", unit: "%"   },
  metabolic_age:  { label: "Âge métabolique",   color: "#a86fdf", unit: "ans" },
  bone_mass_kg:   { label: "Masse osseuse",     color: "#d19900", unit: "kg"  },
  visceral_fat:   { label: "Graisse viscérale", color: "#a12c7b", unit: ""    },
};

export interface BodyDataPoint {
  measured_at: string;
  weight_kg?:      number | null;
  bmi?:            number | null;
  body_fat_pct?:   number | null;
  muscle_mass_kg?: number | null;
  water_pct?:      number | null;
  metabolic_age?:  number | null;
  bone_mass_kg?:   number | null;
  visceral_fat?:   number | null;
  height_cm?:      number | null;
}

function enrichData(data: BodyDataPoint[]): BodyDataPoint[] {
  return data.map((d) => ({
    ...d,
    bmi:
      d.bmi ??
      (d.weight_kg && d.height_cm && d.height_cm > 0
        ? Math.round((d.weight_kg / Math.pow(d.height_cm / 100, 2)) * 10) / 10
        : null),
  }));
}

interface Props {
  data: BodyDataPoint[];
  availableMetrics?: MetricKey[];
}

export function BodyMetricsChart({
  data,
  availableMetrics = ["weight_kg", "bmi", "body_fat_pct", "muscle_mass_kg", "water_pct", "metabolic_age"],
}: Props) {
  const [selected, setSelected] = useState<MetricKey>(availableMetrics[0]);

  const enriched = enrichData(data).map((d) => ({
    ...d,
    date: format(new Date(d.measured_at), "dd MMM yy", { locale: fr }),
  }));

  const cfg = METRICS_CONFIG[selected];

  // Calcul min/max pour afficher la variation
  const values = enriched
    .map((d) => d[selected] as number | null | undefined)
    .filter((v): v is number => v != null);
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const diff = min != null && max != null ? (values[values.length - 1] - values[0]) : null;

  if (enriched.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <p className="font-medium">Aucune donnée à afficher</p>
        <p className="text-sm mt-1">Ajoutez votre première mesure ci-dessus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Sélecteur de métrique */}
      <div className="flex flex-wrap gap-2">
        {availableMetrics.map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selected === key
                ? "text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={selected === key ? { backgroundColor: METRICS_CONFIG[key].color } : {}}
          >
            {METRICS_CONFIG[key].label}
          </button>
        ))}
      </div>

      {/* Stats rapides */}
      {values.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Actuel</p>
            <p className="text-lg font-bold" style={{ color: cfg.color }}>
              {values[values.length - 1]} <span className="text-xs font-normal">{cfg.unit}</span>
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Min</p>
            <p className="text-lg font-bold">{min} <span className="text-xs font-normal">{cfg.unit}</span></p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Évolution</p>
            <p className={`text-lg font-bold ${diff === null ? "" : diff < 0 ? "text-green-600" : diff > 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} ${cfg.unit}`}
            </p>
          </div>
        </div>
      )}

      {/* Graphique */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={enriched} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}${cfg.unit}`}
          />
          <Tooltip
            formatter={(value: number) => [`${value} ${cfg.unit}`, cfg.label]}
            labelStyle={{ fontWeight: 600 }}
          />
          {min != null && (
            <ReferenceLine y={min} stroke={cfg.color} strokeDasharray="4 4" opacity={0.4} />
          )}
          <Line
            type="monotone"
            dataKey={selected}
            name={cfg.label}
            stroke={cfg.color}
            strokeWidth={2.5}
            dot={{ r: 5, fill: cfg.color }}
            activeDot={{ r: 8 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}