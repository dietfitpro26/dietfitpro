import { useEffect, useMemo, useState } from "react";
import { addDays, format, setHours, setMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock3, Loader2, Plus, UserRound, CheckCircle2 } from "lucide-react";

import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/agenda")({
  head: () => ({ meta: [{ title: "Agenda — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <PatientAgendaPage />
      </PatientLayout>
    </ProtectedRoute>
  ),
});

interface PatientRow {
  id: string;
  user_id: string | null;
  pro_id: string;
  first_name: string;
  last_name: string;
}

interface ProfileRow {
  full_name: string | null;
}

interface SlotItem {
  id: string;
  startsAt: string;
  durationMin: number;
}

function PatientAgendaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [proName, setProName] = useState<string>("");

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    if (!user) return;

    void (async () => {
      setLoading(true);

      const { data: patientRow, error: patientError } = await supabase
        .from("patients")
        .select("id, user_id, pro_id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (patientError || !patientRow) {
        setPatient(null);
        setLoading(false);
        return;
      }

      const currentPatient = patientRow as PatientRow;
      setPatient(currentPatient);

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentPatient.pro_id)
        .maybeSingle();

      setProName((profileRow as ProfileRow | null)?.full_name ?? "");
      setLoading(false);
    })();
  }, [user]);

  const availableSlots = useMemo<SlotItem[]>(() => {
    const now = new Date();
    const slots: SlotItem[] = [];
    const hourTemplates = [9, 11, 14, 16];

    for (let dayOffset = 1; dayOffset <= 10; dayOffset += 1) {
      const day = addDays(now, dayOffset);

      if (day.getDay() === 0 || day.getDay() === 6) continue;

      hourTemplates.forEach((hour, index) => {
        const start = setMinutes(setHours(new Date(day), hour), 0);

        if (start <= now) return;

        slots.push({
          id: `${format(start, "yyyy-MM-dd-HH-mm")}-${index}`,
          startsAt: start.toISOString(),
          durationMin: 45,
        });
      });
    }

    return slots.slice(0, 12);
  }, []);

  const selectedSlot = useMemo(() => {
    return availableSlots.find((slot) => slot.id === selectedSlotId) ?? null;
  }, [availableSlots, selectedSlotId]);

  async function handleBookAppointment() {
    if (!user || !patient || !selectedSlot) return;

    setSubmitting(true);
    setSuccessMessage("");

    const payload = {
      pro_id: patient.pro_id,
      patient_id: patient.id,
      patient_user_id: user.id,
      scheduled_at: selectedSlot.startsAt,
      duration_min: selectedSlot.durationMin,
      status: "scheduled",
      payment_status: "pending",
      amount_cents: 0,
      cancellation_fee_cents: 0,
      notes: null,
      room_url: null,
    };

    const { error } = await supabase
      .from("visio_consultations")
      .insert(payload)
      .select();

    if (error) {
      setSubmitting(false);
      alert("Impossible de réserver ce rendez-vous pour le moment.");
      return;
    }

    setSubmitting(false);
    setSuccessMessage("Votre rendez-vous a bien été programmé.");

    window.setTimeout(() => {
      navigate({ to: "/patient/dashboard" });
    }, 900);
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold">Prendre un rendez-vous</h1>
                <p className="text-sm text-muted-foreground">
                  Choisissez un créneau disponible pour votre prochaine consultation visio.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  <CalendarDays className="h-4 w-4" />
                  Réservation rapide
                </span>

                {patient && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                    {patient.first_name} {patient.last_name}
                  </span>
                )}

                {proName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    Praticien : {proName}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Consultation visio</p>
              <p className="mt-1 text-muted-foreground">
                Durée standard : 45 minutes.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Créneaux disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-24 rounded-2xl" />
                  ))}
                </div>
              ) : !patient ? (
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">Profil patient introuvable</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Impossible de préparer la réservation sans dossier patient associé.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {availableSlots.map((slot) => {
                    const active = selectedSlotId === slot.id;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "bg-card hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">
                              {format(new Date(slot.startsAt), "EEEE dd MMMM", { locale: fr })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(slot.startsAt), "HH:mm", { locale: fr })}
                            </p>
                          </div>

                          <div className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                            {slot.durationMin} min
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          Consultation à distance
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-48 w-full rounded-2xl" />
              ) : !patient ? (
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">Aucune réservation possible</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vérifiez que votre compte est bien relié à un dossier patient.
                  </p>
                </div>
              ) : !selectedSlot ? (
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">Choisissez un créneau</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sélectionnez une date pour afficher le détail et confirmer votre demande.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-foreground">
                      {format(new Date(selectedSlot.startsAt), "EEEE dd MMMM yyyy", { locale: fr })}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      À {format(new Date(selectedSlot.startsAt), "HH:mm", { locale: fr })} · {selectedSlot.durationMin} min
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {proName ? `Avec ${proName}` : "Avec votre praticien"}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Informations enregistrées</p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>
                        Patient : {patient.first_name} {patient.last_name}
                      </p>
                      <p>
                        Statut initial : scheduled
                      </p>
                      <p>
                        Paiement initial : pending
                      </p>
                    </div>
                  </div>

                  {successMessage ? (
                    <div className="rounded-2xl bg-green-100 p-4 text-sm font-medium text-green-800 dark:bg-green-950/30 dark:text-green-300">
                      {successMessage}
                    </div>
                  ) : null}

                  <Button
                    className="w-full rounded-2xl"
                    onClick={handleBookAppointment}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Réservation en cours
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Confirmer le rendez-vous
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full rounded-2xl"
                    onClick={() => navigate({ to: "/patient/dashboard" })}
                    disabled={submitting}
                  >
                    Retour au dashboard
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}