import type { DiceType } from "@/lib/dice";
import { DICE_SIDES, normalizeDiceType } from "@/lib/dice";
import { cn } from "@/lib/utils";

interface DieVisualProps {
  dice: DiceType;
  value: number | string;
  isRolling: boolean;
  className?: string;
}

function DieShape({ dice, className }: { dice: DiceType; className?: string }) {
  switch (dice) {
    case "D4":
      return (
        <svg viewBox="0 0 100 100" className={cn("w-full h-full", className)} aria-hidden>
          <polygon
            points="50,8 92,88 8,88"
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        </svg>
      );
    case "D6":
      return (
        <svg viewBox="0 0 100 100" className={cn("w-full h-full", className)} aria-hidden>
          <rect
            x="12"
            y="12"
            width="76"
            height="76"
            rx="10"
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        </svg>
      );
    case "D8":
      return (
        <svg viewBox="0 0 100 100" className={cn("w-full h-full", className)} aria-hidden>
          <polygon
            points="50,6 94,50 50,94 6,50"
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        </svg>
      );
    case "D10":
      return (
        <svg viewBox="0 0 100 100" className={cn("w-full h-full", className)} aria-hidden>
          <polygon
            points="50,4 96,38 78,96 22,96 4,38"
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        </svg>
      );
    case "D12":
      return (
        <svg viewBox="0 0 100 100" className={cn("w-full h-full", className)} aria-hidden>
          <polygon
            points="50,4 85,18 96,52 78,88 22,88 4,52 15,18"
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        </svg>
      );
    case "D20":
    default:
      return (
        <svg viewBox="0 0 100 100" className={cn("w-full h-full", className)} aria-hidden>
          <polygon
            points="50,8 84,28 84,72 50,92 16,72 16,28"
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        </svg>
      );
  }
}

export function DieVisual({ dice, value, isRolling, className }: DieVisualProps) {
  const normalized = normalizeDiceType(dice);
  const sides = DICE_SIDES[normalized];
  const fontSize =
    typeof value === "number" && value >= 10
      ? "text-xl"
      : typeof value === "string" && value.length > 2
        ? "text-base"
        : "text-2xl";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        isRolling && "die-tumble",
        className,
      )}
      style={{ perspective: "600px" }}
    >
      <div className={cn("absolute inset-0", isRolling && "die-tumble-inner")}>
        <DieShape dice={normalized} />
      </div>
      <span
        className={cn(
          "relative z-10 font-display text-primary drop-shadow-sm",
          fontSize,
          isRolling && "animate-pulse",
        )}
      >
        {value}
      </span>
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-display uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {normalized} · {sides} faces
      </span>
    </div>
  );
}
