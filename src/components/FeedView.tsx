import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { FeedAttachment } from "@/components/FeedAttachment";
import { getFeedStoragePath } from "@/lib/feedStorage";
import { Heart, Bookmark, MessageCircle, Send, Share2, Flag, Trash2, Lock, Check, Users, Paperclip, X, Loader2, FileText, Lightbulb, ChefHat, Trophy, Video } from "lucide-react";

type FeedType = "article" | "tip" | "recipe" | "challenge" | "video";
type FeedFilter = "all" | "community" | FeedType;
type FeedPost = {
  id: string; author_id: string | null; group_id: string | null;
  source: "coach" | "member"; type: FeedType; title: string;
  body: string | null; image_url: string | null; video_url: string | null;
  tags: string[] | null; published_at: string | null; created_at: string;
};
type FeedComment = { id: string; content_id: string; user_id: string; body: string; created_at: string };
type Interaction = { liked: boolean; saved: boolean };
const TYPES: Record<FeedType, { label: string; icon: ReactNode }> = {
  article: { label: "Article", icon: <FileText className="h-3 w-3" /> },
  tip: { label: "Conseil", icon: <Lightbulb className="h-3 w-3" /> },
  recipe: { label: "Recette", icon: <ChefHat className="h-3 w-3" /> },
  challenge: { label: "Défi", icon: <Trophy className="h-3 w-3" /> },
  video: { label: "Vidéo", icon: <Video className="h-3 w-3" /> },
};
const BADGES: Record<string, string> = { coach: "Coach", premium: "Premium", basic: "Basic", patient: "Patient" };
const INPUT = "w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm";
const ACTION = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50 hover:bg-muted";
const PRIMARY = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50";

