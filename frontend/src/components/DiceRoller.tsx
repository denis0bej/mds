import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  type RollCheck,
  type RollResult,
  OUTCOME_LABELS,
  formatCheckLabel,
  normalizeDiceType,
  getDiceSides,
} from "@/lib/dice";
import { DieVisual } from "@/components/DieVisual";
import { cn } from "@/lib/utils";

interface DiceRollerProps {
  check: RollCheck;
  result: RollResult | null;
  isRolling: boolean;
  onAnimationComplete?: () => void;
}

const OUTCOME_STYLES: Record<
  RollResult["outcome"],
  { text: string; border: string; glow: string }
> = {
  critical_fail: {
    text: "text-destructive",
    border: "border-destructive",
    glow: "shadow-[0_0_20px_hsl(var(--destructive)/0.45)]",
  },
  fail: {
    text: "text-orange-400",
    border: "border-orange-400/60",
    glow: "shadow-[0_0_12px_rgba(251,146,60,0.25)]",
  },
  partial: {
    text: "text-yellow-400",
    border: "border-yellow-400/50",
    glow: "shadow-[0_0_12px_rgba(250,204,21,0.2)]",
  },
  success: {
    text: "text-primary text-gold-glow",
    border: "border-primary",
    glow: "shadow-[0_0_18px_hsl(var(--gold-glow)/0.35)]",
  },
  critical_success: {
    text: "text-primary text-gold-glow",
    border: "border-primary",
    glow: "shadow-[0_0_28px_hsl(var(--gold-glow)/0.55)]",
  },
};

const ROLL_DURATION_MS = 1500;

export function DiceRoller({
  check,
  result,
  isRolling,
  onAnimationComplete,
}: DiceRollerProps) {
  const diceType = normalizeDiceType(result?.dice ?? check.dice);
  const sides = getDiceSides(diceType);
  const [displayValue, setDisplayValue] = useState<number | string>("?");

  useEffect(() => {
    if (!isRolling) {
      if (result) {
        setDisplayValue(result.raw);
      }
      return;
    }

    setDisplayValue("?");
    const interval = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * sides) + 1);
    }, 70);

    return () => clearInterval(interval);
  }, [isRolling, sides, result]);

  useEffect(() => {
    if (!isRolling && result) {
      setDisplayValue(result.raw);
      onAnimationComplete?.();
    }
  }, [isRolling, result, onAnimationComplete]);

  const outcomeStyle = result ? OUTCOME_STYLES[result.outcome] : null;
  const showResult = result && !isRolling;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "bg-card border border-gold rounded-md p-4",
        showResult && outcomeStyle?.glow,
        showResult && outcomeStyle?.border,
      )}
    >
      <h3 className="font-display text-xs uppercase tracking-wider text-primary mb-4">
        Dice Roll
      </h3>

      <div className="flex items-start gap-4">
        <div
          className={cn(
            "relative shrink-0 w-[88px] h-[88px] pb-5",
            showResult && outcomeStyle?.border,
            showResult && "rounded-md",
          )}
        >
          <DieVisual
            dice={diceType}
            value={displayValue}
            isRolling={isRolling}
            className="w-[88px] h-[88px]"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5 pt-1">
          {showResult ? (
            <>
              <div className="font-display text-base text-primary leading-tight">
                Roll: {result.raw}
                {result.modifier !== 0 && (
                  <span className="text-muted-foreground text-sm">
                    {" "}
                    {result.modifier > 0 ? "+" : ""}
                    {result.modifier} ={" "}
                    <span className="text-foreground">{result.total}</span>
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "font-display text-sm uppercase tracking-wider",
                  outcomeStyle?.text,
                )}
              >
                {OUTCOME_LABELS[result.outcome]}
              </div>
            </>
          ) : (
            <div className="font-display text-sm text-primary animate-pulse">
              Rolling {diceType}...
            </div>
          )}

          <div className="text-xs text-muted-foreground font-body">
            {formatCheckLabel({ ...check, dice: diceType })}
          </div>

          {check.reason && (
            <div className="text-xs text-muted-foreground/80 font-body italic line-clamp-2">
              {check.reason}
            </div>
          )}

          {showResult && result.modifier !== 0 && (
            <div className="text-[11px] text-muted-foreground font-body">
              {check.ability} mod:{" "}
              <span className="text-foreground">
                {result.modifier > 0 ? "+" : ""}
                {result.modifier}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export { ROLL_DURATION_MS };
