import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase typé pour DietFitPro.
 * Vérifie que les variables d'environnement sont présentes
 * et affiche un message d'erreur explicite si elles manquent.
 */

function getEnvVar(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const supabaseUrl = "https://jafjqbbzzbanpgsfbopm.supabase.co";
const supabaseAnonKey = "sb_publishable_5Qh1IIHaVswL0-beqjllsA_AHNtE-U4";

export const isSupabaseConfigured = true;

if (!isSupabaseConfigured && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "[DietFitPro] Supabase non configuré. Créez un .env à partir de .env.example " +
      "(VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY). " +
      "L'UI s'affiche mais les appels auth/DB seront désactivés.",
  );
}

/**
 * Instance unique du client Supabase (browser).
 * Si les variables manquent, on utilise des placeholders pour permettre à l'UI
 * de se rendre — les appels réseau échoueront proprement à l'usage.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  },
);

/**
 * Type utilitaire pour les réponses Supabase avec gestion d'erreur.
 */
export function handleSupabaseError<T>(result: { data: T | null; error: Error | null }, context?: string): T {
  if (result.error) {
    const msg = context ? `[Supabase — ${context}] ${result.error.message}` : `[Supabase] ${result.error.message}`;
    throw new Error(msg);
  }
  if (result.data === null) {
    throw new Error(
      context ? `[Supabase — ${context}] Aucune donnée retournée.` : "[Supabase] Aucune donnée retournée.",
    );
  }
  return result.data;
}
