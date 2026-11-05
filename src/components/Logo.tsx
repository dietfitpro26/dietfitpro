type LogoProps = {
  className?: string;
  size?: "sm" | "lg";
};

export function Logo({ className = "", size = "sm" }: LogoProps) {
  if (size === "lg") {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <img
          src="/logo.png"
          alt="DietFitPro"
          className="h-40 w-40 object-contain sm:h-52 sm:w-52"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="h-11 w-11 shrink-0 object-contain"
      />
      <div className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold tracking-tight">DietFitPro</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          by Diet N Trainer
        </span>
      </div>
    </div>
  );
}