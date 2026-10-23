import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PseudoForm } from "@/components/FeedView";
import { CharterCard } from "@/components/CommunityCharter";
import { Mail, Loader2 } from "lucide-react";

type Invitation = {
  group_id: string;
  group_name: string;
  description: string | null;
  invited_at: string;
};

export function GroupInvitations() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<Invitation[]>([]);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [charterOk, setCharterOk] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const userId = user?.id ?? "";

  const load = useCallback(async () => {
    if (!userId) return;

    const [invRes, pseudoRes, charterRes] = await Promise.all([
      supabase.rpc("my_group_invitations"),
      supabase.from("community_profiles").select("pseudo").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_accepted_charter", { p_user: userId }),
    ]);

    setItems((invRes.data ?? []) as Invitation[]);
    setPseudo((pseudoRes.data as { pseudo: string } | null)?.pseudo ?? null);
    setCharterOk(charterRes.data === true);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (groupId: string, accept: boolean) => {
    setBusyId(groupId);
    setMsg(null);

    const { error } = await supabase.rpc("respond_group_invitation", {
      p_group: groupId,
      p_accept: accept,
    });

    if (error) {
      const text = error.message ?? "";
      if (text.includes("pseudo_required")) setMsg("Choisissez d'abord un pseudo.");
      else if (text.includes("charter_required")) setMsg("Vous devez d'abord accepter la charte.");
      else if (text.includes("banned")) setMsg("Vous n'avez pas accès à ce groupe.");
      else if (text.includes("not_allowed")) setMsg("Vous ne pouvez pas rejoindre un groupe pour le moment.");
      else if (text.includes("no_invitation")) setMsg("Cette invitation n'existe plus.");
      else setMsg("Action impossible pour le moment.");
      setBusyId(null);
      await load();
      return;
    }

    setBusyId(null);

    if (accept) {
      void navigate({ to: "/groups/$groupId", params: { groupId } });
    } else {
      await load();
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((inv) => (
        <div key={inv.group_id} className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Le coach vous invite à rejoindre le groupe « {inv.group_name} »
              </p>
              {inv.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{inv.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Vous n'avez accès au groupe qu'après avoir accepté.
              </p>
            </div>
          </div>

          {!pseudo ? (
            <PseudoForm
              userId={userId}
              intro="Choisissez un pseudo pour rejoindre le groupe. Il sera visible par les autres membres, jamais votre nom."
              onDone={load}
            />
          ) : !charterOk ? (
            <CharterCard userId={userId} onAccepted={load} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void respond(inv.group_id, true)}
                disabled={busyId === inv.group_id}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm disabled:opacity-50"
              >
                {busyId === inv.group_id && <Loader2 className="h-4 w-4 animate-spin" />}
                Accepter
              </button>
              <button
                onClick={() => void respond(inv.group_id, false)}
                disabled={busyId === inv.group_id}
                className="rounded-lg border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Refuser
              </button>
            </div>
          )}
        </div>
      ))}

      {msg && <p className="text-sm text-red-500">{msg}</p>}
    </div>
  );
}