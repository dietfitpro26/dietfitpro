import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Video, Plus } from "lucide-react";
import { toast } from "sonner";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/patient/consultations")({
  head: () => ({ meta: [{ title: "Mes consultations — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout><Content /></PatientLayout>
    </ProtectedRoute>
  ),
});

type Status = "scheduled" | "completed" | "cancelled" | "refunded" | "no_show";
type PayStatus = "pending" | "paid" | "refunded" | "partial_refund" | "failed";
interface Row {
  id: string;
  scheduled_at: string | null;
  duration_min: number | null;
  status: Status;
  payment_status: PayStatus;
  amount_cents: number | null;
  room_url: string | null;
  pro_id: string;
  pro_name?: string;
}

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Planifiée", completed: "Terminée", cancelled: "Annulée",
  refunded: "Remboursée", no_show: "Absent",
};
const PAY_LABEL: Record<PayStatus, string> = {
  pending: "En attente", paid: "Payé", refunded: "Remboursé",
  partial_refund: "Remb. partiel", failed: "Échec",
};

function Content() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("visio_consultations")
        .select("id, scheduled_at, duration_min, status, payment_status, amount_cents, room_url, pro_id")
        .eq("patient_user_id", user.id)
        .order("scheduled_at", { ascending: false });
      const list = (data ?? []) as Row[];
      const proIds = Array.from(new Set(list.map((r) => r.pro_id)));
      if (proIds.length) {
        const { data: pros } = await supabase.from("profiles").select("id, full_name").in("id", proIds);
        const map = new Map((pros ?? []).map((p) => [p.id as string, (p as { full_name?: string }).full_name ?? ""]));
        list.forEach((r) => { r.pro_name = map.get(r.pro_id) ?? ""; });
      }
      setRows(list);
    })();
  }, [user]);

  const now = Date.now();
  const upcoming = rows?.filter((r) => r.status === "scheduled" && r.scheduled_at && new Date(r.scheduled_at).getTime() >= now) ?? null;
  const past = rows?.filter((r) => !(r.status === "scheduled" && r.scheduled_at && new Date(r.scheduled_at).getTime() >= now)) ?? null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes consultations</h1>
        <Button
          className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white"
          onClick={() => toast.info("Contactez votre praticien pour planifier un RDV.")}
        >
          <Plus className="h-4 w-4" /> Prendre rendez-vous
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">À venir</CardTitle></CardHeader>
        <CardContent>
          {upcoming === null ? <Skeleton className="h-20 w-full" />
            : upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Aucune consultation à venir.</p>
            : <ul className="divide-y">{upcoming.map((r) => <UpcomingItem key={r.id} row={r} />)}</ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
        <CardContent>
          {past === null ? <Skeleton className="h-20 w-full" />
            : past.length === 0 ? <p className="text-sm text-muted-foreground">Aucune consultation passée.</p>
            : <ul className="divide-y">{past.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{r.scheduled_at ? format(new Date(r.scheduled_at), "dd/MM/yyyy HH:mm") : "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.pro_name || "Praticien"} · {STATUS_LABEL[r.status]}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{r.amount_cents != null ? `${(r.amount_cents / 100).toFixed(2)} €` : "—"}</div>
                    <PayBadge status={r.payment_status} />
                  </div>
                </li>
              ))}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}

function UpcomingItem({ row }: { row: Row }) {
  const startsIn = row.scheduled_at ? new Date(row.scheduled_at).getTime() - Date.now() : Infinity;
  const canJoin = startsIn <= 15 * 60 * 1000 && startsIn >= -60 * 60 * 1000;
  return (
    <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 text-sm">
      <div>
        <div className="font-medium">
          {row.scheduled_at ? format(new Date(row.scheduled_at), "EEEE dd MMMM 'à' HH:mm") : "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          {row.pro_name || "Praticien"} · {row.duration_min ?? 30} min · <PayBadge status={row.payment_status} />
        </div>
      </div>
      <Button
        size="sm"
        disabled={!canJoin}
        className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white disabled:bg-muted disabled:text-muted-foreground"
        onClick={() => {
          if (row.room_url) window.open(row.room_url, "_blank", "noopener");
          else toast.info("Lien visio bientôt disponible.");
        }}
      >
        <Video className="h-4 w-4" /> {canJoin ? "Rejoindre la visio" : "Bientôt disponible"}
      </Button>
    </li>
  );
}

function PayBadge({ status }: { status: PayStatus }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ml-1",
      status === "paid" && "bg-[#6DB33F]/15 text-[#2D7A1F]",
      status === "pending" && "bg-amber-100 text-amber-700",
      status === "refunded" && "bg-blue-100 text-blue-700",
      status === "partial_refund" && "bg-blue-100 text-blue-700",
      status === "failed" && "bg-red-100 text-red-700",
    )}>{PAY_LABEL[status]}</span>
  );
}
