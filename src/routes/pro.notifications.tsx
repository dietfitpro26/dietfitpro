import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowRight,
  Bell,
  CheckCheck,
  FileText,
} from "lucide-react";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";

export const Route = createFileRoute("/pro/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — DietFitPro" }],
  }),
  component: () => (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <Content />
      </ProLayout>
    </ProtectedRoute>
  ),
});

function Content() {
  const {
    items,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">
            Notifications
          </h1>

          <p className="text-xs text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
              : "Tout est à jour"}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void markAllAsRead()}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Tout marquer comme lu
          </Button>
        )}
      </header>

      <div className="w-full max-w-3xl space-y-3 p-4 sm:p-6">
        {items === null ? (
          [1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-20 w-full"
            />
          ))
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Aucune notification.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((notification) => {
              const isCustomProgram =
                String(notification.type) ===
                "custom_program_purchase";

              const isUnread = !notification.read_at;
              const isHighlighted =
                isCustomProgram && isUnread;

              const inner = (
                <Card
                  className={cn(
                    "transition-colors",
                    isHighlighted
                      ? "border-amber-300 border-l-4 border-l-amber-500 bg-amber-50 hover:bg-amber-100/70"
                      : "bg-white hover:bg-muted/40",
                    !isCustomProgram &&
                      isUnread &&
                      "border-l-4 border-l-[#6DB33F]",
                  )}
                >
                  <CardContent className="flex gap-3 p-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        isHighlighted
                          ? "bg-amber-200/70 text-amber-900"
                          : isUnread
                            ? "bg-[#6DB33F]/15 text-[#2D7A1F]"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isCustomProgram ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {isCustomProgram && (
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-semibold",
                              isHighlighted
                                ? "bg-amber-200 text-amber-950"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            Programme personnalisé acheté
                          </span>

                          {isUnread ? (
                            <span className="text-xs font-semibold text-amber-900">
                              Nouveau
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <CheckCheck className="h-3.5 w-3.5" />
                              Lu
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-start justify-between gap-1 sm:gap-3">
                        <p
                          className={cn(
                            "break-words text-sm",
                            isHighlighted
                              ? "text-amber-950"
                              : "text-foreground",
                            isUnread
                              ? "font-semibold"
                              : "font-medium",
                          )}
                        >
                          {notification.title}
                        </p>

                        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                          {format(
                            new Date(notification.created_at),
                            "dd/MM/yyyy HH:mm",
                          )}
                        </span>
                      </div>

                      {notification.body && (
                        <p
                          className={cn(
                            "mt-1 break-words text-sm",
                            isHighlighted
                              ? "text-amber-900"
                              : "text-muted-foreground",
                          )}
                        >
                          {notification.body}
                        </p>
                      )}

                      {isCustomProgram && (
                        <div className="mt-3 space-y-2">
                          {isUnread && (
                            <p className="text-sm font-medium text-amber-950">
                              Préparation du programme à vérifier.
                            </p>
                          )}

                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4",
                              isHighlighted
                                ? "text-amber-950"
                                : "text-[#2D7A1F]",
                            )}
                          >
                            Ouvrir les abonnés
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );

              const destination = isCustomProgram
                ? "/pro/subscribers"
                : notification.link;

              return (
                <li key={notification.id}>
                  {destination ? (
                    <Link
                      to={destination}
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      onClick={() => {
                        if (isUnread) {
                          void markAsRead(notification.id);
                        }
                      }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div>
                      {inner}

                      {isUnread && (
                        <div className="mt-1 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void markAsRead(notification.id)
                            }
                          >
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Marquer comme lue
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}