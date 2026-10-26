import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Ban, Loader2, Send, Clock, CheckCircle2, XCircle } from "lucide-react";

type Sanction = {
  kind: "community" | "group";
  group_id: string | null;
  group_name: string | null;
  scope: "all" | "groups" | "group";
  reason: string | null;
  banned_by_pro: boolean;
  created_at: string;
  appeal_id: string | null;
  appeal_status: "pending" | "accepted" | "refused" | null;
  appeal_message: string | null;
  appeal_response: string | null;
};

function sanctionTitle(s: Sanction) {
  if (s.kind === "group") return `Vous avez été banni(e) du groupe « ${s.group_name ?? ""} »`;
  if (s.scope === "groups") return "Vous avez été banni(e) de tous les groupes";
  return "Vous avez été banni(e) de la communauté";
}

function recipientLabel(s: Sanction) {
  return s.kind === "group" && !s.banned_by_pro ? "au propriétaire du groupe" : "au coach";
}

function SanctionCard({ s, onChanged }: { s: Sanction; onChanged: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSend = async () => {
    const message = text.trim();
    if (!message) return;
    setBusy(true);
    setMsg(null);

    const { error } = await supabase.rpc("submit_appeal", {
      p_group: s.kind === "group" ? s.group_id : null,
      p_message: message,
    });

    if (error) {
      setMsg(
        error.message.includes("already_sent")
          ? "Vous avez déjà envoyé un message pour ce bannissement."
          : "Impossible d'envoyer le message pour le moment.",
      );
    } else {
      setText("");
      await onChanged();
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3 dark:bg-red-900/20 dark:border-red-900/40">
      <div className="flex items-start gap-2">
        <Ban className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{sanctionTitle(s)}</p>
          <p className="text-sm text-red-700/90 dark:text-red-300/90">
            Une règle de la charte de respect n'a pas été respectée.
            {s.reason ? ` Motif : ${s.reason}.` : ""}
          </p>
        </div>
      </div>

      {s.appeal_id ? (
        <div className="rounded-lg bg-background/80 p-3 space-y-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Votre message</p>
          <p className="whitespace-pre-line">{s.appeal_message}</p>

          {s.appeal_status === "pending" && (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> En attente de réponse
            </p>
          )}
          {s.appeal_status === "accepted" && (
            <p className="inline-flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Demande acceptée
            </p>
          )}
          {s.appeal_status === "refused" && (
            <p className="inline-flex items-center gap-1.5 text-xs text-red-600">
              <XCircle className="h-3.5 w-3.5" /> Demande refusée
            </p>
          )}

          {s.appeal_response && (
            <div className="border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">Réponse</p>
              <p className="whitespace-pre-line">{s.appeal_response}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-red-700/90 dark:text-red-300/90">
            Vous pensez qu'il y a une erreur ? Expliquez-vous {recipientLabel(s)} pour demander votre réintégration.
          </p>
          <textarea
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            rows={3}
            maxLength={1000}
            placeholder="Votre message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{text.length}/1000 · un seul message possible</span>
            <button
              onClick={() => void handleSend()}
              disabled={busy || !text.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer
            </button>
          </div>
          {msg && <p className="text-xs text-red-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}

export function SanctionsNotice() {
  const [items, setItems] = useState<Sanction[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_sanctions");
    setItems((data ?? []) as Sanction[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <SanctionCard key={`${s.kind}-${s.group_id ?? "all"}`} s={s} onChanged={load} />
      ))}
    </div>
  );
}