import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type StripeResult = { ok: true } | { ok: false; message: string };

async function cancelStripeSubscription(subscriptionId: string): Promise<StripeResult> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return { ok: false, message: "Le paiement en ligne n'est pas configuré : impossible d'annuler l'abonnement avant la suppression." };
  }

  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${stripeKey}` } },
  );

  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => null);
  if (response.status === 404 || payload?.error?.code === "resource_missing") return { ok: true };

  return { ok: false, message: payload?.error?.message ?? `Erreur Stripe (${response.status}).` };
}

async function removeStorageFolder(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  folder: string,
): Promise<void> {
  const storage = admin.storage.from(bucket);

  async function walk(path: string): Promise<void> {
    const { data, error } = await storage.list(path, { limit: 1000 });
    if (error) throw new Error(`Lecture du stockage impossible (${path}) : ${error.message}`);

    const files: string[] = [];
    for (const item of data ?? []) {
      const itemPath = path ? `${path}/${item.name}` : item.name;
      if (item.id === null) await walk(itemPath);
      else files.push(itemPath);
    }

    if (files.length > 0) {
      const { error: removeError } = await storage.remove(files);
      if (removeError) throw new Error(`Suppression des fichiers impossible : ${removeError.message}`);
    }
  }

  await walk(folder);
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuration Supabase manquante." }, 500);
    if (!authorization) return json({ error: "Authorization manquant." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user: caller }, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller) return json({ error: "Session utilisateur invalide." }, 401);

    let payload: { user_id?: string; patient_id?: string };
    try {
      payload = await request.json();
    } catch {
      return json({ error: "JSON invalide." }, 400);
    }

    const targetUserId = payload.user_id ?? null;
    const patientId = payload.patient_id ?? null;
    if (!targetUserId && !patientId) return json({ error: "user_id ou patient_id requis." }, 400);

    const { data: callerProfile, error: callerProfileError } = await admin
      .from("profiles").select("id, role").eq("id", caller.id).maybeSingle();
    if (callerProfileError) return json({ error: "Erreur lecture du profil appelant.", details: callerProfileError.message }, 500);

    const isSelfDelete = Boolean(targetUserId && targetUserId === caller.id);
    const isPro = callerProfile?.role === "pro";
    if (!isSelfDelete && !isPro) return json({ error: "Suppression non autorisée." }, 403);

    let targetRole: string | null = null;
    let proId: string | null = null;
    let patientFolder: string | null = null;

    if (patientId) {
      if (!isPro) return json({ error: "Seul un professionnel peut supprimer un dossier patient." }, 403);

      const { data: patient, error: patientError } = await admin
        .from("patients")
        .select("id, user_id, pro_id")
        .eq("id", patientId)
        .eq("pro_id", caller.id)
        .maybeSingle();

      if (patientError) return json({ error: "Erreur lecture du dossier patient.", details: patientError.message }, 500);
      if (!patient) return json({ error: "Patient introuvable ou non rattaché à votre compte." }, 404);
      if (targetUserId && patient.user_id !== targetUserId) {
        return json({ error: "Le compte transmis ne correspond pas à ce dossier patient." }, 403);
      }

      proId = patient.pro_id;
      patientFolder = `${proId}/patient-docs/${patient.id}`;

      if (patient.user_id) {
        const { data: profile, error } = await admin
          .from("profiles").select("id, role, pro_id").eq("id", patient.user_id).maybeSingle();
        if (error) return json({ error: "Erreur lecture du compte patient.", details: error.message }, 500);
        if (!profile || profile.role !== "patient" || profile.pro_id !== caller.id) {
          return json({ error: "Le compte patient n'est pas correctement rattaché à votre compte." }, 403);
        }
        targetRole = profile.role;
      }
    } else if (!isSelfDelete) {
      const { data: target, error } = await admin
        .from("profiles").select("id, role, pro_id").eq("id", targetUserId).maybeSingle();
      if (error) return json({ error: "Erreur lecture du compte cible.", details: error.message }, 500);
      if (!target) return json({ error: "Compte introuvable." }, 404);
      if (target.role !== "subscriber" || target.pro_id !== caller.id) {
        return json({ error: "Cet abonné n'est pas rattaché à votre compte." }, 403);
      }
      targetRole = target.role;
    }

    const effectiveUserId = targetUserId ?? (patientId ? await (async () => {
      const { data } = await admin.from("patients").select("user_id").eq("id", patientId).eq("pro_id", caller.id).maybeSingle();
      return data?.user_id ?? null;
    })() : null);

    if (targetRole === "subscriber" && effectiveUserId) {
      const { data: billing, error: billingError } = await admin
        .from("subscriber_billing").select("stripe_subscription_id, status")
        .eq("user_id", effectiveUserId).maybeSingle();
      if (billingError) return json({ error: "Erreur lecture de l'abonnement.", details: billingError.message }, 500);

      if (billing?.stripe_subscription_id && billing.status !== "canceled") {
        const result = await cancelStripeSubscription(billing.stripe_subscription_id);
        if (!result.ok) {
          return json({ error: "Impossible d'annuler l'abonnement en ligne. Rien n'a été supprimé.", details: result.message }, 502);
        }
      }
    }

    if (patientId) {
      const { error: visioError } = await admin.from("visio_consultations")
        .delete().eq("patient_id", patientId);
      if (visioError) return json({ error: "Impossible de supprimer les visioconsultations du patient.", details: visioError.message }, 500);
    }

    if (effectiveUserId) {
      const { error: visioUserError } = await admin.from("visio_consultations")
        .delete().eq("patient_user_id", effectiveUserId);
      if (visioUserError) return json({ error: "Impossible de supprimer les visioconsultations du compte.", details: visioUserError.message }, 500);

      const { error: authDeleteError } = await admin.auth.admin.deleteUser(effectiveUserId, false);
      if (authDeleteError) {
        return json({ error: "La suppression du compte de connexion a échoué. Les données n'ont pas été supprimées.", details: authDeleteError.message }, 500);
      }
    } else if (patientId) {
      const { error: patientDeleteError } = await admin.from("patients")
        .delete().eq("id", patientId).eq("pro_id", caller.id);
      if (patientDeleteError) return json({ error: "La suppression du dossier patient a échoué.", details: patientDeleteError.message }, 500);
    }

    let storageWarning: string | null = null;
    if (patientFolder) {
      try {
        await removeStorageFolder(admin, "message-attachments", patientFolder);
      } catch (error) {
        storageWarning = error instanceof Error ? error.message : String(error);
        console.error("[delete-account] Nettoyage documents patient incomplet :", storageWarning);
      }
    }

    return json({
      success: true,
      deleted_user_id: effectiveUserId,
      deleted_patient_id: patientId,
      ...(storageWarning ? { warning: "Compte/dossier supprimé, mais certains fichiers stockés n'ont pas pu être nettoyés.", storage_details: storageWarning } : {}),
    });
  } catch (error) {
    console.error("[delete-account] Exception :", error);
    return json({ error: "Erreur interne.", details: error instanceof Error ? error.message : String(error) }, 500);
  }
});
