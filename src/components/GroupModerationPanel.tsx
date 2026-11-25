import { useCallback, useEffect, useState } from "react";
import { FeedAttachment } from "@/components/FeedAttachment";
import { getFeedStoragePath } from "@/lib/feedStorage";
import { supabase } from "@/lib/supabase";
import { Check, EyeOff, Flag, Loader2, RotateCcw, Trash2 } from "lucide-react";

type Report = { target_type: "post" | "comment"; target_id: string };
type Post = {
  id: string;
  author_id: string | null;
  body: string | null;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
};
type Comment = {
  id: string;
  content_id: string;
  user_id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
};

export function GroupModerationPanel({ groupId }: { groupId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: reportError } = await supabase
      .from("feed_reports")
      .select("target_type, target_id")
      .order("created_at", { ascending: false });
    if (reportError) {
      setError("Impossible de charger les signalements de ce groupe.");
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    const postIds = new Set<string>();
    const commentIds = new Set<string>();
    ((rows ?? []) as Report[]).forEach((report) => {
      const key = `${report.target_type}:${report.target_id}`;
      counts[key] = (counts[key] ?? 0) + 1;
      if (report.target_type === "post") postIds.add(report.target_id);
      else commentIds.add(report.target_id);
    });

    const [postResult, commentResult] = await Promise.all([
      postIds.size
        ? supabase.from("feed_content")
            .select("id, author_id, body, image_url, is_published, created_at")
            .eq("group_id", groupId).in("id", [...postIds])
        : Promise.resolve({ data: [], error: null }),
      commentIds.size
        ? supabase.from("feed_comments")
            .select("id, content_id, user_id, body, is_hidden, created_at")
            .in("id", [...commentIds])
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (postResult.error || commentResult.error) {
      setError("Certains contenus ne sont plus disponibles.");
      setPosts([]);
      setComments([]);
    } else {
      setPosts((postResult.data ?? []) as Post[]);
      setComments((commentResult.data ?? []) as Comment[]);
      setReportCounts(counts);
      setError(null);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => { void load(); }, [load]);

  const clearReports = async (type: "post" | "comment", id: string) => {
    const { error: requestError } = await supabase.from("feed_reports")
      .delete().eq("target_type", type).eq("target_id", id);
    if (requestError) throw requestError;
  };

  const setPostPublished = async (post: Post, published: boolean) => {
    setBusy(post.id); setError(null); setNotice(null);
    const { error: requestError } = await supabase.from("feed_content")
      .update({ is_published: published }).eq("id", post.id).eq("group_id", groupId);
    if (requestError) setError("Action impossible : droits de groupe requis ou publication déjà supprimée.");
    else { setNotice(published ? "Publication rétablie." : "Publication masquée."); await load(); }
    setBusy(null);
  };

  const deletePost = async (post: Post) => {
    if (!confirm("Supprimer cette publication et son fichier joint ?")) return;
    setBusy(post.id); setError(null); setNotice(null);
    const path = getFeedStoragePath(post.image_url);
    if (path) {
      const { error: fileError } = await supabase.storage.from("feed").remove([path]);
      if (fileError) {
        setError("Le fichier n'a pas pu être supprimé. La publication est conservée.");
        setBusy(null);
        return;
      }
    }
    try { await clearReports("post", post.id); }
    catch {
      setError("Les signalements n'ont pas pu être traités. La publication est conservée.");
      setBusy(null);
      return;
    }
    const { error: requestError } = await supabase.from("feed_content")
      .delete().eq("id", post.id).eq("group_id", groupId);
    if (requestError) setError("La publication n'a pas pu être supprimée.");
    else {
      setNotice("Publication supprimée.");
      await load();
    }
    setBusy(null);
  };

  const setCommentHidden = async (comment: Comment, hidden: boolean) => {
    setBusy(comment.id); setError(null); setNotice(null);
    const { error: requestError } = await supabase.from("feed_comments")
      .update({ is_hidden: hidden }).eq("id", comment.id);
    if (requestError) setError("Action impossible : droits de modération du groupe requis.");
    else { setNotice(hidden ? "Commentaire masqué." : "Commentaire rétabli."); await load(); }
    setBusy(null);
  };

  const deleteComment = async (comment: Comment) => {
    if (!confirm("Supprimer ce commentaire ?")) return;
    setBusy(comment.id); setError(null); setNotice(null);
    try { await clearReports("comment", comment.id); }
    catch {
      setError("Les signalements n'ont pas pu être traités. Le commentaire est conservé.");
      setBusy(null);
      return;
    }
    const { error: requestError } = await supabase.from("feed_comments").delete().eq("id", comment.id);
    if (requestError) setError("Le commentaire n'a pas pu être supprimé.");
    else {
      setNotice("Commentaire supprimé.");
      await load();
    }
    setBusy(null);
  };

  const dismiss = async (type: "post" | "comment", id: string) => {
    setBusy(id); setError(null); setNotice(null);
    try { await clearReports(type, id); setNotice("Signalement ignoré."); await load(); }
    catch { setError("Impossible de traiter ce signalement."); }
    setBusy(null);
  };

  const reportedPosts = posts.filter((post) => (reportCounts[`post:${post.id}`] ?? 0) > 0);
  const reportedComments = comments.filter((comment) => (reportCounts[`comment:${comment.id}`] ?? 0) > 0);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Flag className="h-4 w-4 text-primary" />Modération de ce groupe</h2>
      <p className="text-xs text-muted-foreground">Seul le responsable de ce groupe ou le super administrateur peut voir et traiter ces signalements.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {loading ? <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>
        : !reportedPosts.length && !reportedComments.length ? <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Aucun signalement en attente.</p>
        : <div className="space-y-3">
          {reportedPosts.map((post) => <article key={post.id} className="space-y-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Publication · {reportCounts[`post:${post.id}`]} signalement(s)</p>
            {post.body && <p className="whitespace-pre-line text-sm">{post.body}</p>}
            <FeedAttachment reference={post.image_url} alt="Pièce jointe signalée" imageClassName="max-h-64 rounded-lg object-contain" />
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md border px-3 py-1.5 text-xs" disabled={busy === post.id} onClick={() => void dismiss("post", post.id)}><Check className="mr-1 inline h-3.5 w-3.5" />Ignorer</button>
              <button className="rounded-md border px-3 py-1.5 text-xs" disabled={busy === post.id} onClick={() => void setPostPublished(post, !post.is_published)}>{post.is_published ? <EyeOff className="mr-1 inline h-3.5 w-3.5" /> : <RotateCcw className="mr-1 inline h-3.5 w-3.5" />}{post.is_published ? "Masquer" : "Rétablir"}</button>
              <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600" disabled={busy === post.id} onClick={() => void deletePost(post)}><Trash2 className="mr-1 inline h-3.5 w-3.5" />Supprimer</button>
            </div>
          </article>)}
          {reportedComments.map((comment) => <article key={comment.id} className="space-y-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Commentaire · {reportCounts[`comment:${comment.id}`]} signalement(s)</p>
            <p className="whitespace-pre-line text-sm">{comment.body}</p>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md border px-3 py-1.5 text-xs" disabled={busy === comment.id} onClick={() => void dismiss("comment", comment.id)}><Check className="mr-1 inline h-3.5 w-3.5" />Ignorer</button>
              <button className="rounded-md border px-3 py-1.5 text-xs" disabled={busy === comment.id} onClick={() => void setCommentHidden(comment, !comment.is_hidden)}>{comment.is_hidden ? <RotateCcw className="mr-1 inline h-3.5 w-3.5" /> : <EyeOff className="mr-1 inline h-3.5 w-3.5" />}{comment.is_hidden ? "Rétablir" : "Masquer"}</button>
              <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600" disabled={busy === comment.id} onClick={() => void deleteComment(comment)}><Trash2 className="mr-1 inline h-3.5 w-3.5" />Supprimer</button>
            </div>
          </article>)}
        </div>}
    </section>
  );
}
