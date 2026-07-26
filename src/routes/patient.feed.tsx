import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Heart,
  Bookmark,
  MessageCircle,
  Send,
  FileText,
  Lightbulb,
  ChefHat,
  Trophy,
  Video,
  X,
} from "lucide-react";

export const Route = createFileRoute("/patient/feed")({
  head: () => ({ meta: [{ title: "Feed — Patient — DietFitPro" }] }),
  component: PatientFeedPage,
});

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

const TYPE_CONFIG: Record<
  FeedType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  article: {
    label: "Article",
    icon: <FileText className="h-3 w-3" />,
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  tip: {
    label: "Conseil",
    icon: <Lightbulb className="h-3 w-3" />,
    color:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  recipe: {
    label: "Recette",
    icon: <ChefHat className="h-3 w-3" />,
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  challenge: {
    label: "Défi",
    icon: <Trophy className="h-3 w-3" />,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  video: {
    label: "Vidéo",
    icon: <Video className="h-3 w-3" />,
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;

  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function PatientFeedPage() {
  return (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <FeedContent />
      </PatientLayout>
    </ProtectedRoute>
  );
}

function FeedContent() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [interactions, setInteractions] = useState<Record<string, Interaction>>(
    {},
  );

  const loadFeed = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const { data: postsData } = await supabase
      .from("feed_content")
      .select("id, type, title, body, image_url, video_url, tags, published_at, created_at")
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false });

    const { data: interactionsData } = await supabase
      .from("feed_interactions")
      .select("content_id, liked, saved, comment")
      .eq("user_id", user.id);

    const map: Record<string, Interaction> = {};
    (interactionsData ?? []).forEach((row: any) => {
      map[row.content_id] = {
        liked: !!row.liked,
        saved: !!row.saved,
        comment: row.comment ?? null,
      };
    });

    setPosts((postsData ?? []) as FeedPost[]);
    setInteractions(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <h1 className="text-2xl font-bold">Feed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Retrouvez les publications, conseils, recettes, défis et contenus motivationnels.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Aucun contenu publié pour le moment.
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userId={user?.id ?? ""}
              initialInteraction={interactions[post.id] ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PostCard({
  post,
  userId,
  initialInteraction,
}: {
  post: FeedPost;
  userId: string;
  initialInteraction: Interaction | null;
}) {
  const [liked, setLiked] = useState(initialInteraction?.liked ?? false);
  const [saved, setSaved] = useState(initialInteraction?.saved ?? false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(initialInteraction?.comment ?? "");
  const [tempComment, setTempComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);

  const upsertInteraction = useCallback(
    async (patch: Partial<Interaction>) => {
      await supabase.from("feed_interactions").upsert(
        { user_id: userId, content_id: post.id, liked, saved, comment, ...patch },
        { onConflict: "user_id,content_id" },
      );
    },
    [userId, post.id, liked, saved, comment],
  );

  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 250);
    await upsertInteraction({ liked: next });
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    await upsertInteraction({ saved: next });
  };

  const handleAddComment = async () => {
    if (!tempComment.trim()) return;
    setSaving(true);
    setComment(tempComment.trim());
    await upsertInteraction({ comment: tempComment.trim() });
    setTempComment("");
    setShowComment(false);
    setSaving(false);
  };

  const handleDeleteComment = async () => {
    setSaving(true);
    setComment("");
    await upsertInteraction({ comment: null });
    setSaving(false);
  };

  const meta = TYPE_CONFIG[post.type];

  return (
    <article className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.color}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(post.published_at ?? post.created_at)}
          </span>
        </div>

        <h2 className="text-lg font-semibold">{post.title}</h2>

        {post.body && (
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {post.body}
          </p>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          className="h-auto w-full object-cover"
        />
      )}

      {post.video_url && (
        <div className="px-5 pb-5">
          <a
            href={post.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Video className="h-4 w-4" />
            Voir la vidéo
          </a>
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleLike}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
              liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"
            } ${likeAnim ? "scale-105" : ""}`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            J’aime
          </button>

          <button
            onClick={() => setShowComment((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            Commenter
          </button>

          <button
            onClick={handleSave}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
              saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
            Enregistrer
          </button>
        </div>

        {comment && (
          <div className="mt-4 rounded-2xl bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Votre commentaire
              </span>
              <button
                onClick={handleDeleteComment}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm">{comment}</p>
          </div>
        )}

        {showComment && (
          <div className="mt-4 flex items-start gap-2">
            <textarea
              value={tempComment}
              onChange={(e) => setTempComment(e.target.value)}
              placeholder="Écrire un commentaire…"
              className="min-h-[90px] flex-1 rounded-2xl border bg-background px-4 py-3 text-sm outline-none"
            />
            <button
              onClick={handleAddComment}
              disabled={saving || !tempComment.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}