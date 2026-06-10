import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ProLayout } from "@/layouts/ProLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Rss, Plus, X, Image, Video, FileText,
  Lightbulb, Trophy, ChefHat, Eye, EyeOff,
  Trash2, Upload, Loader2
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
      {/* Image */}
      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
      )}
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

// ── Page principale ───────────────────────────────────────
function Page() {
  return <ProLayout><Content /></ProLayout>;
}

function Content() {
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
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Rss className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Feed</h1>
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