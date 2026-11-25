import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Feature = { feature_key: string; release_channel: string; globally_enabled: boolean };
type HistoryEvent = { event_id: string; feature_key: string; action: string; starts_at: string; expires_at: string | null; reason: string; changed_by: string; created_at: string };

const label: Record<string, string> = {
  access_messaging: "Messagerie coach",
  access_premium_content: "Contenu Premium",
  sport_sessions_unlimited: "Séances sport sans limite",
};

export function FeatureEntitlementsPanel() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [userId, setUserId] = useState("");
  const [featureKey, setFeatureKey] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [expiresAt, setExpiresAt] = useState("");
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadHistory(id = userId) {
    if (!id) { setHistory([]); return; }
    const { data, error } = await supabase.rpc("get_user_feature_history", { p_user_id: id });
    if (error) throw error;
    setHistory((data ?? []) as HistoryEvent[]);
  }

  useEffect(() => {
    void supabase.rpc("list_feature_catalog").then(({ data, error }) => {
      if (error) { setMessage("Catalogue indisponible : seuls les administrateurs peuvent y accéder."); return; }
      const rows = (data ?? []) as Feature[];
      setFeatures(rows);
      setFeatureKey(rows.find((item) => item.release_channel === "v1" && item.globally_enabled && label[item.feature_key])?.feature_key ?? "");
    });
  }, []);

  async function submit(action: "grant" | "revoke") {
    const id = userId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      setMessage("Saisissez l’UUID Supabase Auth du compte abonné Basic."); return;
    }
    setBusy(true); setMessage("");
    const { error } = action === "grant"
      ? await supabase.rpc("grant_user_feature", { p_user_id: id, p_feature_key: featureKey, p_reason: reason.trim(), p_starts_at: new Date(startsAt).toISOString(), p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null })
      : await supabase.rpc("revoke_user_feature", { p_user_id: id, p_feature_key: featureKey, p_reason: reason.trim() });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage(action === "grant" ? "Option attribuée et journalisée." : "Option révoquée et journalisée.");
    await loadHistory(id);
  }

  const choices = features.filter((item) => item.release_channel === "v1" && item.globally_enabled && label[item.feature_key]);
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <div><h2 className="font-semibold">Options individuelles Premium</h2><p className="text-sm text-muted-foreground">Pour un abonné Basic uniquement. La base vérifie l’identité administrateur, le compte cible et l’option autorisée.</p></div>
    <label className="block text-sm">UUID du compte abonné Basic<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)} /></label>
    <label className="block text-sm">Option V1<select className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={featureKey} onChange={(e) => setFeatureKey(e.target.value)}>{choices.map((item) => <option key={item.feature_key} value={item.feature_key}>{label[item.feature_key]}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Début<input type="datetime-local" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label><label className="text-sm">Expiration facultative<input type="datetime-local" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label></div>
    <label className="block text-sm">Motif (obligatoire)<textarea className="mt-1 w-full rounded-md border bg-background px-3 py-2" minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    <div className="flex gap-2"><button className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || !featureKey || reason.trim().length < 3} onClick={() => void submit("grant")}>Attribuer</button><button className="rounded-md border px-3 py-2 disabled:opacity-50" disabled={busy || !featureKey || reason.trim().length < 3} onClick={() => void submit("revoke")}>Révoquer</button><button className="rounded-md border px-3 py-2" onClick={() => void loadHistory().catch((e: Error) => setMessage(e.message))}>Actualiser l’historique</button></div>
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <ol className="space-y-2 text-sm">{history.map((event) => <li key={event.event_id} className="rounded-md border p-3"><strong>{label[event.feature_key] ?? event.feature_key}</strong> — {event.action === "grant" ? "attribuée" : "révoquée"}; par <code>{event.changed_by}</code>; début {new Date(event.starts_at).toLocaleString("fr-FR")}; expiration {event.expires_at ? new Date(event.expires_at).toLocaleString("fr-FR") : "aucune"}; motif : {event.reason}</li>)}</ol>
    <p className="text-xs text-muted-foreground">Coach IA, recettes et visioconférence restent des modules V2 et ne peuvent pas être activés ici.</p>
  </section>;
}
