import { createFileRoute } from "@tanstack/react-router";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Accueil — DietFitPro" }] }),
  component: SubscriberHomePage,
});

function SubscriberHomePage() {
  return (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold">Accueil Abonné — étape suivante</h1>
        </div>
      </SubscriberLayout>
    </ProtectedRoute>
  );
}
