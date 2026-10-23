import { useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, Video } from "lucide-react";
import {
  createFeedSignedUrl,
  FEED_SIGNED_URL_SECONDS,
  isFeedPdf,
} from "@/lib/feedStorage";

type FeedAttachmentProps = {
  reference: string | null | undefined;
  kind?: "image" | "video";
  alt?: string;
  imageClassName?: string;
};

type AttachmentState = {
  reference: string | null;
  url: string | null;
  loading: boolean;
  error: string | null;
};

export function FeedAttachment({
  reference,
  kind = "image",
  alt = "Photo partagée",
  imageClassName = "w-full max-h-96 object-contain",
}: FeedAttachmentProps) {
  const currentReference = reference?.trim() || null;

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AttachmentState>({
    reference: null,
    url: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!currentReference) return;

    let cancelled = false;
    let refreshing = false;

    setState({
      reference: currentReference,
      url: null,
      loading: true,
      error: null,
    });

    const refreshUrl = async () => {
      if (refreshing || cancelled) return;
      refreshing = true;

      try {
        const url = await createFeedSignedUrl(currentReference);

        if (!url) {
          throw new Error("Pièce jointe indisponible.");
        }

        if (!cancelled) {
          setState({
            reference: currentReference,
            url,
            loading: false,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            reference: currentReference,
            url: null,
            loading: false,
            error:
              "Cette pièce jointe est indisponible ou vous n'avez plus l'autorisation de l'ouvrir.",
          });
        }
      } finally {
        refreshing = false;
      }
    };

    void refreshUrl();

    // Renouvelle le lien avant son expiration.
    const refreshDelay = Math.max(
      15,
      FEED_SIGNED_URL_SECONDS - 60,
    ) * 1000;

    const interval = window.setInterval(() => {
      void refreshUrl();
    }, refreshDelay);

    // Actualise aussi après un retour sur l'application.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshUrl();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [currentReference, attempt]);

  if (!currentReference) return null;

  const matchesReference = state.reference === currentReference;
  const loading = !matchesReference || state.loading;
  const url = matchesReference ? state.url : null;
  const error = matchesReference ? state.error : null;

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement de la pièce jointe…
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {error ?? "Pièce jointe indisponible."}
        </p>

        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </button>
      </div>
    );
  }

  if (isFeedPdf(currentReference)) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-3">
        <FileText className="h-5 w-5 shrink-0 text-primary" />

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          Voir le document PDF
        </a>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="space-y-2">
        <video
          key={url}
          controls
          preload="metadata"
          className="max-h-96 w-full rounded-lg bg-black"
        >
          <source src={url} />
          Votre navigateur ne prend pas en charge la lecture vidéo.
        </video>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Video className="h-4 w-4" />
          Ouvrir la vidéo
        </a>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={imageClassName}
      loading="lazy"
      onError={() => {
        setState({
          reference: currentReference,
          url: null,
          loading: false,
          error: "Impossible d'afficher cette image.",
        });
      }}
    />
  );
}