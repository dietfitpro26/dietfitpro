import { supabase } from "@/lib/supabase";

export type NotificationType =
  | "consultation_scheduled"
  | "consultation_reminder_24h"
  | "consultation_reminder_15m"
  | "consultation_cancelled"
  | "payment_received"
  | "payment_confirmed"
  | "message_received"
  | "generic";

export type Channel = "in_app" | "email" | "push" | "sms";

interface CreateNotifInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  channel?: Channel;
  scheduledFor?: Date;
  payload?: Record<string, unknown>;
}

/**
 * Crée une notification (in-app par défaut, sent_at immédiat).
 * Pour planifier (ex: email 24h avant), passer scheduledFor + channel='email'.
 */
export async function createNotification(input: CreateNotifInput) {
  const scheduled = input.scheduledFor ?? new Date();
  const isImmediate = !input.scheduledFor || input.scheduledFor.getTime() <= Date.now();
  const { error } = await supabase.from("scheduled_notifications").insert({
    user_id: input.userId,
    channel: input.channel ?? "in_app",
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    scheduled_for: scheduled.toISOString(),
    sent_at: isImmediate && (input.channel ?? "in_app") === "in_app" ? new Date().toISOString() : null,
    payload: input.payload ?? {},
  });
  if (error) console.error("[notifications] insert error", error);
}

/**
 * Planifie l'ensemble des rappels autour d'une consultation :
 *  - in-app immédiat (création)
 *  - email 24h avant pour patient + pro
 */
export async function scheduleConsultationNotifications(args: {
  consultationId: string;
  proUserId: string;
  patientUserId: string | null;
  scheduledAt: Date;
  proName?: string;
  patientName?: string;
}) {
  const link = `/pro/consultations/${args.consultationId}`;
  const patientLink = `/patient/consultations`;
  const dateLabel = args.scheduledAt.toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  });

  // In-app immédiat — pro
  await createNotification({
    userId: args.proUserId,
    type: "consultation_scheduled",
    title: "Nouvelle consultation planifiée",
    body: `Consultation${args.patientName ? ` avec ${args.patientName}` : ""} le ${dateLabel}.`,
    link,
    payload: { consultation_id: args.consultationId },
  });
  if (args.patientUserId) {
    await createNotification({
      userId: args.patientUserId,
      type: "consultation_scheduled",
      title: "Consultation confirmée",
      body: `Votre consultation${args.proName ? ` avec ${args.proName}` : ""} est prévue le ${dateLabel}.`,
      link: patientLink,
      payload: { consultation_id: args.consultationId },
    });
  }

  // Email rappel 24h avant
  const reminderAt = new Date(args.scheduledAt.getTime() - 24 * 3600 * 1000);
  if (reminderAt.getTime() > Date.now()) {
    await createNotification({
      userId: args.proUserId,
      channel: "email",
      type: "consultation_reminder_24h",
      title: "Rappel : consultation demain",
      body: `Consultation${args.patientName ? ` avec ${args.patientName}` : ""} le ${dateLabel}.`,
      link,
      scheduledFor: reminderAt,
      payload: { consultation_id: args.consultationId },
    });
    if (args.patientUserId) {
      await createNotification({
        userId: args.patientUserId,
        channel: "email",
        type: "consultation_reminder_24h",
        title: "Rappel : votre consultation demain",
        body: `Votre consultation${args.proName ? ` avec ${args.proName}` : ""} aura lieu le ${dateLabel}.`,
        link: patientLink,
        scheduledFor: reminderAt,
        payload: { consultation_id: args.consultationId },
      });
    }
  }
}
