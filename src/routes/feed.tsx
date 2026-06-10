import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Heart, Bookmark, MessageCircle, Send,
  FileText, Lightbulb, ChefHat, Trophy, Video, X
} from "lucide-react";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed — DietFitPro" }] }),
  component: FeedPage,
});

// ── Types ─────────────────────────────────────────────────
type FeedType = "article" | "tip" | "recipe" | "challenge" | "video";

type FeedPost = {
  id: string;
  type: FeedType;
  title: string;
  body: string | null;
  image_url: string | null;
  video_url: string | null;
  tags: string[] | null;
  published_at: string | null;
  created_at: string;
};

type Interaction = {
  liked: boolean;
  saved: boolean;
  comment: string | null;
};

// ── Helpers ───────────────────────────────────────────────
const TYPE_CONFIG: Record<FeedType, { label: string; icon: React.ReactNode; color: string }> = {
  article:   { label: "Article",  icon: <FileText className="h-3 w-3" />,   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  tip:       { label: "Conseil",  icon: <Lightbulb className="h-3 w-3" />,  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  recipe:    { label: "Recette",  icon: <ChefHat className="h-3 w-3" />,    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  challenge: { label: "Défi",     icon: <Trophy className="h-3 w-3" />,     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  video:     { label: "Vidéo",    icon: <Video className="h-3 w-3" />,      color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "À l'instant";
  if (mins < 60)  return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7)   return `Il y a ${days}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ── Carte post ────────────────────────────────────────────
function PostCard({
  post, userId, initialInteraction
}: {
  post: FeedPost;
  userId: string;
  initialInteraction: Interaction | null;
}) {
  const [liked,     setLiked]     = useState(initialInteraction?.liked   ?? false);
  const [saved,     setSaved]     = useState(initialInteraction?.saved   ?? false);
  const [showComment, setShowComment] = useState(false);
  const [comment,   setComment]   = useState(initialInteraction?.comment ?? "");
  const [tempComment, setTempComment] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [likeAnim,  setLikeAnim]  = useState(false);

  const upsertInteraction = useCallback(async (patch: Partial<Interaction>) => {
    await supabase.from("feed_interactions").upsert(
      { user_id: userId, content_id: post.id, liked, saved, comment, ...patch },
      { onConflict: "user_id,content_id" }
    );
  }, [userId, post.id, liked, saved, comment]);

  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    await upsertInteraction({ liked: next });
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    await upsertInteraction({ saved: next });
  };

  const handleComment = async () => {
    if (!tempComment.trim()) return;
    setSaving(true);
    const newComment = tempComment.trim();
    setComment(newComment);
    await upsertInteraction({ comment: newComment });
    setTempComment("");
    setShowComment(false);
    setSaving(false);
  };

  const cfg = TYPE_CONFIG[post.type];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">

      {/* Image */}
      {post.image_url && !post.image_url.endsWith(".pdf") && (
        <img
          src={post.image_url}
          alt={post.title}
          className="w-full h-52 object-cover"
          loading="lazy"
        />
      )}

      {/* PDF badge */}
      {post.image_url?.endsWith(".pdf") && (
        <div className="flex items-center gap-2 bg-muted px-4 py-3 border-b">
          <FileText className="h-5 w-5 text-primary" />
          <a
            href={post.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            Voir le document PDF
          </a>
        </div>
      )}

      <div className="p-4 space-y-3">

        {/* Type + date */}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
            {cfg.icon}{cfg.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(post.published_at ?? post.created_at)}
          </span>
        </div>

        {/* Titre + corps */}
        <div>
          <h3 className="font-semibold text-base mb-1">{post.title}</h3>
          {post.body && (
            <p className="text-sm text-muted-foreground leading-relaxed">{post.body}</p>
          )}
        </div>

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

        {/* Commentaire existant */}
        {comment && (
          <div className="flex items-start justify-between gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground italic flex-1">💬 {comment}</p>
            <button
              onClick={async () => {
                setComment("");
                await upsertInteraction({ comment: null });
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Zone commentaire */}
        {showComment && (
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Votre commentaire…"
              value={tempComment}
              onChange={(e) => setTempComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleComment(); }}
              autoFocus
            />
            <button
              onClick={() => void handleComment()}
              disabled={saving || !tempComment.trim()}
              className="rounded-lg bg-primary text-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowComment(false)}
              className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1 border-t">
          {/* Like */}
          <button
            onClick={() => void handleLike()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              liked
                ? "text-red-500 bg-red-50 dark:bg-red-900/20"
                : "text-muted-foreground hover:bg-muted"
            } ${likeAnim ? "scale-125" : "scale-100"}`}
            style={{ transition: "transform 0.2s" }}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-red-500" : ""}`} />
            <span className="text-xs">{liked ? "Aimé" : "J'aime"}</span>
          </button>

          {/* Commentaire */}
          <button
            onClick={() => setShowComment((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              comment
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">{comment ? "Modif." : "Commenter"}</span>
          </button>

          {/* Sauvegarder */}
          <button
            onClick={() => void handleSave()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ml-auto ${
              saved
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${saved ? "fill-primary" : ""}`} />
            <span className="text-xs">{saved ? "Sauvegardé" : "Sauvegarder"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────
function FeedPage() {
  return (
    <ProtectedRoute allow={["subscriber", "patient"]}>
      <SubscriberLayout>
        <FeedContent />
      </SubscriberLayout>
    </ProtectedRoute>
  );
}

function FeedContent() {
  const { user }                        = useAuth();
  const [posts, setPosts]               = useState<FeedPost[]>([]);
  const [interactions, setInteractions] = useState<Record<string, Interaction>>({});
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<FeedType | "all">("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Posts publiés
      const { data: postsData } = await supabase
        .from("feed_content")
        .select("id, type, title, body, image_url, video_url, tags, published_at, created_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

      // Interactions de l'utilisateur
      const { data: interData } = await supabase
        .from("feed_interactions")
        .select("content_id, liked, saved, comment")
        .eq("user_id", user.id);

      if (postsData) setPosts(postsData as FeedPost[]);
      if (interData) {
        const map: Record<string, Interaction> = {};
        interData.forEach((r: { content_id: string; liked: boolean; saved: boolean; comment: string | null }) => {
          map[r.content_id] = { liked: r.liked, saved: r.saved, comment: r.comment };
        });
        setInteractions(map);
      }
      setLoading(false);
    };
    void load();
  }, [user]);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.type === filter);

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Feed</h1>
        <span className="text-xs text-muted-foreground">{posts.length} publication{posts.length > 1 ? "s" : ""}</span>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setFilter("all")}
          className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
            filter === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          Tout
        </button>
        {(Object.keys(TYPE_CONFIG) as FeedType[]).map((t) => {
          const cfg = TYPE_CONFIG[t];
          const count = posts.filter((p) => p.type === t).length;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                filter === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {cfg.icon}{cfg.label}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 animate-pulse space-y-3">
              <div className="h-48 bg-muted rounded-lg" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <p className="font-medium">Aucune publication pour l'instant</p>
          <p className="text-sm mt-1">Votre coach publiera bientôt du contenu ici</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userId={user!.id}
              initialInteraction={interactions[post.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}