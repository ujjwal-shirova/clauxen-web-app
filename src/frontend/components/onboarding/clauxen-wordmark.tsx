import { cn } from "@/frontend/lib/utils";

type ClauxenWordmarkProps = {
  className?: string;
  height?: number;
};

/** Wordmark inspired by onboarding reference; uses Clauxen diamond + label */
export function ClauxenWordmark({
  className,
  height = 24,
}: ClauxenWordmarkProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2 text-zinc-900", className)}
      role="img"
      aria-label="Clauxen"
    >
      <svg
        width={height}
        height={height}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden
      >
        <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="#d97757" />
        <path d="M12 12L22 7L12 2L2 7L12 12Z" fill="white" fillOpacity="0.55" />
      </svg>
      <span
        className="font-serif text-[1.35em] font-medium tracking-tight"
        style={{ fontSize: height * 0.9 }}
      >
        Clauxen
      </span>
    </div>
  );
}
