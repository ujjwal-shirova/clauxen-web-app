import { cn } from "@/lib/utils";

type ClauxenWordmarkProps = {
  className?: string;
  height?: number;
};

/** App-matched brand mark: Clauxen icon asset + label. */
export function ClauxenWordmark({
  className,
  height = 28,
}: ClauxenWordmarkProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2.5 text-zinc-900", className)}
      role="img"
      aria-label="Clauxen"
    >
      <img
        src="/assets/icons/clauxen-icon.png"
        alt=""
        width={height}
        height={height}
        className="shrink-0 object-contain"
        style={{ width: height, height }}
      />
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: Math.round(height * 0.82) }}
      >
        Clauxen
      </span>
    </div>
  );
}
