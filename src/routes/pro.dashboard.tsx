import { createFileRoute } from "@tanstack/react-router";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/pro/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DietFitPro" }] }),
  component: ProDashboardPage,
});

function ProDashboardPage() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold">Dashboard Pro — étape 7</h1>
        </div>
      </ProLayout>
    </ProtectedRoute>
  );
}
