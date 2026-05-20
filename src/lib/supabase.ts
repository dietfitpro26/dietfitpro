import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase typé pour DietFitPro.
 * Vérifie que les variables d'environnement sont présentes
 * et affiche un message d'erreur explicite si elles manquent.
 */

function getEnvVar(name: string): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== "string") {
    throw new Error(
      `[DietFitPro] Variable d'environnement manquante : ${name}\n` +
        `→ Créez un fichier .env à la racine en copiant .env.example\n` +
        `→ Renseignez ${name} avec la valeur de votre projet Supabase.`
    );
  }
  return value;
}

const supabaseUrl = getEnvVar("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY");

/**
 * Instance unique du client Supabase (browser).
 * Persiste la session via le stockage local du navigateur.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Type utilitaire pour les réponses Supabase avec gestion d'erreur.
 */
export function handleSupabaseError<T>(
  result: { data: T | null; error: Error | null },
  context?: string
): T {
  if (result.error) {
    const msg = context
      ? `[Supabase — ${context}] ${result.error.message}`
      : `[Supabase] ${result.error.message}`;
    throw new Error(msg);
  }
  if (result.data === null) {
    throw new Error(
      context ? `[Supabase — ${context}] Aucune donnée retournée.` : "[Supabase] Aucune donnée retournée."
    );
  }
  return result.data;
}
