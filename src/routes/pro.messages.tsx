import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProLayout } from "@/layouts/ProLayout";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/pro/messages")({
  head: () => ({ meta: [{ title: "Messagerie — Pro" }] }),
  component: ProMessagesPage,
});

function ProMessagesPage() {
  return (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout>
        <MessagesView />
      </ProLayout>
    </ProtectedRoute>
  );
}
