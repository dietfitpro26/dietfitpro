import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeAccountDeletion, type AccountRole } from "./authorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHODE_NON_AUTORISEE" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  if (!url || !serviceKey) return json({ error: "CONFIGURATION_INDISPONIBLE" }, 500);
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "AUTHENTIFICATION_REQUISE" }, 401);

  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user: actor },
    error: authError,
  } = await db.auth.getUser(token);
  if (authError || !actor) return json({ error: "SESSION_INVALIDE" }, 401);

  let body: {
    target_user_id?: string;
    user_id?: string;
    confirmation?: string;
    request_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON_INVALIDE" }, 400);
  }
  // Legacy screens use user_id, and self-delete sends an empty body. Accept
  // those read-only request shapes while the replacement deletion flow is
  // deliberately unavailable; this endpoint never deletes or locks accounts.
  const targetId = body.target_user_id ?? body.user_id ?? actor.id;
  if (!uuidPattern.test(targetId)) {
    return json({ error: "IDENTIFIANT_INVALIDE" }, 400);
  }

  const [
    { data: actorProfile },
    { data: targetProfile },
    { data: adminFlag },
    { data: targetAdminFlag },
    { data: adminCount },
    { data: assignedPatients },
  ] = await Promise.all([
    db.from("profiles").select("role").eq("id", actor.id).maybeSingle(),
    db.from("profiles").select("role,pro_id").eq("id", targetId).maybeSingle(),
    db.rpc("is_super_admin", { p_user_id: actor.id }),
    db.rpc("is_super_admin", { p_user_id: targetId }),
    db.rpc("active_super_admin_count"),
    db.from("patients").select("id").eq("pro_id", targetId).limit(1),
  ]);
  const { data: assignmentRows } = await db
    .from("patients")
    .select("id")
    .eq("user_id", targetId)
    .eq("pro_id", actor.id)
    .limit(1);
  const isSuperAdmin = adminFlag === true;
  const targetIsSuperAdmin = targetAdminFlag === true;
  const decision = authorizeAccountDeletion({
    actorId: actor.id,
    actorRole: (actorProfile?.role ?? null) as AccountRole | null,
    targetId,
    targetRole: (targetProfile?.role ?? null) as AccountRole | null,
    isAssignedToActor: targetProfile?.pro_id === actor.id || (assignmentRows?.length ?? 0) > 0,
    targetIsSuperAdmin,
    isSuperAdmin,
    activeSuperAdminCount: Number(adminCount ?? 0),
    hasAssignedPatientRecords: (assignedPatients?.length ?? 0) > 0,
  });
  if (!decision.allowed) return json({ error: decision.reason }, 403);

  if (body.request_id && !uuidPattern.test(body.request_id)) {
    return json({ error: "REQUEST_ID_INVALIDE" }, 400);
  }
  if (body.confirmation && body.confirmation !== `DELETE ${targetId}`) {
    return json({ error: "CONFIRMATION_EXPLICITE_REQUISE" }, 400);
  }

  // Deletion is intentionally unavailable until the Storage, related-row and
  // retention preflight is complete. Do not create a durable job or lock the
  // target account on this path: an unsuccessful preflight must be harmless.
  return json({ error: "SUPPRESSION_TEMPORAIREMENT_INDISPONIBLE_REFERENCE_STORAGE" }, 409);
});
