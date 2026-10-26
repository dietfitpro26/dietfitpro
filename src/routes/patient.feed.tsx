import { createFileRoute } from "@tanstack/react-router";
import { PatientLayout } from "@/layouts/PatientLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { FeedView } from "@/components/FeedView";
import { SanctionsNotice } from "@/components/SanctionsNotice";
import { GroupInvitations } from "@/components/GroupInvitations";

export const Route = createFileRoute("/patient/feed")({
  head: () => ({ meta: [{ title: "Feed — Patient — DietFitPro" }] }),
  component: PatientFeedPage,
});

function PatientFeedPage() {
  return (
    <ProtectedRoute allow={["patient"]}>
      <PatientLayout>
        <FeedContent />
      </PatientLayout>
    </ProtectedRoute>
  );
}

function FeedContent() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3 empty:hidden">
        <SanctionsNotice />
        <GroupInvitations />
      </div>
      <FeedView userId={user.id} />
    </>
  );
}