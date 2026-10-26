import { supabase } from "@/lib/supabase";

export const FEED_BUCKET = "feed";

// Un lien obtenu reste valable 5 minutes.
export const FEED_SIGNED_URL_SECONDS = 5 * 60;

const STORAGE_PREFIXES = [
  "/storage/v1/object/public/feed/",
  "/storage/v1/object/sign/feed/",
  "/storage/v1/object/authenticated/feed/",
];

/**
 * Récupère le chemin d'un fichier du bucket feed.
 *
 * Accepte :
 * - une ancienne adresse publique ;
 * - une adresse signée ;
 * - une adresse authentifiée ;
 * - un chemin relatif : user-id/fichier.pdf.
 *
 * Refuse les adresses externes au projet Supabase.
 */
export function getFeedStoragePath(
  reference: string | null | undefined,
): string | null {
  const value = reference?.trim();

  if (!value) return null;

  const isAbsoluteUrl = /^https?:\/\//i.test(value);

  if (isAbsoluteUrl) {
    try {
      const url = new URL(value);
      const { data } = supabase.storage
        .from(FEED_BUCKET)
        .getPublicUrl("__origin_check__");

      const projectOrigin = new URL(data.publicUrl).origin;

      if (url.origin !== projectOrigin) return null;

      const prefix = STORAGE_PREFIXES.find((candidate) =>
        url.pathname.startsWith(candidate),
      );

      if (!prefix) return null;

      const encodedPath = url.pathname.slice(prefix.length);
      return validatePath(decodeURIComponent(encodedPath));
    } catch {
      return null;
    }
  }

  // Refuse les autres protocoles et les chemins absolus.
  if (
    value.includes("://") ||
    value.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return null;
  }

  return validatePath(value);
}

function validatePath(path: string): string | null {
  if (
    !path ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#") ||
    /[\u0000-\u001F\u007F]/.test(path)
  ) {
    return null;
  }

  const segments = path.split("/");

  if (
    segments.length < 2 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === "..",
    )
  ) {
    return null;
  }

  return path;
}

/**
 * Détermine si la référence correspond à un PDF.
 * Fonctionne aussi avec une URL contenant un token.
 */
export function isFeedPdf(
  reference: string | null | undefined,
): boolean {
  const path = getFeedStoragePath(reference);
  return path?.toLowerCase().endsWith(".pdf") ?? false;
}

/**
 * Obtient un lien temporaire pour un fichier.
 *
 * L'autorisation réelle dépend des règles Supabase Storage.
 * Aucun retour automatique vers une adresse publique.
 */
export async function createFeedSignedUrl(
  reference: string | null | undefined,
): Promise<string | null> {
  if (!reference?.trim()) return null;

  const path = getFeedStoragePath(reference);

  if (!path) {
    throw new Error("Référence de pièce jointe non reconnue.");
  }

  const { data, error } = await supabase.storage
    .from(FEED_BUCKET)
    .createSignedUrl(path, FEED_SIGNED_URL_SECONDS);

  if (error) {
    throw new Error(
      "Impossible d'ouvrir cette pièce jointe : accès refusé ou fichier indisponible.",
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      "Aucun lien temporaire reçu pour cette pièce jointe.",
    );
  }

  return data.signedUrl;
}