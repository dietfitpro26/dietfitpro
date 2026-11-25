import { Card, CardContent } from "@/components/ui/card";

export function V2FeatureUnavailable({ feature }: { feature: string }) {
  return (
    <Card className="mx-auto max-w-2xl border-dashed">
      <CardContent className="space-y-2 p-6 text-center">
        <h1 className="text-lg font-semibold">{feature}</h1>
        <p className="text-sm text-muted-foreground">
          Cette fonctionnalité n’est pas activée pour la BETA Diet Fit Pro.
        </p>
      </CardContent>
    </Card>
  );
}
