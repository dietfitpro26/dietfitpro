import { createFileRoute } from "@tanstack/react-router";
import { ProLayout } from "@/layouts/ProLayout";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/pro/settings")({
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
        <Settings className="h-6 w-6 text-[#6DB33F]" />
        <h1 className="text-2xl font-bold">Paramètres</h1>
      </div>
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <Settings className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Paramètres à venir</p>
        <p className="text-sm mt-1">La configuration de votre compte apparaîtra ici</p>
      </div>
    </div>
  );
}