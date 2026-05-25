import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, FileText, Check, CheckCheck, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, useConversation, type Conversation } from "@/hooks/useMessages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string) {
  const src = name?.trim() || email;
  return src
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return conversations;
    return conversations.filter((c) =>
      (c.partner.full_name ?? c.partner.email).toLowerCase().includes(t),
    );
  }, [q, conversations]);

  return (
    <div className="flex h-full flex-col border-r bg-background">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="pl-8 h-9"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">
            Aucune conversation
          </div>
        )}
        {filtered.map((c) => {
          const active = c.partner.id === activeId;
          const name = c.partner.full_name ?? c.partner.email;
          return (
            <button
              key={c.partner.id}
              onClick={() => onSelect(c.partner.id)}
              className={cn(
                "w-full text-left flex items-center gap-3 px-3 py-3 border-b hover:bg-muted/50 transition",
                active && "bg-muted",
              )}
            >
              <Avatar className="h-10 w-10">
                {c.partner.avatar_url && <AvatarImage src={c.partner.avatar_url} alt={name} />}
                <AvatarFallback>{initials(c.partner.full_name, c.partner.email)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTime(c.lastMessage.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "text-xs truncate flex-1",
                      c.unreadCount > 0 ? "text-foreground font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {c.lastMessage.attachment_url && !c.lastMessage.content
                      ? "📎 Pièce jointe"
                      : c.lastMessage.content}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#6DB33F] text-white text-[10px] font-semibold flex items-center justify-center">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatPane({ partner }: { partner: Conversation["partner"] | null }) {
  const { user } = useAuth();
  const { messages, sendMessage } = useConversation(partner?.id ?? null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!partner) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Sélectionnez une conversation
      </div>
    );
  }

  const handleSend = async () => {
    if (sending) return;
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      await sendMessage(text, file);
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSending(false);
    }
  };

  const name = partner.full_name ?? partner.email;

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <header className="h-14 px-4 flex items-center gap-3 border-b bg-background">
        <Avatar className="h-9 w-9">
          {partner.avatar_url && <AvatarImage src={partner.avatar_url} alt={name} />}
          <AvatarFallback>{initials(partner.full_name, partner.email)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground capitalize">{partner.role}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.sender_id !== m.sender_id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm text-sm",
                  mine ? "bg-[#6DB33F] text-white rounded-br-sm" : "bg-background border rounded-bl-sm",
                  !showAvatar && "mt-0.5",
                )}
              >
                {m.attachment_url && (
                  <a
                    href={m.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "flex items-center gap-2 mb-1 underline-offset-2 hover:underline",
                      mine ? "text-white" : "text-foreground",
                    )}
                  >
                    {m.attachment_type?.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.attachment_url}
                        alt={m.attachment_name ?? "Image"}
                        className="rounded-md max-h-56 object-cover"
                      />
                    ) : (
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {m.attachment_name ?? "Pièce jointe"}
                      </span>
                    )}
                  </a>
                )}
                {m.content && m.content !== m.attachment_name && (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
                <div
                  className={cn(
                    "flex items-center justify-end gap-1 mt-1 text-[10px]",
                    mine ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  <span>{formatTime(m.created_at)}</span>
                  {mine &&
                    (m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t bg-background">
        {file && (
          <div className="mb-2 flex items-center gap-2 text-xs bg-muted px-2 py-1 rounded">
            <FileText className="h-3 w-3" />
            <span className="truncate flex-1">{file.name}</span>
            <button
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Pièce jointe"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Votre message…"
            className="min-h-[40px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={() => void handleSend()} disabled={sending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MessagesView() {
  const { conversations } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].partner.id);
    }
  }, [conversations, activeId]);

  const active = conversations.find((c) => c.partner.id === activeId)?.partner ?? null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <aside className="w-full max-w-xs hidden md:block">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </aside>
      {/* Mobile: list OR chat */}
      <div className="md:hidden flex-1">
        {active ? (
          <div className="h-full flex flex-col">
            <button
              onClick={() => setActiveId(null)}
              className="text-xs px-3 py-2 border-b text-muted-foreground"
            >
              ← Conversations
            </button>
            <ChatPane partner={active} />
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
          />
        )}
      </div>
      <div className="hidden md:flex flex-1">
        <ChatPane partner={active} />
      </div>
    </div>
  );
}
