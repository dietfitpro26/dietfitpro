import { createFileRoute } from "@tanstack/react-router";
import { ProLayout } from "@/layouts/ProLayout";
import { UserCheck } from "lucide-react";

export const Route = createFileRoute("/pro/subscribers")({
  component: Page,
});

function Page() {
  return (
    <ProLayout>
      <Content />
    </ProLayout>
  );
}

function Content() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <UserCheck className="h-6 w-6 text-[#6DB33F]" />
        <h1 className="text-2xl font-bold">Abonnés</h1>
      </div>
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Aucun abonné pour le moment</p>
        <p className="text-sm mt-1">Vos abonnés apparaîtront ici</p>
      </div>
    </div>
  );
}