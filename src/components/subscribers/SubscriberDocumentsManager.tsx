import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

const CATEGORIES: { value: "nutrition" | "sport" | "general"; label: string }[] = [
  { value: "nutrition", label: "Nutrition" },
  { value: "sport", label: "Sport" },
  { value: "general", label: "Général" },
];

const MAX_SIZE_MB = 10;
const MAX_NOTE_LENGTH = 2000;

/** Gestion des PDF et des notes d'un abonné (côté professionnel). */
export function SubscriberDocumentsManager({
  subscriberUserId,
  proId,
}: {
  subscriberUserId: string;
  proId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<"nutrition" | "sport" | "general">("nutrition");
  const [title, setTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    const [docsRes, notesRes] = await Promise.all([
      supabase
        .from("subscriber_documents")
        .select("id, title, file_url, file_name, category, created_at")
        .eq("user_id", subscriberUserId)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriber_notes")
        .select("id, body, created_at")
        .eq("user_id", subscriberUserId)
        .order("created_at", { ascending: false }),
    ]);

    if (docsRes.error) {
      toast.error("Chargement des documents impossible : " + docsRes.error.message);
      setDocs([]);
    } else {
      setDocs((docsRes.data ?? []) as DocRow[]);
    }

    if (notesRes.error) {
      toast.error("Chargement des notes impossible : " + notesRes.error.message);
      setNotes([]);
    } else {
      setNotes((notesRes.data ?? []) as NoteRow[]);
    }

    setLoading(false);
  }, [subscriberUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reset = () => {
      if (fileRef.current) fileRef.current.value = "";
    };

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      reset();
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Le fichier dépasse ${MAX_SIZE_MB} Mo.`);
      reset();
      return;
    }

    setUploading(true);
    const path = `${proId}/subscriber-docs/${subscriberUserId}/${category}-${Date.now()}.pdf`;

    try {
      const { error: upErr } = await supabase.storage
        .from("message-attachments")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { error: insertErr } = await supabase.from("subscriber_documents").insert({
        user_id: subscriberUserId,
        category,
        title: title.trim() || file.name.replace(/\.pdf$/i, ""),
        file_url: path,
        file_name: file.name,
      });

      if (insertErr) {
        await supabase.storage.from("message-attachments").remove([path]);
        throw insertErr;
      }

      toast.success("PDF ajouté ✅");
      setTitle("");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      toast.error(message);
    } finally {
      setUploading(false);
      reset();
    }
  };

  const openPdf = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Impossible d'ouvrir le fichier");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (doc: DocRow) => {
    if (!confirm("Supprimer ce PDF ?")) return;

    const { error } = await supabase.from("subscriber_documents").delete().eq("id", doc.id);
    if (error) {
      toast.error("Suppression impossible : " + error.message);
      return;
    }
    await supabase.storage.from("message-attachments").remove([doc.file_url]);
    toast.success("PDF supprimé");
    await load();
  };

  const handleSaveNote = async () => {
    const body = noteText.trim();
    if (!body) {
      toast.error("Écrivez un message avant d'enregistrer.");
      return;
    }

    setSavingNote(true);
    const { error } = await supabase.from("subscriber_notes").insert({
      user_id: subscriberUserId,
      pro_id: proId,
      body,
    });
    setSavingNote(false);

    if (error) {
      toast.error("Enregistrement impossible : " + error.message);
      return;
    }

    toast.success("Note enregistrée ✅");
    setNoteText("");
    await load();
  };

  const handleDeleteNote = async (note: NoteRow) => {
    if (!confirm("Supprimer cette note ?")) return;

    const { error } = await supabase.from("subscriber_notes").delete().eq("id", note.id);
    if (error) {
      toast.error("Suppression impossible : " + error.message);
      return;
    }
    toast.success("Note supprimée");
    await load();
  };

  return (
    <div className="space-y-6">
      {/* ── PDF ── */}
      <div className="space-y-4">
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-semibold">Ajouter un PDF</p>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  category === c.value
                    ? "border-[#6DB33F] bg-[#6DB33F]/10 font-medium text-[#2D7A1F]"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Titre (facultatif)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Plan alimentaire octobre"
              maxLength={120}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => void handleFile(e)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                <Upload className="mr-1 h-3.5 w-3.5" />
                Choisir un PDF
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            PDF uniquement, {MAX_SIZE_MB} Mo maximum. Visible par l'abonné s'il est Premium.
          </p>
        </div>

        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun PDF pour cet abonné.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="truncate text-sm">{doc.title ?? doc.file_name ?? "Document"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {CATEGORIES.find((c) => c.value === doc.category)?.label ?? doc.category} ·{" "}
                    {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openPdf(doc.file_url)}
                    className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                  >
                    <ExternalLink className="h-3 w-3" /> Voir
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(doc)}
                    className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-500 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      <div className="space-y-4 border-t pt-4">
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-semibold">Écrire une note pour l'abonné</p>
          <Textarea
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            placeholder="Ex : Bravo pour ce mois-ci ! Ajoute 100 g de légumes au dîner."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {noteText.length} / {MAX_NOTE_LENGTH} · visible par l'abonné s'il est Premium
            </span>
            <Button
              size="sm"
              className="bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
              disabled={savingNote}
              onClick={() => void handleSaveNote()}
            >
              {savingNote ? "Enregistrement…" : "Enregistrer la note"}
            </Button>
          </div>
        </div>

        {loading ? null : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune note pour cet abonné.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteNote(note)}
                    className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs text-red-500 hover:bg-red-100"
                    aria-label="Supprimer la note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}