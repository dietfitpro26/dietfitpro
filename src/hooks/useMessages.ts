import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ConversationPartner {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
}

export interface Conversation {
  partner: ConversationPartner;
  lastMessage: Message;
  unreadCount: number;
}

/** Charge la liste des conversations groupées par interlocuteur. */
export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[useConversations]", error);
      setLoading(false);
      return;
    }
    const byPartner = new Map<string, { last: Message; unread: number }>();
    for (const m of (msgs ?? []) as Message[]) {
      const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const entry = byPartner.get(partnerId);
      const isUnread = m.recipient_id === user.id && m.read_at === null;
      if (!entry) {
        byPartner.set(partnerId, { last: m, unread: isUnread ? 1 : 0 });
      } else if (isUnread) {
        entry.unread += 1;
      }
    }
    const ids = Array.from(byPartner.keys());
    if (ids.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    const list: Conversation[] = ids
      .map((id) => {
        const entry = byPartner.get(id)!;
        const p = profileMap.get(id);
        return {
          partner: {
            id,
            full_name: p?.full_name ?? null,
            email: p?.email ?? "",
            avatar_url: p?.avatar_url ?? null,
            role: p?.role ?? "patient",
          },
          lastMessage: entry.last,
          unreadCount: entry.unread,
        };
      })
      .sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
    setConversations(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime — corrigé avec useRef pour éviter le double subscribe
  useEffect(() => {
    if (!user) return;
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase
      .channel(`messages_list:${user.id}:${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => void load(),
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  return { conversations, loading, totalUnread, reload: load };
}

/** Hook ciblé sur une conversation (1‑à‑1). */
export function useConversation(partnerId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const threadChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!user || !partnerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) {
      console.error("[useConversation]", error);
      setLoading(false);
      return;
    }
    setMessages((data ?? []) as Message[]);
    setLoading(false);
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id)
      .eq("sender_id", partnerId)
      .is("read_at", null);
  }, [user, partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime — corrigé avec useRef pour éviter le double subscribe
  useEffect(() => {
    if (!user || !partnerId) return;
    if (threadChannelRef.current) {
      void supabase.removeChannel(threadChannelRef.current);
      threadChannelRef.current = null;
    }
    const channel = supabase
      .channel(`messages_thread:${user.id}:${partnerId}:${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThread =
            (m.sender_id === user.id && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === user.id);
          if (!inThread) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.recipient_id === user.id && m.read_at === null) {
            void supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", m.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .subscribe();
    threadChannelRef.current = channel;
    return () => {
      if (threadChannelRef.current) {
        void supabase.removeChannel(threadChannelRef.current);
        threadChannelRef.current = null;
      }
    };
  }, [user, partnerId]);

  const sendMessage = useCallback(
    async (content: string, file?: File | null) => {
      if (!user || !partnerId) return;
      let attachment_url: string | null = null;
      let attachment_name: string | null = null;
      let attachment_type: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("message-attachments")
          .upload(path, file, { contentType: file.type });
        if (up.error) {
          console.error("[sendMessage upload]", up.error);
          throw up.error;
        }
        const signed = await supabase.storage
          .from("message-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        attachment_url = signed.data?.signedUrl ?? path;
        attachment_name = file.name;
        attachment_type = file.type;
      }
      const trimmed = content.trim();
      if (!trimmed && !attachment_url) return;
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: partnerId,
        content: trimmed || (attachment_name ?? ""),
        attachment_url,
        attachment_name,
        attachment_type,
      });
      if (error) {
        console.error("[sendMessage insert]", error);
        throw error;
      }
    },
    [user, partnerId],
  );

  return { messages, loading, sendMessage };
}