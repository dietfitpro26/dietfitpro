import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ──────────────────────────────────────────────────────────
    // 1. AUTHENTIFICATION DE L'APPELANT
    // ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Non autorisé — token manquant" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Vérifier le JWT et récupérer l'utilisateur
    const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(jwt);
    if (callerErr || !caller) {
      return new Response(
        JSON.stringify({ error: "Non autorisé — token invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────────────────────────
    // 2. VÉRIFIER QUE L'APPELANT EST UN PRO
    // ──────────────────────────────────────────────────────────
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileErr || !callerProfile || callerProfile.role !== "pro") {
      return new Response(
        JSON.stringify({ error: "Non autorisé — seuls les professionnels peuvent envoyer des invitations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────────────────────────
    // 3. PARAMÈTRES DU BODY (pro_id forcé au caller)
    // ──────────────────────────────────────────────────────────
    const { email, patient_id, redirect_to } = await req.json();
    const pro_id = caller.id; // ⚠️ FORCÉ — on ignore tout pro_id du body

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Paramètre manquant (email requis)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";
    const finalRedirect = redirect_to ?? `${appUrl}/bienvenue`;

    // ⚠️ Le rôle est TOUJOURS déterminé côté serveur — jamais par le client
    const finalRole: string = patient_id ? "patient" : "subscriber";

    // ──────────────────────────────────────────────────────────
    // 4. INVITATION + ÉCRITURES
    // ──────────────────────────────────────────────────────────
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        pro_id,
        role: finalRole,
        ...(patient_id ? { patient_id } : {}),
      },
      redirectTo: finalRedirect,
    });

    if (error) {
      console.error("[invite-patient] error:", error.message);
      const msg = error.message.includes("already registered")
        ? "Cet email est déjà inscrit. L'utilisateur peut se connecter directement."
        : error.message;
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (patient_id && data.user?.id) {
      await supabaseAdmin
        .from("patients")
        .update({ user_id: data.user.id })
        .eq("id", patient_id);
    }

    if (data.user?.id) {
      await supabaseAdmin
        .from("profiles")
        .update({ pro_id, role: finalRole })
        .eq("id", data.user.id);
    }

    return new Response(
      JSON.stringify({ success: true, userId: data.user?.id, role: finalRole }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[invite-patient] catch:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
