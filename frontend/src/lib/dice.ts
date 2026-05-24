import type { CharacterStats } from "@/context/GameContext";

export type DiceType = "D4" | "D6" | "D8" | "D10" | "D12" | "D20";

export type RollOutcome =
  | "critical_fail"
  | "fail"
  | "partial"
  | "success"
  | "critical_success";

export type AbilityKey = keyof CharacterStats;

export interface RollCheck {
  type: "ability_check" | "saving_throw" | "attack_roll" | "skill_check";
  dice: DiceType;
  ability: AbilityKey;
  skill?: string;
  dc: number;
  reason: string;
}

export interface RollResult {
  dice: DiceType;
  raw: number;
  modifier: number;
  total: number;
  dc: number;
  outcome: RollOutcome;
}

export const DICE_SIDES: Record<DiceType, number> = {
  D4: 4,
  D6: 6,
  D8: 8,
  D10: 10,
  D12: 12,
  D20: 20,
};

export function normalizeDiceType(dice: string | undefined): DiceType {
  if (!dice) return "D20";
  const cleaned = dice.trim().toUpperCase();
  if (cleaned in DICE_SIDES) return cleaned as DiceType;
  const numeric = cleaned.replace(/^D?/, "");
  const candidate = `D${numeric}` as DiceType;
  if (candidate in DICE_SIDES) return candidate;
  return "D20";
}

export function getDiceSides(dice: DiceType | string): number {
  return DICE_SIDES[normalizeDiceType(dice)];
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getModifierFromCharacter(
  stats: CharacterStats,
  ability: AbilityKey,
): number {
  return getAbilityModifier(stats[ability]);
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(dice: DiceType): number {
  return rollDie(DICE_SIDES[dice]);
}

export function resolveOutcome(
  raw: number,
  total: number,
  dc: number,
  dice: DiceType,
): RollOutcome {
  if (dice === "D20") {
    if (raw === 1) return "critical_fail";
    if (raw === 20) return "critical_success";
  }

  if (total >= dc + 5) return "critical_success";
  if (total >= dc) return "success";
  if (total >= dc - 2) return "partial";
  return "fail";
}

export function performRoll(
  check: RollCheck,
  stats: CharacterStats,
): RollResult {
  const modifier = getModifierFromCharacter(stats, check.ability);
  const raw = rollDice(check.dice);
  const total = raw + modifier;

  return {
    dice: check.dice,
    raw,
    modifier,
    total,
    dc: check.dc,
    outcome: resolveOutcome(raw, total, check.dc, check.dice),
  };
}

export const OUTCOME_LABELS: Record<RollOutcome, string> = {
  critical_fail: "Critical Fail!",
  fail: "Fail",
  partial: "Partial Success",
  success: "Success!",
  critical_success: "Critical Success!",
};

export function formatCheckLabel(check: RollCheck): string {
  const skillPart = check.skill ? ` (${check.skill})` : "";
  return `${check.ability}${skillPart} · DC ${check.dc}`;
}

export function toRollCheck(raw: {
  type?: string;
  ability?: string;
  skill?: string;
  dc?: number;
  reason?: string;
  dice?: string;
} | null | undefined): RollCheck | null {
  if (!raw?.ability || raw.dc == null) return null;

  return {
    type: (raw.type as RollCheck["type"]) || "ability_check",
    dice: normalizeDiceType(raw.dice),
    ability: raw.ability as AbilityKey,
    skill: raw.skill,
    dc: raw.dc,
    reason: raw.reason || "Ability check",
  };
}

export function toRollResult(
  roll: { d20: number; modifier: number; total: number; dc: number; outcome: string },
  check: RollCheck,
): RollResult {
  return {
    dice: check.dice,
    raw: roll.d20,
    modifier: roll.modifier,
    total: roll.total,
    dc: roll.dc,
    outcome: roll.outcome as RollOutcome,
  };
}
