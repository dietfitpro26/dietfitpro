import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, Loader2 } from "lucide-react";

export const CHARTER_RULES: { title: string; text: string }[] = [
  {
    title: "Bienveillance et respect",
    text: "Pas d'insultes, de moqueries, de harcèlement ni de discrimination. Chacun avance à son rythme.",
  },
  {
    title: "Aucun jugement sur le corps",
    text: "Ne commentez jamais le poids, le corps ou les progrès des autres de façon négative. Encouragez.",
  },
  {
    title: "Pas de conseil médical",
    text: "Ne conseillez ni régime, ni médicament, ni complément à d'autres membres. Pour toute question de santé, parlez-en à votre professionnel.",
  },
  {
    title: "Confidentialité",
    text: "Ne partagez pas d'informations médicales personnelles, ni celles des autres. Ce qui se dit dans un groupe reste dans le groupe.",
  },
  {
    title: "Pas de publicité ni de spam",
    text: "Pas de vente, de promotion, de liens commerciaux ni de messages répétés.",
  },
  {
    title: "Contenus appropriés",
    text: "Pas de contenu choquant ou illégal, ni de promotion de pratiques dangereuses (jeûne extrême, restrictions sévères, etc.).",
  },
  {
    title: "Modération",
    text: "Le coach peut supprimer un contenu, retirer un membre d'un groupe ou l'exclure de la communauté en cas de non-respect de cette charte.",
  },
];

export function CharterCard({
  userId,
  onAccepted,
}: {
  userId: string;
  onAccepted: () => Promise<void> | void;
}) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleAccept = async () => {
    setBusy(true);
    setMsg(null);

    const { error } = await supabase
      .from("community_charter_acceptances")
      .upsert({ user_id: userId, version: 1 }, { onConflict: "user_id" });

    if (error) {
      setMsg("Impossible d'enregistrer votre acceptation. Réessayez.");
      setBusy(false);
      return;
    }

    await onAccepted();
    setBusy(false);
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Charte de la communauté
        </h2>
        <p className="text-sm text-muted-foreground">
          Les groupes servent à s'entraider chaque jour pour rester motivé et atteindre ses objectifs.
          Pour que cet espace reste bienveillant, merci de lire et d'accepter cette charte.
        </p>
      </div>

      <ol className="space-y-3">
        {CHARTER_RULES.map((rule, index) => (
          <li key={rule.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium">{rule.title}</p>
              <p className="text-sm text-muted-foreground">{rule.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>J'ai lu la charte et je m'engage à la respecter.</span>
      </label>

      <button
        onClick={() => void handleAccept()}
        disabled={!checked || busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Accepter la charte
      </button>

      {msg && <p className="text-sm text-red-500">{msg}</p>}
    </div>
  );
}