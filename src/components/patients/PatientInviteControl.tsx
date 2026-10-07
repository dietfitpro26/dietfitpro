import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type AccountStatus = "none" | "pending" | "activated" | "unknown";

function useAccountStatus(patientId: string, hasAccount: boolean, refreshKey: number) {
  const [status, setStatus] = useState<AccountStatus>(hasAccount ? "unknown" : "none");

  useEffect(() => {
    if (!hasAccount) {
      setStatus("none");
      return;
    }
    let cancelled = false;
    void supabase.functions
      .invoke("invite-patient", { body: { action: "status", patient_id: patientId } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.success) {
          setStatus("unknown");
          return;
        }
        setStatus(!data.has_account ? "none" : data.activated ? "activated" : "pending");
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, hasAccount, refreshKey]);

  return status;
}

async function readInviteError(error: unknown, data: unknown): Promise<string> {
  const fromData = (data as { error?: string } | null)?.error;
  if (fromData) return fromData;
  try {
    const context = (error as { context?: Response } | null)?.context;
    if (context) {
      const body = await context.json();
      if (body?.error) return String(body.error);
    }
  } catch {
    // on utilise le message générique ci-dessous
  }
  return (error as Error | null)?.message ?? "Erreur inconnue";
}

interface BadgeProps {
  patientId: string;
  hasAccount: boolean;
}

export function PatientAccountBadge({ patientId, hasAccount }: BadgeProps) {
  const status = useAccountStatus(patientId, hasAccount, 0);

  if (status === "activated") {
    return (
      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
        Compte actif
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
        Invitation envoyée
      </span>
    );
  }
  if (status === "unknown") {
    return (
      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
        Compte créé
      </span>
    );
  }
  return (
    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
      Sans compte
    </span>
  );
}

interface InviteProps {
  patientId: string;
  email: string | null;
  hasAccount: boolean;
  onSent?: () => void;
}

export function PatientInviteButton({ patientId, email, hasAccount, onSent }: InviteProps) {
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const status = useAccountStatus(patientId, hasAccount, refreshKey);

  if (!email) return null;
  if (status !== "none" && status !== "pending") return null;

  const label = status === "pending" ? "Renvoyer l'invitation" : "Envoyer l'invitation";

  const handleClick = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-patient", {
        body: {
          patient_id: patientId,
          email,
          redirect_to: `${window.location.origin}/bienvenue`,
        },
      });

      if (error || data?.error) {
        toast.error(await readInviteError(error, data));
        return;
      }

      toast.success(
        status === "pending"
          ? `Nouvelle invitation envoyée à ${email}`
          : `Invitation envoyée à ${email}`,
      );
      setRefreshKey((value) => value + 1);
      onSent?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={sending}
      className="border-amber-300 text-amber-700 hover:bg-amber-50"
    >
      {sending ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Mail className="h-4 w-4 mr-1" />
      )}
      {sending ? "Envoi..." : label}
    </Button>
  );
}