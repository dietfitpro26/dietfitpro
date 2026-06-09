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
    const { email, patient_id, pro_id, redirect_to } = await req.json();

    if (!email || !patient_id || !pro_id) {
      return new Response(JSON.stringify({ error: "Paramètres manquants (email, patient_id, pro_id requis)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";
    const finalRedirect = redirect_to ?? `${appUrl}/bienvenue`;

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { patient_id, pro_id, role: "patient" },
      redirectTo: finalRedirect,
    });

    if (error) {
      console.error("[invite-patient] error:", error.message);
      const msg = error.message.includes("already registered")
        ? "Cet email est déjà inscrit. Le patient peut se connecter directement."
        : error.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mettre à jour le patient avec son user_id
    if (data.user?.id) {
      await supabaseAdmin
        .from("patients")
        .update({ user_id: data.user.id })
        .eq("id", patient_id);
    }

    return new Response(JSON.stringify({ success: true, userId: data.user?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[invite-patient] catch:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});