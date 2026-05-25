import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";

export const Route = createFileRoute("/patient/notifications")({
  head: () => ({ meta: [{ title: "Notifications — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout><Content /></PatientLayout>
    </ProtectedRoute>
  ),
});

function Content() {
  const { items, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => void markAllAsRead()}>
            <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      {items === null ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Aucune notification.
        </CardContent></Card>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const inner = (
              <Card className={cn(
                "transition-colors hover:bg-muted/40",
                !n.read_at && "border-l-4 border-l-[#6DB33F]",
              )}>
                <CardContent className="p-3 sm:p-4 flex gap-3">
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                    !n.read_at ? "bg-[#6DB33F]/15 text-[#2D7A1F]" : "bg-muted text-muted-foreground",
                  )}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm", !n.read_at ? "font-semibold" : "font-medium")}>{n.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(n.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  </div>
                </CardContent>
              </Card>
            );
            return (
              <li key={n.id} onClick={() => !n.read_at && void markAsRead(n.id)}>
                {n.link ? <Link to={n.link}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
