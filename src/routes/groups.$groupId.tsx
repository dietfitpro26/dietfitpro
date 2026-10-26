import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GroupsShell } from "@/components/GroupsShell";
import { FeedView, TierBadge } from "@/components/FeedView";
import { InviteFromList } from "@/components/InviteFromList";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  Users,
  ArrowLeft,
  Link2,
  Check,
  RefreshCw,
  Trash2,
  LogOut,
  UserMinus,
  Power,
  Ban,
  ShieldOff,
  Crown,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/groups/$groupId")({
  head: () => ({ meta: [{ title: "Groupe — DietFitPro" }] }),
  component: GroupPage,
});

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  invite_code: string;
  invite_enabled: boolean;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  role: "owner" | "member";
  created_at: string;
};

type GroupBanRow = {
  user_id: string;
  reason: string | null;
  created_at: string;
};

type AppealRow = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
};

function GroupPage() {
  return (
    <ProtectedRoute allow={["pro", "patient", "subscriber"]}>
      <GroupsShell>
        <GroupContent />
      </GroupsShell>
    </ProtectedRoute>
  );
}

function GroupContent() {
  const { groupId } = Route.useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groupBans, setGroupBans] = useState<GroupBanRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [pseudos, setPseudos] = useState<Record<string, string>>({});
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "members">("posts");
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const userId = user?.id ?? "";
  const isPro = role === "pro";

  const load = useCallback(async () => {
    const { data: g } = await supabase
      .from("feed_groups")
      .select(
        "id, name, description, owner_id, invite_code, invite_enabled, created_at",
      )
      .eq("id", groupId)
      .maybeSingle();

    if (!g) {
      setGroup(null);
      setLoading(false);
      return;
    }

    setGroup(g as GroupRow);

    const [{ data: mData }, { data: bData }, { data: aData }] =
      await Promise.all([
        supabase
          .from("feed_group_members")
          .select("user_id, role, created_at")
          .eq("group_id", groupId)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
        supabase
          .from("feed_group_bans")
          .select("user_id, reason, created_at")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        supabase
          .from("community_appeals")
          .select("id, user_id, message, created_at")
          .eq("group_id", groupId)
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ]);

    const list = (mData ?? []) as MemberRow[];
    const banList = (bData ?? []) as GroupBanRow[];
    const appealList = (aData ?? []) as AppealRow[];

    setMembers(list);
    setGroupBans(banList);
    setAppeals(appealList);

    const allIds = Array.from(
      new Set([
        ...list.map((m) => m.user_id),
        ...banList.map((b) => b.user_id),
        ...appealList.map((a) => a.user_id),
      ]),
    );

    if (allIds.length > 0) {
      const [{ data: pData }, { data: bgData }] = await Promise.all([
        supabase
          .from("community_profiles")
          .select("user_id, pseudo")
          .in("user_id", allIds),
        supabase.rpc("community_badges", { p_users: allIds }),
      ]);

      const map: Record<string, string> = {};

      ((pData ?? []) as { user_id: string; pseudo: string }[]).forEach(
        (p) => {
          map[p.user_id] = p.pseudo;
        },
      );

      setPseudos(map);

      const bMap: Record<string, string> = {};

      ((bgData ?? []) as { user_id: string; badge: string }[]).forEach(
        (b) => {
          bMap[b.user_id] = b.badge;
        },
      );

      setBadges(bMap);
    }

    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <div className="h-28 rounded-xl bg-muted animate-pulse" />
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Link
          to="/groups"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Mes groupes
        </Link>

        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          <p className="font-medium">Groupe introuvable</p>
          <p className="text-sm mt-1">
            Il n'existe plus, ou vous n'en faites pas partie.
          </p>
        </div>
      </div>
    );
  }

  const isOwner = group.owner_id === userId;
  const canManage = isOwner || isPro;
  const isMember = members.some((m) => m.user_id === userId);
  const inviteLink = `${window.location.origin}/groups/join?code=${group.invite_code}`;

  const resetMessages = () => {
    setMsg(null);
    setNotice(null);
  };

  const handleCopyInvite = async () => {
    resetMessages();

    const nav = window.navigator as Navigator & {
      share?: (data: {
        title?: string;
        text?: string;
        url?: string;
      }) => Promise<void>;
    };

    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: group.name,
          text: `Rejoins le groupe « ${group.name} » sur DietFitPro`,
          url: inviteLink,
        });
      } catch {
        // Partage annulé.
      }

      return;
    }

    try {
      await window.navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Impossible de copier le lien.");
    }
  };

  const handleToggleInvite = async () => {
    resetMessages();

    const { error } = await supabase
      .from("feed_groups")
      .update({ invite_enabled: !group.invite_enabled })
      .eq("id", group.id);

    if (error) setMsg("Action impossible pour le moment.");

    await load();
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        "Générer un nouveau lien ? L'ancien lien ne fonctionnera plus.",
      )
    ) {
      return;
    }

    resetMessages();

    const { error } = await supabase.rpc("regenerate_invite_code", {
      p_group: group.id,
    });

    if (error) setMsg("Action impossible pour le moment.");

    await load();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (
      !confirm(
        "Retirer ce membre du groupe ? Il pourra le rejoindre à nouveau avec le lien.",
      )
    ) {
      return;
    }

    resetMessages();

    await supabase
      .from("feed_group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", memberId);

    const { data: still } = await supabase
      .from("feed_group_members")
      .select("user_id")
      .eq("group_id", group.id)
      .eq("user_id", memberId)
      .eq("status", "active")
      .maybeSingle();

    if (still) setMsg("Ce membre ne peut pas être retiré.");

    await load();
  };

  const handleBanFromGroup = async (memberId: string) => {
    const reason = window.prompt(
      "Bannir ce membre de CE groupe ? Il sera retiré, prévenu du motif, et ne pourra plus le rejoindre. Il pourra vous écrire un message pour se défendre. Il garde l'accès aux autres groupes et au feed.\n\nMotif (règle de la charte non respectée) :",
      "",
    );

    if (reason === null) return;

    resetMessages();

    const { error } = await supabase.rpc("ban_group_member", {
      p_group: group.id,
      p_user: memberId,
      p_reason: reason.trim() || null,
    });

    if (error) {
      setMsg(
        error.message.includes("cannot_ban")
          ? "Cette personne ne peut pas être bannie."
          : "Action impossible pour le moment.",
      );
    } else {
      setNotice("Personne bannie du groupe et prévenue par notification.");
    }

    await load();
  };

  const handleBanEverywhere = async (
    memberId: string,
    scope: "groups" | "all",
  ) => {
    const question =
      scope === "groups"
        ? "Bannir cette personne de TOUS les groupes ? Elle sera retirée de ses groupes et ne pourra plus en créer ni en rejoindre. Elle garde l'accès au feed général. Les groupes qu'elle possède deviennent les vôtres."
        : "Bannir cette personne de TOUTE la communauté ? Elle sera retirée de ses groupes et ne pourra plus publier, commenter ni utiliser les groupes. Les groupes qu'elle possède deviennent les vôtres.";

    const reason = window.prompt(
      `${question}\n\nElle sera prévenue et pourra vous écrire un message.\n\nMotif (règle de la charte non respectée) :`,
      "",
    );

    if (reason === null) return;

    resetMessages();

    const { error } = await supabase.rpc("ban_community_member", {
      p_user: memberId,
      p_reason: reason.trim() || null,
      p_scope: scope,
    });

    if (error) {
      setMsg(
        error.message.includes("cannot_ban")
          ? "Cette personne ne peut pas être bannie."
          : "Action impossible pour le moment.",
      );
    } else {
      setNotice("Personne bannie et prévenue par notification.");
    }

    await load();
  };

  const handleTakeOver = async (ownerMemberId: string) => {
    const name = pseudos[ownerMemberId] ?? "ce membre";

    const reason = window.prompt(
      `Bannir ${name} de ce groupe et en devenir le propriétaire ? Les publications du groupe sont conservées. Il sera prévenu et pourra vous écrire un message. Si vous le réintégrez plus tard, il reviendra comme simple membre.\n\nMotif (règle de la charte non respectée) :`,
      "",
    );

    if (reason === null) return;

    resetMessages();

    const { error } = await supabase.rpc("take_over_group", {
      p_group: group.id,
      p_reason: reason.trim() || null,
    });

    if (error) {
      setMsg("Action impossible pour le moment.");
    } else {
      setNotice(
        "Vous êtes maintenant propriétaire de ce groupe. L'ancien propriétaire a été prévenu.",
      );
    }

    await load();
  };

  const handleUnbanFromGroup = async (banUserId: string) => {
    if (
      !confirm(
        "Lever le bannissement et réintégrer cette personne dans le groupe ?",
      )
    ) {
      return;
    }

    resetMessages();

    const { error } = await supabase.rpc("unban_group_member", {
      p_group: group.id,
      p_user: banUserId,
    });

    if (error) {
      setMsg("Action impossible pour le moment.");
    } else {
      setNotice(
        "Bannissement levé. La réintégration automatique dépend des droits actuels de la personne et de l'absence d'un bannissement global.",
      );
    }

    await load();
  };

  const handleAnswerAppeal = async (
    appealId: string,
    accept: boolean,
  ) => {
    const response = window.prompt(
      accept
        ? "Message pour la personne (facultatif) :"
        : "Réponse à la personne (facultatif, mais recommandé) :",
      "",
    );

    if (response === null) return;

    resetMessages();

    const { error } = await supabase.rpc("answer_appeal", {
      p_appeal: appealId,
      p_accept: accept,
      p_response: response.trim() || null,
    });

    if (error) {
      if (error.message.includes("not_allowed")) {
        setMsg(
          "Cette décision appartient au coach, qui a prononcé ce bannissement.",
        );
      } else if (error.message.includes("already_handled")) {
        setMsg("Cette demande a déjà été traitée.");
      } else {
        setMsg("Action impossible pour le moment.");
      }
    } else {
      setNotice(
        accept
          ? "Demande acceptée. La réintégration dépend des droits actuels de la personne et des éventuels autres bannissements."
          : "Demande refusée : la personne a été prévenue.",
      );
    }

    await load();
  };

  const handleLeave = async () => {
    if (!confirm("Quitter ce groupe ?")) return;

    const { error } = await supabase
      .from("feed_group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", userId);

    if (error) {
      setMsg("Impossible de quitter le groupe pour le moment.");
      return;
    }

    void navigate({ to: "/groups" });
  };

  const handleDeleteGroup = async () => {
    if (
      !confirm(
        "Supprimer définitivement ce groupe et toutes ses publications ?",
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("feed_groups")
      .delete()
      .eq("id", group.id);

    if (error) {
      setMsg("Suppression impossible pour le moment.");
      return;
    }

    void navigate({ to: "/groups" });
  };

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
      active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border text-muted-foreground"
    }`;

  const smallBtn =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs";

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <Link
        to="/groups"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isPro ? "Tous les groupes" : "Mes groupes"}
      </Link>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{group.name}</span>
            </h1>

            {group.description && (
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                {group.description}
              </p>
            )}

            <p className="mt-1 text-xs text-muted-foreground">
              {members.length} membre{members.length > 1 ? "s" : ""}
            </p>
          </div>

          {isMember && !isOwner && !isPro && (
            <button
              onClick={() => void handleLeave()}
              className={`${smallBtn} border text-muted-foreground hover:bg-muted`}
            >
              <LogOut className="h-3.5 w-3.5" />
              Quitter
            </button>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium">Inviter des personnes</p>

          {group.invite_enabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void handleCopyInvite()}
                className={`${smallBtn} bg-primary text-primary-foreground`}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                {copied ? "Lien copié" : "Copier le lien d'invitation"}
              </button>

              <span className="text-xs text-muted-foreground">
                Seuls les membres ayant accepté la charte peuvent rejoindre
                le groupe.
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Le lien d'invitation est désactivé.
            </p>
          )}

          {canManage && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => void handleToggleInvite()}
                className={`${smallBtn} border text-muted-foreground hover:bg-muted`}
              >
                <Power className="h-3.5 w-3.5" />
                {group.invite_enabled
                  ? "Désactiver le lien"
                  : "Réactiver le lien"}
              </button>

              <button
                onClick={() => void handleRegenerate()}
                className={`${smallBtn} border text-muted-foreground hover:bg-muted`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Nouveau lien
              </button>

              <button
                onClick={() => void handleDeleteGroup()}
                className={`${smallBtn} ml-auto text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer le groupe
              </button>
            </div>
          )}
        </div>

        {msg && <p className="text-xs text-red-500">{msg}</p>}
        {notice && <p className="text-xs text-green-700">{notice}</p>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("posts")}
          className={tabClass(tab === "posts")}
        >
          Publications
        </button>

        <button
          onClick={() => setTab("members")}
          className={tabClass(tab === "members")}
        >
          Membres ({members.length})

          {canManage && appeals.length > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {appeals.length}
            </span>
          )}
        </button>
      </div>

      {tab === "posts" && user && (
        <FeedView
          key={group.id}
          userId={user.id}
          groupId={group.id}
        />
      )}

      {tab === "members" && (
        <div className="space-y-5">
          {isPro && (
            <InviteFromList groupId={group.id} onChanged={load} />
          )}

          {isPro && (
            <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Bannir du groupe</strong>
                {" : "}retire la personne de ce groupe uniquement.
              </p>

              <p>
                <strong className="text-foreground">
                  Bannir de tous les groupes
                </strong>
                {" : "}plus aucun groupe, mais le feed général reste accessible.
              </p>

              <p>
                <strong className="text-foreground">
                  Bannir de la communauté
                </strong>
                {" : "}plus de publication, de commentaire ni de groupe.
              </p>

              <p>
                <strong className="text-foreground">
                  Reprendre le groupe
                </strong>
                {" : "}bannit le propriétaire et vous en fait le propriétaire.
              </p>

              <p>
                Toute personne bannie est prévenue par notification, avec le
                motif, et peut vous écrire un message pour se défendre.
                La réintégration automatique reste soumise à ses droits
                actuels et aux éventuels autres bannissements.
              </p>

              <p>
                Le badge « Patient » n'est visible que par vous : pour les
                autres membres, vos patients apparaissent comme « Premium ».
              </p>
            </div>
          )}

          {canManage && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Inbox className="h-4 w-4" />
                Demandes de réintégration ({appeals.length})
              </h2>

              {appeals.length === 0 ? (
                <div className="rounded-xl border bg-card p-5 text-center text-sm text-muted-foreground">
                  Aucune demande en attente.
                </div>
              ) : (
                appeals.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border bg-card p-4 space-y-2"
                  >
                    <p className="text-sm font-medium">
                      {pseudos[a.user_id] ?? "Membre sans pseudo"}

                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </p>

                    <p className="text-sm whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2">
                      {a.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleAnswerAppeal(a.id, true)}
                        className={`${smallBtn} text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20`}
                      >
                        Accepter et réintégrer
                      </button>

                      <button
                        onClick={() => void handleAnswerAppeal(a.id, false)}
                        className={`${smallBtn} text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          <div className="space-y-2">
            {members.map((m) => {
              const memberIsCoach = badges[m.user_id] === "coach";

              const canAct =
                canManage &&
                m.role !== "owner" &&
                !memberIsCoach &&
                m.user_id !== userId;

              const canTakeOver =
                isPro &&
                m.role === "owner" &&
                !memberIsCoach &&
                m.user_id !== userId;

              return (
                <div
                  key={m.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">
                        {pseudos[m.user_id] ??
                          (memberIsCoach ? "Coach" : "Membre sans pseudo")}
                        {m.user_id === userId ? " (vous)" : ""}
                      </span>

                      <TierBadge badge={badges[m.user_id]} />
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {m.role === "owner" ? "Propriétaire" : "Membre"}
                      {" · depuis le "}
                      {new Date(m.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>

                  {canTakeOver && (
                    <button
                      onClick={() => void handleTakeOver(m.user_id)}
                      title="Bannit le propriétaire de ce groupe et vous en fait le propriétaire."
                      className={`${smallBtn} text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
                    >
                      <Crown className="h-3.5 w-3.5" />
                      Bannir le propriétaire et reprendre le groupe
                    </button>
                  )}

                  {canAct && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleRemoveMember(m.user_id)}
                        title="Retire la personne du groupe. Elle peut le rejoindre à nouveau avec le lien."
                        className={`${smallBtn} border text-muted-foreground hover:bg-muted`}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Retirer
                      </button>

                      <button
                        onClick={() => void handleBanFromGroup(m.user_id)}
                        title="Retire la personne de ce groupe, la prévient et l'empêche d'y revenir."
                        className={`${smallBtn} text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20`}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Bannir du groupe
                      </button>

                      {isPro && (
                        <>
                          <button
                            onClick={() =>
                              void handleBanEverywhere(m.user_id, "groups")
                            }
                            title="Retire la personne de tous les groupes. Elle garde le feed général."
                            className={`${smallBtn} text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20`}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Bannir de tous les groupes
                          </button>

                          <button
                            onClick={() =>
                              void handleBanEverywhere(m.user_id, "all")
                            }
                            title="Interdit la publication, les commentaires et les groupes."
                            className={`${smallBtn} text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20`}
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            Bannir de la communauté
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {canManage && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Bannis de ce groupe ({groupBans.length})
              </h2>

              {groupBans.length === 0 ? (
                <div className="rounded-xl border bg-card p-5 text-center text-sm text-muted-foreground">
                  Personne n'est banni de ce groupe en particulier.
                </div>
              ) : (
                groupBans.map((b) => (
                  <div
                    key={b.user_id}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">
                          {pseudos[b.user_id] ?? "Membre sans pseudo"}
                        </span>

                        <TierBadge badge={badges[b.user_id]} />
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Depuis le{" "}
                        {new Date(b.created_at).toLocaleDateString("fr-FR")}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </p>
                    </div>

                    <button
                      onClick={() => void handleUnbanFromGroup(b.user_id)}
                      title="Lève le bannissement et réintègre la personne si ses droits et les autres sanctions le permettent."
                      className={`${smallBtn} border text-muted-foreground hover:bg-muted`}
                    >
                      Lever et réintégrer
                    </button>
                  </div>
                ))
              )}

              {isPro && (
                <p className="text-xs text-muted-foreground">
                  Les bannissements de tous les groupes et de la communauté
                  se gèrent depuis la page « Tous les groupes ».
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}