import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GroupsShell } from "@/components/GroupsShell";
import { PseudoForm } from "@/components/FeedView";
import { CharterCard } from "@/components/CommunityCharter";
import { SanctionsNotice } from "@/components/SanctionsNotice";
import { GroupInvitations } from "@/components/GroupInvitations";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Users, Plus, Lock, ChevronRight, KeyRound, Loader2, ArrowLeft, Ban, Inbox, Crown } from "lucide-react";

export const Route = createFileRoute("/groups/")({
  head: () => ({ meta: [{ title: "Mes groupes — DietFitPro" }] }),
  component: GroupsPage,
});

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
};

type BanRow = {
  user_id: string;
  reason: string | null;
  scope: "all" | "groups";
  created_at: string;
};

type AppealRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  message: string;
  created_at: string;
};

function GroupsPage() {
  return (
    <ProtectedRoute allow={["pro", "patient", "subscriber"]}>
      <GroupsShell>
        <GroupsContent />
      </GroupsShell>
    </ProtectedRoute>
  );
}

function GroupsContent() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [canParticipate, setCanParticipate] = useState(false);
  const [canCreateGroup, setCanCreateGroup] = useState(false);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [charterOk, setCharterOk] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [bans, setBans] = useState<BanRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [pseudos, setPseudos] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const userId = user?.id ?? "";
  const isPro = role === "pro";

  const load = useCallback(async () => {
    if (!userId) return;

    const [canRes, charterRes, groupsRes, pseudoRes, bansRes, appealsRes, badgeRes] = await Promise.all([
      supabase.rpc("can_participate_in_community", { p_user: userId }),
      supabase.rpc("has_accepted_charter", { p_user: userId }),
      supabase
        .from("feed_groups")
        .select("id, name, description, owner_id, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("community_profiles").select("pseudo").eq("user_id", userId).maybeSingle(),
      supabase
        .from("community_bans")
        .select("user_id, reason, scope, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("community_appeals")
        .select("id, user_id, group_id, message, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase.rpc("community_badges", { p_users: [userId] }),
    ]);

    setCanParticipate(canRes.data === true);
    setCharterOk(charterRes.data === true);
    setPseudo((pseudoRes.data as { pseudo: string } | null)?.pseudo ?? null);

    const badgeRows = (badgeRes.data ?? []) as { user_id: string; badge: string }[];
    const myBadge = badgeRows.find((badge) => badge.user_id === userId)?.badge;
    setCanCreateGroup(isPro || role === "patient" || myBadge === "premium");

    const list = (groupsRes.data ?? []) as GroupRow[];
    setGroups(list);

    const countMap: Record<string, number> = {};
    if (list.length > 0) {
      const { data: mData } = await supabase
        .from("feed_group_members")
        .select("group_id")
        .eq("status", "active")
        .in("group_id", list.map((g) => g.id));

      ((mData ?? []) as { group_id: string }[]).forEach((member) => {
        countMap[member.group_id] = (countMap[member.group_id] ?? 0) + 1;
      });
    }
    setCounts(countMap);

    const banList = (bansRes.data ?? []) as BanRow[];
    const appealList = (appealsRes.data ?? []) as AppealRow[];
    setBans(banList);
    setAppeals(appealList);

    const ids = Array.from(
      new Set([
        ...banList.map((ban) => ban.user_id),
        ...appealList.map((appeal) => appeal.user_id),
      ]),
    );

    const pseudoMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: pData } = await supabase
        .from("community_profiles")
        .select("user_id, pseudo")
        .in("user_id", ids);

      ((pData ?? []) as { user_id: string; pseudo: string }[]).forEach((profile) => {
        pseudoMap[profile.user_id] = profile.pseudo;
      });
    }
    setPseudos(pseudoMap);

    setLoading(false);
  }, [userId, isPro, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const cleanName = name.trim();

    if (cleanName.length < 3 || cleanName.length > 60) {
      setMsg("Le nom du groupe doit faire entre 3 et 60 caractères.");
      return;
    }

    setCreating(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("feed_groups")
      .insert({
        name: cleanName,
        description: description.trim() || null,
        owner_id: userId,
      })
      .select("id")
      .single();

    if (error || !data) {
      setMsg("Création impossible. Vous avez peut-être atteint la limite de 5 groupes.");
      setCreating(false);
      return;
    }

    setName("");
    setDescription("");
    setCreating(false);
    void navigate({
      to: "/groups/$groupId",
      params: { groupId: (data as { id: string }).id },
    });
  };

  const handleJoinByCode = () => {
    const raw = codeInput.trim();
    if (!raw) return;

    const match = raw.match(/code=([A-Za-z0-9]+)/);
    const code = (match ? match[1] : raw).trim();

    window.location.href = `/groups/join?code=${encodeURIComponent(code)}`;
  };

  const handleUnban = async (banUserId: string) => {
    if (!confirm("Lever le bannissement ? La personne retrouvera automatiquement ses groupes.")) return;

    setMsg(null);
    setNotice(null);

    const { error } = await supabase.rpc("unban_community_member", {
      p_user: banUserId,
    });

    if (error) {
      setMsg("Action impossible pour le moment.");
    } else {
      setNotice("Bannissement levé. La personne a été réintégrée dans ses groupes.");
    }

    await load();
  };

  const handleAnswerAppeal = async (appealId: string, accept: boolean) => {
    const response = window.prompt(
      accept
        ? "Message pour la personne (facultatif) :"
        : "Réponse à la personne (facultatif, mais recommandé) :",
      "",
    );

    if (response === null) return;

    setMsg(null);
    setNotice(null);

    const { error } = await supabase.rpc("answer_appeal", {
      p_appeal: appealId,
      p_accept: accept,
      p_response: response.trim() || null,
    });

    if (error) {
      setMsg(
        error.message.includes("already_handled")
          ? "Cette demande a déjà été traitée."
          : "Action impossible pour le moment.",
      );
    } else {
      setNotice(
        accept
          ? "Demande acceptée : la personne est réintégrée."
          : "Demande refusée : la personne a été prévenue.",
      );
    }

    await load();
  };

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const ownBan = bans.find((ban) => ban.user_id === userId);
  const otherBans = bans.filter((ban) => ban.user_id !== userId);

  const groupName = (id: string | null) =>
    id ? groups.find((group) => group.id === id)?.name ?? "Groupe" : null;

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {isPro ? "Tous les groupes" : "Mes groupes"}
        </h1>

        <Link
          to={role === "pro" ? "/pro/feed" : role === "patient" ? "/patient/feed" : "/feed"}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au feed
        </Link>
      </div>

      <SanctionsNotice />
      <GroupInvitations />

      {ownBan ? null : !canParticipate ? (
        <div className="flex items-start gap-2 rounded-xl border border-dashed bg-card px-4 py-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Les groupes sont réservés aux membres Premium et aux patients.</span>
        </div>
      ) : !pseudo ? (
        <div className="rounded-xl border bg-card p-4">
          <PseudoForm
            userId={userId}
            intro="Choisissez un pseudo pour rejoindre un groupe. Il sera visible par les autres membres, jamais votre nom."
            onDone={load}
          />
        </div>
      ) : !charterOk ? (
        <CharterCard userId={userId} onAccepted={load} />
      ) : (
        <>
          {canCreateGroup ? (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Créer un groupe
              </h2>

              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Nom du groupe (3 à 60 caractères)"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
              />

              <textarea
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={2}
                maxLength={300}
                placeholder="Description (facultatif)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {isPro ? "Pas de limite pour le coach" : "5 groupes maximum par personne"}
                </span>

                <button
                  onClick={() => void handleCreate()}
                  disabled={creating || name.trim().length < 3}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Créer
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
              <Crown className="h-5 w-5 shrink-0 text-primary" />

              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  La création de groupes est réservée aux membres Premium.
                </p>
                <p className="text-sm text-muted-foreground">
                  Vous pouvez toujours rejoindre un groupe, publier, commenter et encourager les autres membres.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Rejoindre un groupe
            </h2>

            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Collez le lien ou le code d'invitation"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleJoinByCode();
                }}
              />

              <button
                onClick={handleJoinByCode}
                disabled={!codeInput.trim()}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Continuer
              </button>
            </div>
          </div>
        </>
      )}

      {msg && <p className="text-sm text-red-500">{msg}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      {isPro && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Inbox className="h-4 w-4" /> Demandes de réintégration ({appeals.length})
          </h2>

          {appeals.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucune demande en attente.
            </div>
          ) : (
            <div className="space-y-2">
              {appeals.map((appeal) => (
                <div key={appeal.id} className="rounded-xl border bg-card p-4 space-y-2">
                  <p className="text-sm font-medium">
                    {pseudos[appeal.user_id] ?? "Membre sans pseudo"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {appeal.group_id
                        ? `Groupe « ${groupName(appeal.group_id)} »`
                        : "Bannissement de la communauté ou de tous les groupes"}
                      {" · "}
                      {new Date(appeal.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </p>

                  <p className="text-sm whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2">
                    {appeal.message}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void handleAnswerAppeal(appeal.id, true)}
                      className="rounded-lg px-3 py-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20"
                    >
                      Accepter et réintégrer
                    </button>

                    <button
                      onClick={() => void handleAnswerAppeal(appeal.id, false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-red-500 bg-red-50 hover:bg-red-100 dark:bg-green-900/20"
                    >
                      Refuser
                    </button>

                    {appeal.group_id && (
                      <Link
                        to="/groups/$groupId"
                        params={{ groupId: appeal.group_id }}
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                      >
                        Ouvrir le groupe
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canParticipate && !ownBan && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {groups.length} groupe{groups.length > 1 ? "s" : ""}
          </h2>

          {groups.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
              <Users className="h-9 w-9 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Aucun groupe pour le moment</p>
              <p className="text-sm mt-1">
                Rejoignez un groupe avec un lien d’invitation pour échanger avec la communauté.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  to="/groups/$groupId"
                  params={{ groupId: group.id }}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-all hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{group.name}</p>

                    {group.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {group.description}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-muted-foreground">
                      {counts[group.id] ?? 0} membre{(counts[group.id] ?? 0) > 1 ? "s" : ""}
                      {group.owner_id === userId ? " · Vous êtes le propriétaire" : ""}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {isPro && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Ban className="h-4 w-4" /> Personnes bannies ({otherBans.length})
          </h2>

          {otherBans.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucune personne bannie.
            </div>
          ) : (
            <div className="space-y-2">
              {otherBans.map((ban) => (
                <div
                  key={ban.user_id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {pseudos[ban.user_id] ?? "Membre sans pseudo"}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {ban.scope === "groups"
                        ? "Banni de tous les groupes"
                        : "Banni de la communauté"}{" "}
                      · depuis le {new Date(ban.created_at).toLocaleDateString("fr-FR")}
                      {ban.reason ? ` · ${ban.reason}` : ""}
                    </p>
                  </div>

                  <button
                    onClick={() => void handleUnban(ban.user_id)}
                    title="Lève le bannissement et remet la personne dans ses groupes, automatiquement."
                    className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Lever et réintégrer
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}