import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PatientLayout } from "@/layouts/PatientLayout";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/patient/messages")({
  head: () => ({ meta: [{ title: "Messagerie — Patient" }] }),
  component: PatientMessagesPage,
});

function PatientMessagesPage() {
  return (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <MessagesView />
      </PatientLayout>
    </ProtectedRoute>
  );
}
