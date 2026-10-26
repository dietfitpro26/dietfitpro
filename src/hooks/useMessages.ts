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
  /** true = contact proposé sans message échangé (permet d'écrire le premier message). */
  isPlaceholder?: boolean;
}


export interface DeleteConversationResult {
  deletedMessages: number;
  filesTotal: number;
  filesRemoved: number;
}


const EMPTY_MESSAGE: Message = {
  id: "",
  sender_id: "",
  recipient_id: "",
  content: "",
  attachment_url: null,
  attachment_name: null,
  attachment_type: null,
  read_at: null,
  created_at: "",
};


/** Retrouve le chemin du fichier dans le stockage à partir de l'URL signée (ou du chemin brut). */
function extractStoragePath(value: string | null): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value;
  const match = value.match(/\/message-attachments\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}


/** Charge la liste des conversations groupées par interlocuteur. */
export function useConversations() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userRole = profile?.role ?? null;
  const userProId = profile?.pro_id ?? null;


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


    // Contacts proposés même sans message : le pro voit ses patients, le patient voit son pro.
    const contactIds = new Set<string>();
    if (userRole === "pro") {
      const { data: pats } = await supabase
        .from("patients")
        .select("user_id")
        .eq("pro_id", user.id)
        .not("user_id", "is", null);
      for (const p of (pats ?? []) as { user_id: string | null }[]) {
        if (p.user_id) contactIds.add(p.user_id);
      }
    } else if (userProId) {
      contactIds.add(userProId);
    }
    contactIds.delete(user.id);


    const ids = Array.from(new Set([...byPartner.keys(), ...contactIds]));
    if (ids.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }


    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .in("id", ids);
    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id as string, p as Record<string, unknown>]),
    );


    // Un patient ne peut pas lire directement le profil de son pro : on passe par la fonction dédiée.
    if (userRole !== "pro" && userProId && !profileMap.has(userProId)) {
      const { data: proRows } = await supabase.rpc("get_my_pro");
      const proRow = (proRows as Record<string, unknown>[] | null)?.[0];
      if (proRow?.id) profileMap.set(proRow.id as string, proRow);
    }


    const list: Conversation[] = ids
      .map((id) => {
        const entry = byPartner.get(id);
        const p = profileMap.get(id);
        return {
          partner: {
            id,
            full_name: (p?.full_name as string | null | undefined) ?? null,
            email: (p?.email as string | undefined) ?? "",
            avatar_url: (p?.avatar_url as string | null | undefined) ?? null,
            role: (p?.role as string | undefined) ?? "patient",
          },
          lastMessage: entry?.last ?? EMPTY_MESSAGE,
          unreadCount: entry?.unread ?? 0,
          isPlaceholder: !entry,
        };
      })
      .sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
    setConversations(list);
    setLoading(false);
  }, [user, userRole, userProId]);


  const loadRef = useRef(load);
  loadRef.current = load;


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
        () => void loadRef.current(),
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


  /** Supprime toute la conversation (messages + fichiers joints). Réservé au professionnel. */
  const deleteConversation = useCallback(
    async (partnerId: string): Promise<DeleteConversationResult> => {
      if (!user) throw new Error("Session expirée, reconnectez-vous.");
      const pair = `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`;


      const { data: rows, error: readError } = await supabase
        .from("messages")
        .select("id, attachment_url")
        .or(pair);
      if (readError) throw readError;


      const messageRows = (rows ?? []) as { id: string; attachment_url: string | null }[];
      const paths = Array.from(
        new Set(
          messageRows
            .map((m) => extractStoragePath(m.attachment_url))
            .filter((p): p is string => Boolean(p)),
        ),
      );


      // 1) Les fichiers d'abord (leur suppression dépend de l'existence des messages)
      let filesRemoved = 0;
      if (paths.length > 0) {
        const { data: removed, error: removeError } = await supabase.storage
          .from("message-attachments")
          .remove(paths);
        if (removeError) {
          console.error("[deleteConversation storage]", removeError);
        } else {
          filesRemoved = removed?.length ?? 0;
        }
      }


      // 2) Puis les messages
      const { error: deleteError } = await supabase.from("messages").delete().or(pair);
      if (deleteError) throw deleteError;


      await load();
      return { deletedMessages: messageRows.length, filesTotal: paths.length, filesRemoved };
    },
    [user, load],
  );


  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  return { conversations, loading, totalUnread, reload: load, deleteConversation };
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
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const removedId = (payload.old as { id?: string } | null)?.id;
          if (!removedId) return;
          setMessages((prev) => prev.filter((x) => x.id !== removedId));
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
      // Rafraîchit la conversation tout de suite (utile si le temps réel est lent).
      await load();
    },
    [user, partnerId, load],
  );


  return { messages, loading, sendMessage };
}