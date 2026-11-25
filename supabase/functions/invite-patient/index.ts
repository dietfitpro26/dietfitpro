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
      return new Response(JSON.stringify({ error: "Non autorisé — token manquant" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Vérifier le JWT et récupérer l'utilisateur
    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAdmin.auth.getUser(jwt);
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Non autorisé — token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        JSON.stringify({
          error: "Non autorisé — seuls les professionnels peuvent envoyer des invitations",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ──────────────────────────────────────────────────────────
    // 3. PARAMÈTRES DU BODY (pro_id forcé au caller)
    // ──────────────────────────────────────────────────────────
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const patient_id = typeof body?.patient_id === "string" ? body.patient_id : null;
    const redirect_to = body?.redirect_to;
    const action = body?.action;
    const pro_id = caller.id; // ⚠️ FORCÉ — on ignore tout pro_id du body

    if (action === "status") {
      if (!patient_id) {
        return new Response(JSON.stringify({ error: "Identifiant patient manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: statusRows, error: statusError } = await supabaseAdmin.rpc(
        "patient_invitation_status",
        { p_actor_id: caller.id, p_patient_id: patient_id },
      );
      if (statusError || !Array.isArray(statusRows) || !statusRows[0]) {
        return new Response(JSON.stringify({ error: "État de l'invitation indisponible" }), {
          status: statusError ? 403 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, ...statusRows[0] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Adresse e-mail invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";
    const finalRedirect =
      typeof redirect_to === "string" && redirect_to ? redirect_to : `${appUrl}/bienvenue`;

    if (patient_id) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          patient_id,
        )
      ) {
        return new Response(JSON.stringify({ error: "Identifiant patient invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: patient, error: patientError } = await supabaseAdmin
        .from("patients")
        .select("id, pro_id, user_id")
        .eq("id", patient_id)
        .maybeSingle();

      if (patientError || !patient || patient.pro_id !== caller.id || patient.user_id) {
        return new Response(
          JSON.stringify({ error: "Patient introuvable, déjà lié ou hors de votre périmètre" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ⚠️ Le rôle est TOUJOURS déterminé côté serveur — jamais par le client
    const finalRole: string = patient_id ? "patient" : "subscriber";

    // ──────────────────────────────────────────────────────────
    // 4. RESERVATION → AUTH INVITE → ATOMIC PROFILE/PATIENT LINK
    // ──────────────────────────────────────────────────────────
    if (patient_id) {
      const requestId =
        typeof body?.request_id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          body.request_id,
        )
          ? body.request_id
          : crypto.randomUUID();
      if (body?.request_id && requestId !== body.request_id) {
        return new Response(JSON.stringify({ error: "Identifiant de demande invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: claimRows, error: claimError } = await supabaseAdmin.rpc(
        "claim_patient_invitation",
        { p_actor_id: pro_id, p_patient_id: patient_id, p_email: email, p_request_id: requestId },
      );
      const claim = Array.isArray(claimRows) ? claimRows[0] : null;
      if (claimError || !claim) {
        return new Response(
          JSON.stringify({ error: "Invitation déjà en cours ou patient hors de votre périmètre" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      let invitedUserId: string | null = claim.auth_user_id ?? null;
      if (!invitedUserId && !claim.created_now) {
        const { data: recoveredId, error: recoveryError } = await supabaseAdmin.rpc(
          "recover_patient_invitation_user",
          { p_actor_id: pro_id, p_patient_id: patient_id, p_request_id: claim.claim_request_id },
        );
        if (recoveryError) {
          return new Response(
            JSON.stringify({
              error: "Reprise de l'invitation indisponible",
              request_id: claim.claim_request_id,
            }),
            {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        invitedUserId = recoveredId ?? null;
        if (!invitedUserId) {
          return new Response(
            JSON.stringify({
              error: "Invitation déjà en cours",
              request_id: claim.claim_request_id,
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      if (!invitedUserId) {
        const { data: inviteData, error: inviteError } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { invitation_request_id: claim.claim_request_id },
            redirectTo: finalRedirect,
          });
        if (inviteError || !inviteData.user?.id) {
          if (inviteError?.message.toLowerCase().includes("already registered")) {
            const { data: recoveredId, error: recoveryError } = await supabaseAdmin.rpc(
              "recover_patient_invitation_user",
              {
                p_actor_id: pro_id,
                p_patient_id: patient_id,
                p_request_id: claim.claim_request_id,
              },
            );
            if (recoveryError) {
              return new Response(
                JSON.stringify({
                  error: "Reprise de l'invitation indisponible",
                  request_id: claim.claim_request_id,
                }),
                {
                  status: 503,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              );
            }
            invitedUserId = recoveredId ?? null;
          }
          if (!invitedUserId) {
            const { error: cancelError } = await supabaseAdmin.rpc("cancel_patient_invitation", {
              p_actor_id: pro_id,
              p_patient_id: patient_id,
              p_request_id: claim.claim_request_id,
            });
            if (cancelError) {
              return new Response(
                JSON.stringify({
                  error: "Annulation de la réservation impossible",
                  request_id: claim.claim_request_id,
                }),
                {
                  status: 503,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              );
            }
            return new Response(
              JSON.stringify({
                error: inviteError?.message ?? "Invitation Auth incomplète",
                request_id: claim.claim_request_id,
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        } else {
          invitedUserId = inviteData.user.id;
        }
      }

      const { error: recordError } = await supabaseAdmin.rpc("record_patient_invitation_user", {
        p_actor_id: pro_id,
        p_patient_id: patient_id,
        p_request_id: claim.claim_request_id,
        p_auth_user_id: invitedUserId,
      });
      if (recordError) {
        return new Response(
          JSON.stringify({
            error: "Invitation créée mais rattachement à reprendre",
            request_id: claim.claim_request_id,
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const { error: completeError } = await supabaseAdmin.rpc("complete_patient_invitation", {
        p_actor_id: pro_id,
        p_patient_id: patient_id,
        p_request_id: claim.claim_request_id,
        p_auth_user_id: invitedUserId,
      });
      if (completeError) {
        return new Response(
          JSON.stringify({
            error: "Invitation créée mais rattachement à reprendre",
            request_id: claim.claim_request_id,
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          userId: invitedUserId,
          role: finalRole,
          request_id: claim.claim_request_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { invitation_request_id: crypto.randomUUID() },
        redirectTo: finalRedirect,
      });
    if (inviteError || !inviteData.user?.id) {
      const msg = inviteError?.message.toLowerCase().includes("already registered")
        ? "Cet email est déjà inscrit. L'utilisateur peut se connecter directement."
        : (inviteError?.message ?? "Invitation Auth incomplète");
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error: linkError } = await supabaseAdmin.rpc("complete_subscriber_invitation", {
      p_actor_id: pro_id,
      p_auth_user_id: inviteData.user.id,
    });
    if (linkError) {
      return new Response(
        JSON.stringify({ error: "Invitation créée mais rattachement professionnel à reprendre" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({ success: true, userId: inviteData.user.id, role: finalRole }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[invite-patient] catch:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
