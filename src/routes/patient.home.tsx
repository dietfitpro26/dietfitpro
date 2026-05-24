import { createFileRoute } from "@tanstack/react-router";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/patient/home")({
  head: () => ({ meta: [{ title: "Accueil — DietFitPro" }] }),
  component: PatientHomePage,
});

function PatientHomePage() {
  return (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold">Accueil Patient — étape suivante</h1>
        </div>
      </PatientLayout>
    </ProtectedRoute>
  );
}
