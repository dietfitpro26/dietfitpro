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

function personLabel(p: Person) {
  if (p.role === "patient") return "Patient";
  if (p.plan === "premium" || p.plan === "visio") return "Premium";
  return "Basic";
}

function isEligible(p: Person) {
  return p.role === "patient" || (p.role === "subscriber" && (p.plan === "premium" || p.plan === "visio"));
}

export function InviteFromList({
  groupId,
  onChanged,
}: {
  groupId: string;
  onChanged: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [people, setPeople] = useState<Person[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
    setActiveIds(new Set(((activeRes.data ?? []) as PendingRow[]).map((r) => r.user_id)));
    setPendingIds(new Set(((pendingRes.data ?? []) as PendingRow[]).map((r) => r.user_id)));
  }, [userId, groupId]);

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

      {open && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Rechercher un patient ou un abonné…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
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
            Seuls les patients et les abonnés Premium peuvent rejoindre un groupe. Les abonnés Basic sont marqués « Non éligible ».
          </p>
        </div>
      )}
    </section>
  );
}