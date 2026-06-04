import { createFileRoute } from "@tanstack/react-router";
import { ProLayout } from "@/layouts/ProLayout";
import { Rss } from "lucide-react";

export const Route = createFileRoute("/pro/feed")({
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
        <Rss className="h-6 w-6 text-[#6DB33F]" />
        <h1 className="text-2xl font-bold">Feed</h1>
      </div>
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <Rss className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Aucun contenu pour le moment</p>
        <p className="text-sm mt-1">Les publications apparaîtront ici</p>
      </div>
    </div>
  );
}