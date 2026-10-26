import { createFileRoute } from "@tanstack/react-router";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { FeedView } from "@/components/FeedView";
import { SanctionsNotice } from "@/components/SanctionsNotice";
import { GroupInvitations } from "@/components/GroupInvitations";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed — DietFitPro" }] }),
  component: FeedPage,
});

function FeedPage() {
  return (
    <ProtectedRoute allow={["subscriber", "patient"]}>
      <SubscriberLayout>
        <FeedContent />
      </SubscriberLayout>
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