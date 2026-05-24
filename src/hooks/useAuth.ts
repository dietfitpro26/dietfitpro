import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
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
  subscription_status: "active" | "cancelled" | "past_due" | "trialing" | "none";
  pro_id: string | null;
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
    try {
      if (!user) {
        setState({ user: null, profile: null, role: null, loading: false });
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[useAuth] loadProfile error", error);
        setState({ user, profile: null, role: null, loading: false });
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
      console.error("[useAuth] loadProfile catch", error);
      setState({ user, profile: null, role: null, loading: false });
    }
  }, []);

  useEffect(() => {
    try {
      // Listener FIRST (avoid race), then getSession.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        // Defer Supabase calls to avoid deadlocks inside the callback.
        setTimeout(() => {
          try {
            void loadProfile(session?.user ?? null);
          } catch (error) {
            console.error("[useAuth] onAuthStateChange deferred catch", error);
          }
        }, 0);
      });

      supabase.auth
        .getSession()
        .then(({ data }) => {
          void loadProfile(data.session?.user ?? null);
        })
        .catch((error) => {
          console.error("[useAuth] getSession catch", error);
          setState((current) => ({ ...current, loading: false }));
        });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error("[useAuth] useEffect setup catch", error);
      setState((current) => ({ ...current, loading: false }));
      return undefined;
    }
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      console.error("[useAuth] signIn catch", error);
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, metadata: SignUpMetadata = {}) => {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
      } catch (error) {
        console.error("[useAuth] signUp catch", error);
        throw error;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("[useAuth] signOut catch", error);
      throw error;
    }
  }, []);

  return { ...state, signIn, signUp, signOut };
}
