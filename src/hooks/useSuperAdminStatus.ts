import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export type SuperAdminStatus = "checking" | "confirmed" | "denied";

export function useSuperAdminStatus() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SuperAdminStatus>("checking");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    if (authLoading) {
      setStatus("checking");
      return () => {
        active = false;
      };
    }

    if (!user?.id) {
      setStatus("denied");
      return () => {
        active = false;
      };
    }

    setStatus("checking");
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("is_current_super_admin");
        if (active) setStatus(!error && data === true ? "confirmed" : "denied");
      } catch {
        if (active) setStatus("denied");
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, retryKey]);

  return { status, retry: () => setRetryKey((key) => key + 1) };
}
