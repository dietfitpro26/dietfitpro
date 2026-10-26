import { useEffect, useState } from "react";
import { Download, FileText, Lock, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

interface DocRow {
  id: string;
  title: string | null;
  file_url: string;
  file_name: string | null;
  category: string;
  created_at: string;
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  nutrition: "Nutrition",
  sport: "Sport",
  general: "Général",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Documents PDF et messages du diététicien (réservé aux abonnés Premium). */
export function SubscriberDocuments({
  userId,
  isPremium,
}: {
  userId: string;
  isPremium: boolean;
}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(isPremium);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isPremium) {
      setDocs([]);
      setNotes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);

      const [docsRes, notesRes] = await Promise.all([
        supabase
          .from("subscriber_documents")
          .select("id, title, file_url, file_name, category, created_at")
          .eq("user_id", userId)
          .in("category", ["nutrition", "general"])
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriber_notes")
          .select("id, body, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const firstError = docsRes.error ?? notesRes.error;
      setErrorMsg(firstError ? firstError.message : null);
      setDocs(docsRes.error ? [] : ((docsRes.data ?? []) as DocRow[]));
      setNotes(notesRes.error ? [] : ((notesRes.data ?? []) as NoteRow[]));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isPremium]);

  const openPdf = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      console.error("Erreur ouverture PDF :", error);
      toast.error("Impossible d'ouvrir le document, réessayez.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (!isPremium) {
    return (
      <Card className="rounded-3xl border border-dashed shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Documents et messages de votre diététicien</CardTitle>
              <CardDescription>
                Fiches PDF et conseils personnalisés : réservé aux abonnés Premium.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {errorMsg ? (
        <div className="rounded-2xl border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {errorMsg}
        </div>
      ) : null}

      <Card className="rounded-3xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Messages de votre diététicien</CardTitle>
              <CardDescription>Ses conseils et encouragements pour votre suivi.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          ) : notes.length === 0 ? (
            <div className="rounded-xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
              Aucun message pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-2xl border bg-muted/20 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{formatDate(note.created_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Documents de votre diététicien</CardTitle>
          <CardDescription>Fiches et documents PDF liés à votre suivi nutritionnel.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          ) : docs.length === 0 ? (
            <div className="rounded-xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
              Aucun document pour le moment. Votre diététicien pourra en ajouter ici.
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-red-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{doc.title ?? doc.file_name ?? "Document"}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[doc.category] ?? doc.category} ·{" "}
                        {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="rounded-xl" onClick={() => void openPdf(doc.file_url)}>
                    <Download className="mr-1 h-4 w-4" />
                    Ouvrir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}