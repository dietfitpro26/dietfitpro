import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { createNotification } from "@/lib/notifications";

/**
 * Surveille les consultations à venir et déclenche une notif in-app
 * 15 min avant l'heure prévue. Monté dans les layouts pro/patient.
 */
export function UpcomingConsultationReminder() {
  const { user, role } = useAuth();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || (role !== "pro" && role !== "patient")) return;

    const check = async () => {
      const now = Date.now();
      const upperBound = new Date(now + 16 * 60_000).toISOString();
      const lowerBound = new Date(now + 14 * 60_000).toISOString();
      const userCol = role === "pro" ? "pro_id" : "patient_user_id";
      const { data } = await supabase
        .from("visio_consultations")
        .select("id, scheduled_at, status")
        .eq(userCol, user.id)
        .eq("status", "scheduled")
        .gte("scheduled_at", lowerBound)
        .lte("scheduled_at", upperBound);

      (data ?? []).forEach((c) => {
        const key = `${c.id}`;
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);
        toast.message("Consultation dans 15 minutes", {
          description: "Préparez-vous à rejoindre la visio.",
        });
        void createNotification({
          userId: user.id,
          type: "consultation_reminder_15m",
          title: "Consultation dans 15 min",
          body: "Préparez-vous à rejoindre la visio.",
          link: role === "pro" ? `/pro/consultations/${c.id}` : "/patient/consultations",
          payload: { consultation_id: c.id },
        });
      });
    };

    void check();
    const interval = setInterval(() => void check(), 60_000);
    return () => clearInterval(interval);
  }, [user, role]);

  return null;
}
