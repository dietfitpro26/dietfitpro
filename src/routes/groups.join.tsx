import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GroupsShell } from "@/components/GroupsShell";
import { PseudoForm } from "@/components/FeedView";
import { CharterCard } from "@/components/CommunityCharter";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Users, Lock, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/groups/join")({
  head: () => ({ meta: [{ title: "Rejoindre un groupe — DietFitPro" }] }),
  component: JoinPage,
});

type Preview = {
  id: string;
  name: string;
  description: string | null;
  members: number;
};

function JoinPage() {
  return (
    <ProtectedRoute allow={["pro", "patient", "subscriber"]}>
      <GroupsShell>
        <JoinContent />
      </GroupsShell>
    </ProtectedRoute>
  );
}

function JoinContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [canParticipate, setCanParticipate] = useState(false);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [charterOk, setCharterOk] = useState(false);
  const [joining, setJoining] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const userId = user?.id ?? "";

  const load = useCallback(async () => {
    if (!userId) return;

    const currentCode = new URLSearchParams(window.location.search).get("code") ?? "";
    setCode(currentCode);

    const [canRes, charterRes, pseudoRes, previewRes] = await Promise.all([
      supabase.rpc("can_participate_in_community", { p_user: userId }),
      supabase.rpc("has_accepted_charter", { p_user: userId }),
      supabase.from("community_profiles").select("pseudo").eq("user_id", userId).maybeSingle(),
      currentCode
        ? supabase.rpc("preview_group_by_code", { p_code: currentCode })
        : Promise.resolve({ data: [] as Preview[] }),
    ]);

    setCanParticipate(canRes.data === true);
    setCharterOk(charterRes.data === true);
    setPseudo((pseudoRes.data as { pseudo: string } | null)?.pseudo ?? null);

    const rows = (previewRes.data ?? []) as Preview[];
    setPreview(rows.length > 0 ? { ...rows[0], members: Number(rows[0].members) } : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJoin = async () => {
    setJoining(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("join_group_by_code", { p_code: code });

    if (error) {
      const text = error.message ?? "";
      if (text.includes("group_full")) setMsg("Ce groupe est complet (200 membres maximum).");
      else if (text.includes("invalid_code")) setMsg("Ce lien d'invitation n'est plus valide.");
      else if (text.includes("pseudo_required")) setMsg("Choisissez d'abord un pseudo.");
      else if (text.includes("charter_required")) setMsg("Vous devez d'abord accepter la charte.");
      else if (text.includes("banned_from_group")) setMsg("Vous n'avez pas accès à ce groupe.");
      else if (text.includes("not_allowed")) setMsg("Les groupes sont réservés aux membres Premium et aux patients.");
      else setMsg("Impossible de rejoindre le groupe pour le moment.");
      setJoining(false);
      return;
    }

    void navigate({ to: "/groups/$groupId", params: { groupId: data as string } });
  };

  if (loading) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <Link to="/groups" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Mes groupes
      </Link>

      {!preview ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          <p className="font-medium">Lien d'invitation invalide</p>
          <p className="text-sm mt-1">Le lien a expiré ou a été désactivé. Demandez-en un nouveau.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Vous êtes invité à rejoindre</p>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> {preview.name}
            </h1>
            {preview.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{preview.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {preview.members} membre{preview.members > 1 ? "s" : ""}
            </p>
          </div>

          {!canParticipate ? (
            <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Les groupes sont réservés aux membres Premium et aux patients.</span>
            </div>
          ) : !pseudo ? (
            <PseudoForm
              userId={userId}
              intro="Choisissez un pseudo pour rejoindre le groupe. Il sera visible par les autres membres, jamais votre nom."
              onDone={load}
            />
          ) : !charterOk ? (
            <CharterCard userId={userId} onAccepted={load} />
          ) : (
            <button
              onClick={() => void handleJoin()}
              disabled={joining}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
            >
              {joining && <Loader2 className="h-4 w-4 animate-spin" />}
              Rejoindre le groupe
            </button>
          )}

          {msg && <p className="text-sm text-red-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}