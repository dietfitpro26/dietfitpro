import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jafjqbbzzbanpgsfbopm.supabase.co";
const supabaseAnonKey = "sb_publishable_5Qh1IIHaVswL0-beqjllsA_AHNtE-U4";

export const isSupabaseConfigured = true;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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
