import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Search, X } from "lucide-react";

type Person = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  plan: string | null;
};

type PendingRow = {
  user_id: string;
};

type InviteCandidate = {
  user_id: string;
  pseudo: string;
};

function personLabel(p: Person) {
  if (p.role === "patient") return "Patient";
  if (p.plan === "visio") return "Visio (indisponible en BETA)";
  if (p.plan === "premium") return "Premium";
  return "Basic";
}

function isEligible(p: Person) {
  // Basic subscribers cannot discover/join groups on their own, but may receive
  // a direct invitation from the group owner (the server validates eligibility).
  return p.role === "patient" || (p.role === "subscriber" && ["basic", "premium"].includes(p.plan ?? ""));
}

export function InviteFromList({
  groupId,
  onChanged,
}: {
  groupId: string;
  onChanged: () => Promise<void> | void;
}) {
  const { user, role } = useAuth();
  const userId = user?.id ?? "";
  const premiumOwnerSearch = role === "subscriber";

  const [people, setPeople] = useState<Person[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<InviteCandidate | null>(null);
  const [pendingPseudos, setPendingPseudos] = useState<InviteCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;

    const [peopleRes, activeRes, pendingRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, plan")
        .eq("pro_id", userId)
        .in("role", ["patient", "subscriber"])
        .order("full_name", { ascending: true }),
      supabase
        .from("feed_group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("status", "active"),
      supabase
        .from("feed_group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("status", "invited"),
    ]);

    setPeople((peopleRes.data ?? []) as Person[]);
    const activeUserIds = ((activeRes.data ?? []) as PendingRow[]).map((r) => r.user_id);
    const pendingUserIds = ((pendingRes.data ?? []) as PendingRow[]).map((r) => r.user_id);
    setActiveIds(new Set(activeUserIds));
    setPendingIds(new Set(pendingUserIds));
    if (premiumOwnerSearch && pendingUserIds.length > 0) {
      const { data: pseudoRows } = await supabase
        .from("community_profiles")
        .select("user_id, pseudo")
        .in("user_id", pendingUserIds);
      setPendingPseudos((pseudoRows ?? []) as InviteCandidate[]);
    } else {
      setPendingPseudos([]);
    }
  }, [userId, groupId, premiumOwnerSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q),
    );
  }, [people, search]);

  const pendingPeople = people.filter((p) => pendingIds.has(p.id));
  const pendingCount = pendingIds.size;

  const searchPremiumCandidate = async () => {
    const exactPseudo = search.trim();
    setCandidate(null);
    setMsg(null);
    if (exactPseudo.length < 3) {
      setMsg("Saisissez le pseudo exact (au moins 3 caractères).");
      return;
    }
    setSearching(true);
    const { data, error } = await supabase.rpc("search_group_invite_candidate", {
      p_group: groupId,
      p_exact_pseudo: exactPseudo,
    });
    setSearching(false);
    if (error) {
      setMsg("Recherche impossible pour le moment.");
      return;
    }
    const rows = (data ?? []) as InviteCandidate[];
    setCandidate(rows[0] ?? null);
    if (rows.length === 0) setMsg("Aucun membre éligible trouvé avec ce pseudo.");
  };

  const handleInvite = async (personId: string) => {
    setBusyId(personId);
    setMsg(null);
    setNotice(null);

    const { error } = await supabase.rpc("invite_to_group", {
      p_group: groupId,
      p_user: personId,
    });

    if (error) {
      const text = error.message ?? "";
      if (text.includes("not_eligible")) setMsg("Cette personne ne peut pas encore participer aux groupes (compte non éligible ou mineur).");
      else if (text.includes("banned")) setMsg("Cette personne est bannie : levez d'abord son bannissement.");
      else if (text.includes("already_member")) setMsg("Cette personne est déjà membre du groupe.");
      else setMsg("Invitation impossible pour le moment.");
    } else {
      setNotice("Invitation envoyée. La personne a été prévenue et doit accepter pour rejoindre le groupe.");
    }

    setBusyId(null);
    await load();
    await onChanged();
  };

  const handleCancel = async (personId: string) => {
    if (!confirm("Annuler cette invitation ?")) return;
    setBusyId(personId);
    setMsg(null);
    setNotice(null);

    const { error } = await supabase
      .from("feed_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", personId)
      .eq("status", "invited");

    if (error) setMsg("Action impossible pour le moment.");
    else setNotice("Invitation annulée.");

    setBusyId(null);
    await load();
  };

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-primary" />
          Inviter depuis ma liste
          {pendingCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {pendingCount} en attente
            </span>
          )}
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          {open ? "Fermer" : "Ouvrir"}
        </button>
      </div>

      {notice && <p className="text-xs text-green-700">{notice}</p>}
      {msg && <p className="text-xs text-red-500">{msg}</p>}

      {pendingPeople.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Invitations en attente</p>
          {pendingPeople.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-sm truncate">{p.full_name ?? p.email ?? "Membre"}</p>
              <button
                onClick={() => void handleCancel(p.id)}
                disabled={busyId === p.id}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Annuler
              </button>
            </div>
          ))}
        </div>
      )}

      {premiumOwnerSearch && pendingPseudos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Invitations en attente</p>
          {pendingPseudos.map((person) => (
            <div key={person.user_id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-sm truncate">{person.pseudo}</p>
              <button
                onClick={() => void handleCancel(person.user_id)}
                disabled={busyId === person.user_id}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Annuler
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={search}
              placeholder={premiumOwnerSearch ? "Pseudo exact du membre à inviter" : "Rechercher un patient ou un abonné…"}
              onChange={(e) => { setSearch(e.target.value); setCandidate(null); }}
            />
          </div>

          {premiumOwnerSearch && (
            <button
              type="button"
              onClick={() => void searchPremiumCandidate()}
              disabled={searching || search.trim().length < 3}
              className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {searching ? "Recherche…" : "Rechercher le pseudo"}
            </button>
          )}

          {premiumOwnerSearch ? (
            candidate && (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{candidate.pseudo}</p>
                  <p className="text-xs text-muted-foreground">Membre éligible</p>
                </div>
                {activeIds.has(candidate.user_id) ? (
                  <span className="text-xs text-muted-foreground">Déjà membre</span>
                ) : pendingIds.has(candidate.user_id) ? (
                  <span className="text-xs text-muted-foreground">Invitation envoyée</span>
                ) : (
                  <button
                    onClick={() => void handleInvite(candidate.user_id)}
                    disabled={busyId === candidate.user_id}
                    className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Inviter
                  </button>
                )}
              </div>
            )
          ) : filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Aucune personne trouvée.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((p) => {
                const eligible = isEligible(p);
                const member = activeIds.has(p.id);
                const pending = pendingIds.has(p.id);

                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.full_name ?? p.email ?? "Sans nom"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {personLabel(p)}
                        {p.email ? ` · ${p.email}` : ""}
                      </p>
                    </div>

                    {member ? (
                      <span className="text-xs text-muted-foreground">Déjà membre</span>
                    ) : pending ? (
                      <span className="text-xs text-muted-foreground">Invitation envoyée</span>
                    ) : !eligible ? (
                      <span className="text-xs text-muted-foreground">Non éligible</span>
                    ) : (
                      <button
                        onClick={() => void handleInvite(p.id)}
                        disabled={busyId === p.id}
                        className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        Inviter
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Les abonnés Basic peuvent rejoindre uniquement sur invitation valide. La recherche Premium utilise le pseudo exact et ne donne pas accès aux profils privés.
          </p>
        </div>
      )}
    </section>
  );
}
