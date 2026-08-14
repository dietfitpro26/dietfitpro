// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: "Configuration invalide" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const token = authorization.replace(/^Bearer\s+/i, "");
  
  const { data: { user: caller } } = await adminClient.auth.getUser(token);
  if (!caller) return jsonResponse({ error: "Non autorisé" }, 401);

  let payload: { user_id?: string } = {};
  try { payload = await req.json(); } catch {
    return jsonResponse({ error: "JSON invalide" }, 400);
  }

  const targetId = payload.user_id ?? caller.id;

  // Vérifier permissions
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  const isSelf = targetId === caller.id;
  const isPro = callerProfile?.role === "pro";

  if (!isSelf && !isPro) return jsonResponse({ error: "Non autorisé" }, 403);

  // Appeler la fonction SQL
  const { error } = await adminClient.rpc("delete_subscriber_completely", { subscriber_id: targetId });

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ success: true, deleted_user_id: targetId });
});