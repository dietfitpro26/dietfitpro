import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationType } from "@/lib/notifications";

export interface AppNotification {
  id: string;
  user_id: string;
  channel: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  sent_at: string | null;
  scheduled_for: string;
  created_at: string;
  payload: Record<string, unknown> | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("channel", "in_app")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[useNotifications]", error);
      setItems([]);
      return;
    }
    setItems((data ?? []) as AppNotification[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void load();

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`notif:${user.id}:${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scheduled_notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();

    channelRef.current = channel;
    const interval = setInterval(() => void load(), 60_000);

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(interval);
    };
  }, [user]);

  const unreadCount = items?.filter((n) => !n.read_at).length ?? 0;

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from("scheduled_notifications")
      .update({ read_at: new Date().toISOString() }).eq("id", id);
    void load();
  }, [load]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("scheduled_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("channel", "in_app").is("read_at", null);
    void load();
  }, [user, load]);

  return { items, unreadCount, reload: load, markAsRead, markAllAsRead };
}