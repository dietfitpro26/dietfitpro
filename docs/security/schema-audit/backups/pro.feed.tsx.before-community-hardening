import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { ProLayout } from "@/layouts/ProLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { FeedView } from "@/components/FeedView";
import { FeedAttachment } from "@/components/FeedAttachment";
import {
  Rss, Plus, X, Video, FileText,
  Lightbulb, Trophy, ChefHat, Eye, EyeOff,
  Trash2, Upload, Loader2, ShieldAlert, RotateCcw, Check, Ban, ShieldOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/pro/feed")({
  component: Page,
});


// ── Types ─────────────────────────────────────────────────
type FeedType = "article" | "tip" | "recipe" | "challenge" | "video";


type FeedPost = {
  id: string;
  author_id: string;
  type: FeedType;
  title: string;
  body: string | null;
  image_url: string | null;
  video_url: string | null;
  tags: string[] | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};


type ModComment = {
  id: string;
  content_id: string;
  user_id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
};


type ModPost = {
  id: string;
  author_id: string | null;
  title: string;
  body: string | null;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
};


type PageTab = "mine" | "general" | "moderation";


// ── Helpers ───────────────────────────────────────────────
const TYPE_CONFIG: Record<FeedType, { label: string; icon: React.ReactNode; color: string }> = {
  article:   { label: "Article",   icon: <FileText className="h-3.5 w-3.5" />,  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  tip:       { label: "Conseil",   icon: <Lightbulb className="h-3.5 w-3.5" />, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  recipe:    { label: "Recette",   icon: <ChefHat className="h-3.5 w-3.5" />,   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  challenge: { label: "Défi",      icon: <Trophy className="h-3.5 w-3.5" />,    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  video:     { label: "Vidéo",     icon: <Video className="h-3.5 w-3.5" />,     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}


function storagePathFromUrl(url: string | null) {
  if (!url) return null;
  const part = url.split("/feed/")[1];
  return part ? decodeURIComponent(part.split("?")[0]) : null;
}


// ── Composant carte post ──────────────────────────────────
function PostCard({
  post, onTogglePublish, onDelete
}: {
  post: FeedPost;
  onTogglePublish: (id: string, current: boolean) => void;
  onDelete: (id: string, imageUrl: string | null) => void;
}) {
  const cfg = TYPE_CONFIG[post.type];
  return (
    <div className={`rounded-xl border bg-card overflow-hidden transition-all ${!post.is_published ? "opacity-60" : ""}`}>
      <FeedAttachment reference={post.image_url} alt={post.title} imageClassName="w-full h-48 object-contain" />
      <FeedAttachment reference={post.video_url} kind="video" />
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                {cfg.icon}{cfg.label}
              </span>
              {!post.is_published && (
                <Badge variant="outline" className="text-xs">Brouillon</Badge>
              )}
            </div>
            <h3 className="font-semibold truncate">{post.title}</h3>
          </div>
        </div>


        {/* Corps */}
        {post.body && (
          <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>
        )}


        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}


        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-xs text-muted-foreground">{formatDate(post.created_at)}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTogglePublish(post.id, post.is_published)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                post.is_published
                  ? "text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20"
                  : "text-muted-foreground bg-muted hover:bg-muted/80"
              }`}
            >
              {post.is_published
                ? <><Eye className="h-3.5 w-3.5" /> Publié</>
                : <><EyeOff className="h-3.5 w-3.5" /> Brouillon</>
              }
            </button>
            <button
              onClick={() => onDelete(post.id, post.image_url)}
              className="text-xs px-2 py-1 rounded-md text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Formulaire nouveau post ───────────────────────────────
function NewPostForm({ authorId, onCreated }: { authorId: string; onCreated: () => void }) {
  const [type, setType]         = useState<FeedType>("article");
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [tags, setTags]         = useState("");
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileRef                 = useRef<HTMLInputElement>(null);


  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };


  const handleSubmit = async (publish: boolean) => {
    if (!title.trim()) { setError("Le titre est obligatoire."); return; }
    setError(null);
    setUploading(true);


    try {
      let image_url: string | null = null;
      let video_url: string | null = null;


      // Upload fichier si présent
      if (file) {
        const ext  = file.name.split(".").pop();
        const path = `${authorId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("feed")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;


        const { data: urlData } = supabase.storage.from("feed").getPublicUrl(path);
        if (file.type.startsWith("image/")) image_url = urlData.publicUrl;
        else if (file.type.startsWith("video/")) video_url = urlData.publicUrl;
        else image_url = urlData.publicUrl; // PDF → on stocke dans image_url pour l'affichage
      }


      const tagArray = tags.split(",").map(t => t.trim()).filter(Boolean);


      const { error: insertErr } = await supabase.from("feed_content").insert({
        author_id:    authorId,
        type,
        title:        title.trim(),
        body:         body.trim() || null,
        image_url,
        video_url,
        tags:         tagArray.length > 0 ? tagArray : null,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
      });


      if (insertErr) throw insertErr;


      // Reset
      setTitle(""); setBody(""); setTags(""); setFile(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      onCreated();


    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la publication");
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" /> Nouvelle publication
      </h2>


      {/* Type */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_CONFIG) as FeedType[]).map((t) => {
          const cfg = TYPE_CONFIG[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                type === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {cfg.icon}{cfg.label}
            </button>
          );
        })}
      </div>


      {/* Titre */}
      <div>
        <Input
          placeholder="Titre *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>


      {/* Corps */}
      <div>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          rows={4}
          placeholder="Contenu de la publication (optionnel)…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>


      {/* Tags */}
      <div>
        <Input
          placeholder="Tags séparés par des virgules (ex: nutrition, poids, sport)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>


      {/* Upload fichier */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,.pdf"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors w-full justify-center"
        >
          <Upload className="h-4 w-4" />
          {file ? file.name : "Ajouter une photo, vidéo ou PDF"}
        </button>


        {/* Prévisualisation image */}
        {preview && (
          <div className="relative mt-2">
            <img src={preview} alt="preview" className="w-full h-40 object-cover rounded-lg" />
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}


        {/* Nom fichier non-image */}
        {file && !preview && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="truncate text-muted-foreground">{file.name}</span>
            <button
              type="button"
              onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>


      {/* Erreur */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}


      {/* Boutons */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={uploading}
          onClick={() => handleSubmit(false)}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
          Brouillon
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={uploading}
          onClick={() => handleSubmit(true)}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          Publier
        </Button>
      </div>
    </div>
  );
}


// ── Onglet 1 : Mes publications ───────────────────────────
function MyPosts() {
  const { user }                = useAuth();
  const [posts, setPosts]       = useState<FeedPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterType, setFilterType] = useState<FeedType | "all">("all");
  const [showForm, setShowForm] = useState(false);


  const fetchPosts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("feed_content")
      .select("*")
      .eq("author_id", user.id)
      .eq("source", "coach")
      .order("created_at", { ascending: false });
    if (!error && data) setPosts(data as FeedPost[]);
    setLoading(false);
  };


  useEffect(() => { void fetchPosts(); }, [user]);


  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("feed_content").update({
      is_published: !current,
      published_at: !current ? new Date().toISOString() : null,
    }).eq("id", id);
    setPosts((prev) => prev.map((p) =>
      p.id === id ? { ...p, is_published: !current } : p
    ));
  };


  const deletePost = async (id: string, imageUrl: string | null) => {
    if (!confirm("Supprimer cette publication ?")) return;
    // Supprimer le fichier storage si présent
    if (imageUrl) {
      const path = imageUrl.split("/feed/")[1];
      if (path) await supabase.storage.from("feed").remove([path]);
    }
    await supabase.from("feed_content").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };


  const filtered = filterType === "all"
    ? posts
    : posts.filter((p) => p.type === filterType);


  const published = posts.filter((p) => p.is_published).length;
  const drafts    = posts.filter((p) => !p.is_published).length;


  return (
    <div className="space-y-6">


      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Mes publications</h2>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">{published} publiés</Badge>
          {drafts > 0 && <Badge variant="outline">{drafts} brouillons</Badge>}
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showForm ? "Annuler" : "Nouveau"}
          </Button>
        </div>
      </div>


      {/* Formulaire */}
      {showForm && user && (
        <NewPostForm
          authorId={user.id}
          onCreated={() => { setShowForm(false); void fetchPosts(); }}
        />
      )}


      {/* Filtres par type */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
            filterType === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          Tous ({posts.length})
        </button>
        {(Object.keys(TYPE_CONFIG) as FeedType[]).map((t) => {
          const count = posts.filter((p) => p.type === t).length;
          if (count === 0) return null;
          const cfg = TYPE_CONFIG[t];
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                filterType === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {cfg.icon}{cfg.label} ({count})
            </button>
          );
        })}
      </div>


      {/* Liste posts */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Rss className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune publication</p>
          <p className="text-sm mt-1">Cliquez sur "Nouveau" pour créer votre premier contenu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onTogglePublish={togglePublish}
              onDelete={deletePost}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// ── Onglet 3 : Modération ─────────────────────────────────
const COMMENT_COLUMNS = "id, content_id, user_id, body, is_hidden, created_at";
const POST_COLUMNS = "id, author_id, title, body, image_url, is_published, created_at";

function ModerationPanel({ onChanged }: { onChanged: () => void }) {
  const [comments, setComments]           = useState<ModComment[]>([]);
  const [posts, setPosts]                 = useState<ModPost[]>([]);
  const [commentReports, setCommentReports] = useState<Record<string, number>>({});
  const [postReports, setPostReports]     = useState<Record<string, number>>({});
  const [pseudos, setPseudos]             = useState<Record<string, string>>({});
  const [titles, setTitles]               = useState<Record<string, string>>({});
  const [loading, setLoading]             = useState(true);
  const [busyId, setBusyId]               = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [notice, setNotice]               = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: rData } = await supabase
      .from("feed_reports")
      .select("target_type, target_id");

    const cCounts: Record<string, number> = {};
    const pCounts: Record<string, number> = {};
    ((rData ?? []) as { target_type: string; target_id: string }[]).forEach((r) => {
      if (r.target_type === "comment") cCounts[r.target_id] = (cCounts[r.target_id] ?? 0) + 1;
      if (r.target_type === "post") pCounts[r.target_id] = (pCounts[r.target_id] ?? 0) + 1;
    });
    const reportedCommentIds = Object.keys(cCounts);
    const reportedPostIds = Object.keys(pCounts);

    // Commentaires : 50 derniers + commentaires signalés
    const { data: recentComments } = await supabase
      .from("feed_comments")
      .select(COMMENT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);

    const cMap = new Map<string, ModComment>();
    ((recentComments ?? []) as ModComment[]).forEach((c) => cMap.set(c.id, c));
    if (reportedCommentIds.length > 0) {
      const { data: repC } = await supabase
        .from("feed_comments")
        .select(COMMENT_COLUMNS)
        .in("id", reportedCommentIds);
      ((repC ?? []) as ModComment[]).forEach((c) => cMap.set(c.id, c));
    }
    const allComments = Array.from(cMap.values());

    // Publications de membres : 30 dernières + publications signalées
    const { data: recentPosts } = await supabase
      .from("feed_content")
      .select(POST_COLUMNS)
      .eq("source", "member")
      .order("created_at", { ascending: false })
      .limit(30);

    const pMap = new Map<string, ModPost>();
    ((recentPosts ?? []) as ModPost[]).forEach((p) => pMap.set(p.id, p));
    if (reportedPostIds.length > 0) {
      const { data: repP } = await supabase
        .from("feed_content")
        .select(POST_COLUMNS)
        .in("id", reportedPostIds);
      ((repP ?? []) as ModPost[]).forEach((p) => pMap.set(p.id, p));
    }
    const allPosts = Array.from(pMap.values());

    // Pseudos (auteurs des commentaires et des publications)
    const userIds = Array.from(
      new Set([
        ...allComments.map((c) => c.user_id),
        ...allPosts.filter((p) => p.author_id).map((p) => p.author_id as string),
      ]),
    );
    const pseudoMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("community_profiles")
        .select("user_id, pseudo")
        .in("user_id", userIds);
      ((pData ?? []) as { user_id: string; pseudo: string }[]).forEach((p) => {
        pseudoMap[p.user_id] = p.pseudo;
      });
    }

    // Titres des publications sous lesquelles on a commenté
    const contentIds = Array.from(new Set(allComments.map((c) => c.content_id)));
    const titleMap: Record<string, string> = {};
    if (contentIds.length > 0) {
      const { data: tData } = await supabase
        .from("feed_content")
        .select("id, title")
        .in("id", contentIds);
      ((tData ?? []) as { id: string; title: string }[]).forEach((t) => {
        titleMap[t.id] = t.title;
      });
    }

    setComments(allComments);
    setPosts(allPosts);
    setCommentReports(cCounts);
    setPostReports(pCounts);
    setPseudos(pseudoMap);
    setTitles(titleMap);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    await load();
    onChanged();
  };

  const clearReports = (type: "comment" | "post", id: string) =>
    supabase.from("feed_reports").delete().eq("target_type", type).eq("target_id", id);

  const fail = (message?: string) => setError("Action impossible : " + (message ?? "erreur inconnue"));

  // ── Bannissement de l'auteur
  const banAuthor = async (authorId: string | null, scope: "groups" | "all", busyKey: string) => {
    if (!authorId) return;

    const question =
      scope === "groups"
        ? "Bannir cette personne de TOUS les groupes ? Elle sera retirée de ses groupes et ne pourra plus en créer ni en rejoindre. Elle garde l'accès au feed général."
        : "Bannir cette personne de TOUTE la communauté ? Elle sera retirée de ses groupes et ne pourra plus publier, commenter ni utiliser les groupes.";

    const reason = window.prompt(`${question}\n\nMotif (facultatif) :`, "");
    if (reason === null) return;

    setBusyId(busyKey); setError(null); setNotice(null);
    const { error: e } = await supabase.rpc("ban_community_member", {
      p_user: authorId,
      p_reason: reason.trim() || null,
      p_scope: scope,
    });

    if (e) {
      fail(e.message.includes("cannot_ban") ? "cette personne ne peut pas être bannie." : e.message);
    } else {
      setNotice(
        scope === "groups"
          ? "Personne bannie de tous les groupes. Vous pouvez lever ce bannissement depuis la page Groupes."
          : "Personne bannie de la communauté. Vous pouvez lever ce bannissement depuis la page Groupes.",
      );
    }
    await refresh();
    setBusyId(null);
  };

  // ── Actions sur les commentaires
  const hideComment = async (id: string) => {
    setBusyId(id); setError(null); setNotice(null);
    const { error: e } = await supabase.from("feed_comments").update({ is_hidden: true }).eq("id", id);
    if (e) fail(e.message);
    await refresh();
    setBusyId(null);
  };

  const restoreComment = async (id: string) => {
    setBusyId(id); setError(null); setNotice(null);
    const { error: e1 } = await supabase.from("feed_comments").update({ is_hidden: false }).eq("id", id);
    const { error: e2 } = await clearReports("comment", id);
    if (e1 || e2) fail(e1?.message ?? e2?.message);
    await refresh();
    setBusyId(null);
  };

  const ignoreComment = async (id: string) => {
    setBusyId(id); setError(null); setNotice(null);
    const { error: e } = await clearReports("comment", id);
    if (e) fail(e.message);
    await refresh();
    setBusyId(null);
  };

  const deleteComment = async (id: string) => {
    if (!confirm("Supprimer définitivement ce commentaire ?")) return;
    setBusyId(id); setError(null); setNotice(null);
    const { error: e1 } = await supabase.from("feed_comments").delete().eq("id", id);
    const { error: e2 } = await clearReports("comment", id);
    if (e1 || e2) fail(e1?.message ?? e2?.message);
    await refresh();
    setBusyId(null);
  };

  // ── Actions sur les publications de membres
  const hidePost = async (id: string) => {
    setBusyId(id); setError(null); setNotice(null);
    const { error: e } = await supabase.from("feed_content").update({ is_published: false }).eq("id", id);
    if (e) fail(e.message);
    await refresh();
    setBusyId(null);
  };

  const restorePost = async (id: string) => {
    setBusyId(id); setError(null); setNotice(null);
    const { error: e1 } = await supabase.from("feed_content").update({ is_published: true }).eq("id", id);
    const { error: e2 } = await clearReports("post", id);
    if (e1 || e2) fail(e1?.message ?? e2?.message);
    await refresh();
    setBusyId(null);
  };

  const ignorePost = async (id: string) => {
    setBusyId(id); setError(null); setNotice(null);
    const { error: e } = await clearReports("post", id);
    if (e) fail(e.message);
    await refresh();
    setBusyId(null);
  };

  const deletePost = async (post: ModPost) => {
    if (!confirm("Supprimer définitivement cette publication ?")) return;
    setBusyId(post.id); setError(null); setNotice(null);
    const { error: e1 } = await supabase.from("feed_content").delete().eq("id", post.id);
    if (e1) {
      fail(e1.message);
    } else {
      const path = storagePathFromUrl(post.image_url);
      if (path) await supabase.storage.from("feed").remove([path]);
      await clearReports("post", post.id);
    }
    await refresh();
    setBusyId(null);
  };

  const btn = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50";

  const renderComment = (c: ModComment) => {
    const count = commentReports[c.id] ?? 0;
    const busy = busyId === c.id || busyId === `ban-${c.id}`;

    return (
      <div key={`c-${c.id}`} className={`rounded-xl border bg-card p-4 space-y-2 ${c.is_hidden ? "border-orange-300" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">Commentaire</Badge>
          <span className="font-medium text-foreground">{pseudos[c.user_id] ?? "Membre sans pseudo"}</span>
          <span>·</span>
          <span>{formatDate(c.created_at)}</span>
          {count > 0 && (
            <Badge variant="outline" className="text-xs border-red-300 text-red-600">
              {count} signalement{count > 1 ? "s" : ""}
            </Badge>
          )}
          {c.is_hidden && (
            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Masqué</Badge>
          )}
        </div>

        <p className="text-sm whitespace-pre-line">{c.body}</p>

        <p className="text-xs text-muted-foreground">
          Sous la publication : {titles[c.content_id] ?? "publication introuvable"}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          {c.is_hidden ? (
            <button
              disabled={busy}
              onClick={() => void restoreComment(c.id)}
              className={`${btn} text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20`}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Rétablir
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => void hideComment(c.id)}
              className={`${btn} text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20`}
            >
              <EyeOff className="h-3.5 w-3.5" /> Masquer
            </button>
          )}

          {count > 0 && !c.is_hidden && (
            <button
              disabled={busy}
              onClick={() => void ignoreComment(c.id)}
              className={`${btn} text-muted-foreground bg-muted hover:bg-muted/80`}
            >
              <Check className="h-3.5 w-3.5" /> Ignorer le signalement
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => void banAuthor(c.user_id, "groups", `ban-${c.id}`)}
            className={`${btn} text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20`}
          >
            <Ban className="h-3.5 w-3.5" /> Bannir des groupes
          </button>

          <button
            disabled={busy}
            onClick={() => void banAuthor(c.user_id, "all", `ban-${c.id}`)}
            className={`${btn} text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
          >
            <ShieldOff className="h-3.5 w-3.5" /> Bannir de la communauté
          </button>

          <button
            disabled={busy}
            onClick={() => void deleteComment(c.id)}
            className={`${btn} ml-auto text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </div>
      </div>
    );
  };

  const renderPost = (p: ModPost) => {
    const count = postReports[p.id] ?? 0;
    const busy = busyId === p.id || busyId === `ban-${p.id}`;
    const hidden = !p.is_published;

    return (
      <div key={`p-${p.id}`} className={`rounded-xl border bg-card p-4 space-y-2 ${hidden ? "border-orange-300" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">Publication</Badge>
          <span className="font-medium text-foreground">
            {p.author_id ? pseudos[p.author_id] ?? "Membre sans pseudo" : "Membre"}
          </span>
          <span>·</span>
          <span>{formatDate(p.created_at)}</span>
          {count > 0 && (
            <Badge variant="outline" className="text-xs border-red-300 text-red-600">
              {count} signalement{count > 1 ? "s" : ""}
            </Badge>
          )}
          {hidden && (
            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Masquée</Badge>
          )}
        </div>

        {p.body ? (
          <p className="text-sm whitespace-pre-line">{p.body}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">(sans texte)</p>
        )}

        <FeedAttachment reference={p.image_url} alt="Photo jointe" imageClassName="max-h-48 rounded-lg object-contain" />

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          {hidden ? (
            <button
              disabled={busy}
              onClick={() => void restorePost(p.id)}
              className={`${btn} text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20`}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Rétablir
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => void hidePost(p.id)}
              className={`${btn} text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20`}
            >
              <EyeOff className="h-3.5 w-3.5" /> Masquer
            </button>
          )}

          {count > 0 && !hidden && (
            <button
              disabled={busy}
              onClick={() => void ignorePost(p.id)}
              className={`${btn} text-muted-foreground bg-muted hover:bg-muted/80`}
            >
              <Check className="h-3.5 w-3.5" /> Ignorer le signalement
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => void banAuthor(p.author_id, "groups", `ban-${p.id}`)}
            className={`${btn} text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20`}
          >
            <Ban className="h-3.5 w-3.5" /> Bannir des groupes
          </button>

          <button
            disabled={busy}
            onClick={() => void banAuthor(p.author_id, "all", `ban-${p.id}`)}
            className={`${btn} text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
          >
            <ShieldOff className="h-3.5 w-3.5" /> Bannir de la communauté
          </button>

          <button
            disabled={busy}
            onClick={() => void deletePost(p)}
            className={`${btn} ml-auto text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  const reportedComments = comments
    .filter((c) => (commentReports[c.id] ?? 0) > 0)
    .sort((a, b) => (commentReports[b.id] ?? 0) - (commentReports[a.id] ?? 0));

  const reportedPosts = posts
    .filter((p) => (postReports[p.id] ?? 0) > 0)
    .sort((a, b) => (postReports[b.id] ?? 0) - (postReports[a.id] ?? 0));

  const otherPosts = posts.filter((p) => (postReports[p.id] ?? 0) === 0);
  const otherComments = comments.filter((c) => (commentReports[c.id] ?? 0) === 0);

  const toHandle = reportedPosts.length + reportedComments.length;

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {notice && (
        <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">{notice}</p>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          À traiter ({toHandle})
        </h2>
        {toHandle === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun contenu signalé pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {reportedPosts.map(renderPost)}
            {reportedComments.map(renderComment)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dernières publications de membres ({otherPosts.length})</h2>
        {otherPosts.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Aucune publication de membre pour le moment.
          </div>
        ) : (
          <div className="space-y-3">{otherPosts.map(renderPost)}</div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Derniers commentaires ({otherComments.length})</h2>
        {otherComments.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun commentaire pour le moment.
          </div>
        ) : (
          <div className="space-y-3">{otherComments.map(renderComment)}</div>
        )}
      </section>
    </div>
  );
}


// ── Page principale ───────────────────────────────────────
function Page() {
  return <ProLayout><Content /></ProLayout>;
}


function Content() {
  const { user } = useAuth();
  const [tab, setTab] = useState<PageTab>("mine");
  const [pending, setPending] = useState(0);

  const loadPending = useCallback(async () => {
    const { data: r } = await supabase
      .from("feed_reports")
      .select("target_type, target_id");

    const rows = (r ?? []) as { target_type: string; target_id: string }[];
    const commentIds = Array.from(new Set(rows.filter((x) => x.target_type === "comment").map((x) => x.target_id)));
    const postIds = Array.from(new Set(rows.filter((x) => x.target_type === "post").map((x) => x.target_id)));

    let total = 0;

    if (commentIds.length > 0) {
      const { data: c } = await supabase.from("feed_comments").select("id").in("id", commentIds);
      total += (c ?? []).length;
    }
    if (postIds.length > 0) {
      const { data: p } = await supabase.from("feed_content").select("id").in("id", postIds);
      total += (p ?? []).length;
    }

    setPending(total);
  }, []);

  useEffect(() => { void loadPending(); }, [loadPending]);

  const tabs: { key: PageTab; label: string }[] = [
    { key: "mine", label: "Mes publications" },
    { key: "general", label: "Fil général" },
    { key: "moderation", label: "Modération" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Rss className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Feed</h1>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
              tab === t.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {t.label}
            {t.key === "moderation" && pending > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "mine" && <MyPosts />}
      {tab === "general" && user && <FeedView userId={user.id} />}
      {tab === "moderation" && <ModerationPanel onChanged={() => void loadPending()} />}
    </div>
  );
}