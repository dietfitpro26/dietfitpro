import { useCallback, useEffect, useState } from "react";
import type { AuthResponse, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "pro" | "patient" | "subscriber";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  locale: string;
  plan: "basic" | "premium" | "visio" | "patient";
  subscription_status:
    | "active"
    | "cancelled"
    | "past_due"
    | "trialing"
    | "none";
  pro_id: string | null;

  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  goal: string | null;
  target_weight_kg: number | null;
  target_bmi: number | null;
  daily_kcal_target: number | null;
  
  // ✅ Nouveau champ ajouté
  profile_complete: boolean | null;
}

export interface SignUpMetadata {
  full_name?: string;
  role?: AppRole;
  [key: string]: unknown;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    loading: true,
  });

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setState({
        user: null,
        profile: null,
        role: null,
        loading: false,
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[useAuth] Erreur lecture profiles :", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        setState({
          user,
          profile: null,
          role: null,
          loading: false,
        });

        return;
      }

      const profile = data as Profile | null;

      setState({
        user,
        profile,
        role: profile?.role ?? null,
        loading: false,
      });
    } catch (error) {
      console.error("[useAuth] Erreur inattendue pendant le chargement du profil :", error);

      setState({
        user,
        profile: null,
        role: null,
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      window.setTimeout(() => {
        if (!mounted) return;
        void loadProfile(session?.user ?? null);
      }, 0);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.error("[useAuth] Erreur getSession :", error);

          setState((current) => ({
            ...current,
            loading: false,
          }));

          return;
        }

        void loadProfile(data.session?.user ?? null);
      })
      .catch((error) => {
        if (!mounted) return;

        console.error("[useAuth] Erreur inattendue getSession :", error);

        setState((current) => ({
          ...current,
          loading: false,
        }));
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      console.error("[useAuth] Erreur signIn :", {
        message: error.message,
        status: error.status,
        code: error.code,
      });

      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata: SignUpMetadata = {},
    ): Promise<AuthResponse> => {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: metadata,
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/login`
              : undefined,
        },
      });

      if (error) {
        console.error("[useAuth] Erreur signUp :", {
          message: error.message,
          status: error.status,
          code: error.code,
        });

        throw error;
      }

      return {
        data,
        error: null,
      };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[useAuth] Erreur signOut :", {
        message: error.message,
        status: error.status,
        code: error.code,
      });

      throw error;
    }

    setState({
      user: null,
      profile: null,
      role: null,
      loading: false,
    });
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
  };
}