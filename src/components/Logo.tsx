import { Activity } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Activity className="h-5 w-5" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight">DietFitPro</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          by Diet N Trainer
        </span>
      </div>
    </div>
  );
}