export function TierBadge({ badge }: { badge?: string }) {
  if (!badge || !BADGES[badge]) return null;
  return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{BADGES[badge]}</span>;
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function PseudoForm({ userId, intro, onDone }: { userId: string; intro: string; onDone: () => Promise<void> | void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    const pseudo = text.trim();
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(pseudo)) { setError("Pseudo : 3 à 20 lettres, chiffres, points, tirets ou underscores."); return; }
    setBusy(true); setError(null);
    try {
      const { error: e } = await supabase.from("community_profiles").insert({ user_id: userId, pseudo });
      if (e) { setError(e.code === "23505" ? "Ce pseudo est déjà pris." : "Enregistrement impossible."); return; }
      await onDone();
    } catch { setError("Enregistrement impossible. Réessayez."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 rounded-lg border p-3">
    <p className="text-xs text-muted-foreground">{intro}</p>
    <div className="flex gap-2"><input aria-label="Pseudo" className={INPUT} value={text} maxLength={20} onChange={e => setText(e.target.value)} placeholder="Mon pseudo" />
      <button type="button" className={PRIMARY} disabled={busy || !text.trim()} onClick={() => void submit()}>Valider</button></div>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
function Composer({ userId, pseudo, allowed, groupId, onChanged }: { userId: string; pseudo: string | null; allowed: boolean; groupId?: string; onChanged: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const clearFile = () => { setFile(null); if (input.current) input.current.value = ""; };
  const publish = async () => {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true); setError(null);
    let path: string | null = null;
    let inserted = false;
    try {
      let imageUrl: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        if (!["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(ext) || file.size > 5 * 1024 * 1024) throw new Error("invalid_file");
        const candidate = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("feed").upload(candidate, file, { upsert: false });
        if (uploadError) throw uploadError;
        path = candidate;
        // Référence stable conservée pour compatibilité avec les règles actuelles.
        imageUrl = supabase.storage.from("feed").getPublicUrl(candidate).data.publicUrl;
      }
      const body = text.trim();
      const { error: insertError } = await supabase.from("feed_content").insert({
        author_id: userId, source: "member", group_id: groupId ?? null,
        title: body.slice(0, 60) || (file?.name.toLowerCase().endsWith(".pdf") ? "Document PDF" : "Photo"),
        body: body || null, image_url: imageUrl, is_published: true, published_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      inserted = true; setText(""); clearFile(); await onChanged();
    } catch {
      if (path && !inserted) await supabase.storage.from("feed").remove([path]);
      setError(inserted ? "Publication enregistrée, mais actualisation impossible. Rechargez la page." : "Publication impossible. Vérifiez le fichier et vos droits, puis réessayez.");
    } finally { setBusy(false); }
  };
  if (!allowed) return <div className="flex gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground"><Lock className="h-4 w-4 shrink-0" />Publication indisponible avec vos droits actuels. La participation est réservée aux membres Premium autorisés.</div>;
  if (!pseudo) return <PseudoForm userId={userId} intro="Choisissez un pseudo pour publier et commenter. N'utilisez pas votre nom réel." onDone={onChanged} />;
  return <div className="space-y-3 rounded-xl border bg-card p-4">
    <p className="text-xs text-muted-foreground">Vous publiez en tant que <strong>{pseudo}</strong>{groupId ? " dans ce groupe" : ""}</p>
    <textarea aria-label="Votre publication" className={INPUT} rows={3} maxLength={1000} value={text} disabled={busy} onChange={e => setText(e.target.value)} placeholder="Partagez un encouragement, une victoire, une astuce…" />
    <input ref={input} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf" onChange={e => {
      const selected = e.target.files?.[0]; if (!selected) return;
      const ext = (selected.name.split(".").pop() ?? "").toLowerCase();
      if (!["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(ext) || selected.size > 5 * 1024 * 1024) {
        setError("Utilisez une photo JPG, PNG, WEBP, GIF ou un PDF, de 5 Mo maximum."); clearFile(); return;
      }
      setError(null); setFile(selected);
    }} />
    {file && <div className="space-y-2 rounded-lg bg-muted/40 p-2">
      {preview && <img src={preview} alt="Aperçu du fichier sélectionné" className="max-h-64 w-full rounded-lg object-contain" />}
      <div className="flex items-center justify-between gap-2"><span className="truncate text-xs">{file.name}</span><button type="button" className={ACTION} disabled={busy} onClick={clearFile}><X className="h-4 w-4" />Retirer</button></div>
    </div>}
    <p className="text-xs text-muted-foreground">Ne partagez pas d'informations médicales personnelles, d'analyses ni d'ordonnances. Le stockage est en cours de sécurisation : les fichiers restent actuellement accessibles par leur lien public.</p>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className={ACTION} disabled={busy} onClick={() => input.current?.click()}><Paperclip className="h-4 w-4" />Photo ou PDF (5 Mo max)</button>
      <span className="text-xs text-muted-foreground">{text.length}/1000</span>
      <button type="button" className={PRIMARY} disabled={busy || (!text.trim() && !file)} onClick={() => void publish()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publier</button>
    </div>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
function PostCard({ post, userId, initial, likeCount, comments, pseudos, badges, allowed, onChanged }: {
  post: FeedPost; userId: string; initial: Interaction; likeCount: number; comments: FeedComment[];
  pseudos: Record<string, string>; badges: Record<string, string>; allowed: boolean; onChanged: () => Promise<void>;
}) {
  const [liked, setLiked] = useState(initial.liked);
  const [saved, setSaved] = useState(initial.saved);
  const [count, setCount] = useState(likeCount);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setLiked(initial.liked); setSaved(initial.saved); setCount(likeCount); }, [initial.liked, initial.saved, likeCount]);
  const memberPost = post.source === "member";
  const mine = post.author_id === userId;
  const act = async (operation: () => Promise<void>) => {
    if (busy) return; setBusy(true); setMessage(null);
    try { await operation(); } catch { setMessage("Action impossible pour le moment. Réessayez."); }
    finally { setBusy(false); }
  };
  const interaction = async (field: "liked" | "saved") => {
    const nextLiked = field === "liked" ? !liked : liked;
    const nextSaved = field === "saved" ? !saved : saved;
    const { error } = await supabase.from("feed_interactions").upsert({ user_id: userId, content_id: post.id, liked: nextLiked, saved: nextSaved }, { onConflict: "user_id,content_id" });
    if (error) throw error;
    if (field === "liked") setCount(c => Math.max(0, c + (nextLiked ? 1 : -1)));
    setLiked(nextLiked); setSaved(nextSaved);
  };
  const report = async (kind: "comment" | "post", id: string) => {
    if (!confirm("Signaler ce contenu au coach ?")) return;
    const { error } = await supabase.from("feed_reports").insert({ reporter_id: userId, target_type: kind, target_id: id });
    if (error?.code === "23505") { setMessage("Vous avez déjà signalé ce contenu."); return; }
    if (error) throw error;
    setMessage("Merci, votre signalement a été envoyé.");
  };
  const removeComment = async (id: string) => {
    if (!confirm("Supprimer votre commentaire ?")) return;
    const { error } = await supabase.from("feed_comments").delete().eq("id", id);
    if (error) throw error; await onChanged();
  };
  const removePost = async () => {
    if (!confirm("Supprimer votre publication ?")) return;
    const { error } = await supabase.from("feed_content").delete().eq("id", post.id);
    if (error) throw error;
    const path = getFeedStoragePath(post.image_url);
    if (path) {
      const { error: fileError } = await supabase.storage.from("feed").remove([path]);
      if (fileError) console.error("[Feed] Nettoyage du fichier impossible", fileError.message);
    }
    await onChanged();
  };
  const comment = async () => {
    if (!text.trim()) return;
    const { error } = await supabase.from("feed_comments").insert({ content_id: post.id, user_id: userId, body: text.trim() });
    if (error) throw error; setText(""); await onChanged();
  };
  const share = async () => {
    const base = post.group_id ? `/groups/${post.group_id}` : "/feed";
    const url = `${window.location.origin}${base}?post=${post.id}`;
    if (typeof window.navigator.share === "function") {
      try { await window.navigator.share({ title: post.title, url }); }
      catch (e) { if (!(e instanceof Error && e.name === "AbortError")) throw e; }
      return;
    }
    await window.navigator.clipboard.writeText(url); setCopied(true);
  };
  return <article id={`post-${post.id}`} className="scroll-mt-20 overflow-hidden rounded-xl border bg-card">
    <FeedAttachment reference={post.image_url} alt={memberPost ? "Photo partagée" : post.title} imageClassName="w-full max-h-96 object-contain" />
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-2 text-xs font-medium">
          {memberPost ? <><Users className="h-3 w-3" />{post.group_id ? "" : "Communauté · "}{post.author_id ? pseudos[post.author_id] ?? "Membre" : "Membre"}<TierBadge badge={post.author_id ? badges[post.author_id] : undefined} /></> : <>{TYPES[post.type]?.icon}{TYPES[post.type]?.label ?? "Publication"}</>}
        </span><span className="text-xs text-muted-foreground">{dateLabel(post.published_at ?? post.created_at)}</span>
      </div>
      {!memberPost && <h3 className="font-semibold">{post.title}</h3>}
      {post.body && <p className="whitespace-pre-line break-words text-sm">{post.body}</p>}
      <FeedAttachment reference={post.video_url} kind="video" />
      {!!post.tags?.length && <div className="flex flex-wrap gap-1">{post.tags.map(tag => <span key={tag} className="rounded-full bg-muted px-2 py-1 text-xs">#{tag}</span>)}</div>}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <button type="button" className={`${ACTION} ${liked ? "text-red-500" : ""}`} aria-pressed={liked} disabled={busy} onClick={() => void act(() => interaction("liked"))}><Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{count || "J'aime"}</button>
        <button type="button" className={ACTION} onClick={() => setExpanded(v => !v)} aria-expanded={expanded}><MessageCircle className="h-4 w-4" />Commentaires ({comments.length})</button>
        <button type="button" className={ACTION} disabled={busy} onClick={() => void act(share)}>{copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}{copied ? "Lien copié" : "Partager"}</button>
        {memberPost && <button type="button" className={ACTION} disabled={busy} onClick={() => void act(mine ? removePost : () => report("post", post.id))}>{mine ? <Trash2 className="h-4 w-4" /> : <Flag className="h-4 w-4" />}{mine ? "Supprimer" : "Signaler"}</button>}
        <button type="button" className={ACTION} disabled={busy} aria-pressed={saved} onClick={() => void act(() => interaction("saved"))}><Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />{saved ? "Enregistré" : "Enregistrer"}</button>
      </div>
      {expanded && <div className="space-y-3">
        {!comments.length && <p className="text-xs text-muted-foreground">Aucun commentaire pour le moment.</p>}
        {comments.map(c => <div key={c.id} className="space-y-2 rounded-lg bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex flex-wrap items-center gap-2 text-xs">{pseudos[c.user_id] ?? "Membre"}<TierBadge badge={badges[c.user_id]} />{dateLabel(c.created_at)}</span>
            <button type="button" className={ACTION} disabled={busy} onClick={() => void act(c.user_id === userId ? () => removeComment(c.id) : () => report("comment", c.id))}>{c.user_id === userId ? "Supprimer" : "Signaler"}</button></div>
          <p className="whitespace-pre-line break-words text-sm">{c.body}</p>
        </div>)}
        {!allowed ? <p className="text-xs text-muted-foreground">Commentaires indisponibles avec vos droits actuels.</p> : !pseudos[userId] ? <PseudoForm userId={userId} intro="Choisissez un pseudo pour commenter." onDone={onChanged} /> : <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Vous commentez en tant que {pseudos[userId]}</p>
          <textarea aria-label="Votre commentaire" className={INPUT} maxLength={1000} rows={2} value={text} onChange={e => setText(e.target.value)} />
          <button type="button" className={PRIMARY} disabled={busy || !text.trim()} onClick={() => void act(comment)}><Send className="h-4 w-4" />Envoyer</button>
        </div>}
      </div>}
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    </div>
  </article>;
}
export function FeedView({ userId, groupId }: { userId: string; groupId?: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [interactions, setInteractions] = useState<Record<string, Interaction>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [pseudos, setPseudos] = useState<Record<string, string>>({});
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const base = supabase.from("feed_content").select("id,author_id,group_id,source,type,title,body,image_url,video_url,tags,published_at,created_at").eq("is_published", true);
      const query = groupId ? base.eq("group_id", groupId) : base.is("group_id", null);
      const [p, i, n, rights] = await Promise.all([
        query.order("published_at", { ascending: false }),
        supabase.from("feed_interactions").select("content_id,liked,saved").eq("user_id", userId),
        supabase.rpc("feed_like_counts"),
        supabase.rpc("can_participate_in_community", { p_user: userId }),
      ]);
      for (const result of [p, i, n, rights]) if (result.error) throw result.error;
      const rows = (p.data ?? []) as FeedPost[];
      let commentRows: FeedComment[] = [];
      if (rows.length) {
        const c = await supabase.from("feed_comments").select("id,content_id,user_id,body,created_at").in("content_id", rows.map(row => row.id)).order("created_at", { ascending: true });
        if (c.error) throw c.error;
        commentRows = (c.data ?? []) as FeedComment[];
      }
      const ids = Array.from(new Set([userId, ...rows.flatMap(row => row.author_id ? [row.author_id] : []), ...commentRows.map(row => row.user_id)]));
      const [ps, bs] = await Promise.all([
        supabase.from("community_profiles").select("user_id,pseudo").in("user_id", ids),
        supabase.rpc("community_badges", { p_users: ids }),
      ]);
      if (ps.error) throw ps.error; if (bs.error) throw bs.error;
      if (request !== generation.current) return;
      const im: Record<string, Interaction> = {};
      ((i.data ?? []) as { content_id: string; liked: boolean; saved: boolean }[]).forEach(row => { im[row.content_id] = { liked: !!row.liked, saved: !!row.saved }; });
      const nm: Record<string, number> = {};
      ((n.data ?? []) as { content_id: string; likes: number }[]).forEach(row => { nm[row.content_id] = Number(row.likes); });
      const pm: Record<string, string> = {};
      ((ps.data ?? []) as { user_id: string; pseudo: string }[]).forEach(row => { pm[row.user_id] = row.pseudo; });
      const bm: Record<string, string> = {};
      ((bs.data ?? []) as { user_id: string; badge: string }[]).forEach(row => { bm[row.user_id] = row.badge; });
      setPosts(rows); setComments(commentRows); setInteractions(im); setCounts(nm); setPseudos(pm); setBadges(bm); setAllowed(rights.data === true); setError(null);
    } catch {
      if (request === generation.current) { setAllowed(false); setError("Impossible de charger le fil. Rechargez-le pour réessayer."); }
    } finally { if (request === generation.current) setLoading(false); }
  }, [userId, groupId]);
  useEffect(() => {
    setLoading(true); setPosts([]); setComments([]); setAllowed(false); setFilter("all"); void load();
    return () => { generation.current += 1; };
  }, [load]);
  useEffect(() => {
    if (loading) return;
    const id = new URLSearchParams(window.location.search).get("post");
    if (id) document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, posts]);
  const visible = groupId || filter === "all" ? posts : filter === "community" ? posts.filter(p => p.source === "member") : posts.filter(p => p.source === "coach" && p.type === filter);
  return <div className="mx-auto max-w-2xl space-y-5 p-4">
    {!groupId && <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">Feed</h1>{allowed && <Link to="/groups" className={ACTION}><Users className="h-4 w-4" />Mes groupes</Link>}<span className="text-xs text-muted-foreground">{posts.length} publication{posts.length > 1 ? "s" : ""}</span></div>}
    {error && <div role="alert" className="space-y-2 rounded-lg border p-3"><p className="text-sm text-red-600">{error}</p><button type="button" className={ACTION} onClick={() => void load()}>Recharger</button></div>}
    {!loading && !error && <Composer key={`${userId}-${groupId ?? "general"}`} userId={userId} pseudo={pseudos[userId] ?? null} allowed={allowed} groupId={groupId} onChanged={load} />}
    {!groupId && <div className="flex flex-wrap gap-2">{(["all", "community", ...Object.keys(TYPES)] as FeedFilter[]).map(value => {
      if (value !== "all" && value !== "community" && !posts.some(p => p.source === "coach" && p.type === value)) return null;
      return <button type="button" key={value} className={`${ACTION} ${filter === value ? "border-primary text-primary" : ""}`} onClick={() => setFilter(value)}>{value === "all" ? "Tout" : value === "community" ? `Communauté (${posts.filter(p => p.source === "member").length})` : TYPES[value].label}</button>;
    })}</div>}
    {loading ? <div role="status" className="flex items-center justify-center gap-2 p-8"><Loader2 className="h-5 w-5 animate-spin" />Chargement du fil…</div> : !visible.length && !error ? <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Aucune publication pour l'instant.</div> : visible.map(post => <PostCard key={`${userId}-${post.id}`} post={post} userId={userId} initial={interactions[post.id] ?? { liked: false, saved: false }} likeCount={counts[post.id] ?? 0} comments={comments.filter(c => c.content_id === post.id)} pseudos={pseudos} badges={badges} allowed={allowed} onChanged={load} />)}
  </div>;
}