import type { MainMission, MapNode } from "@/context/GameContext";
import type { GameRuntimeState, StateChanges } from "@/lib/gameState";

export type AdventureEndReason = "victory" | "early_exit" | "death";

const EARLY_EXIT_PATTERN =
  /\b(end (the )?adventure|quit|give up|abandon (the )?(quest|adventure|mission)|leave (the )?(adventure|quest)|retreat (and )?(end|leave|stop)|stop (the )?(adventure|quest)|end (my )?journey early)\b/i;

export function isEarlyExitAction(action: string): boolean {
  return EARLY_EXIT_PATTERN.test(action.trim());
}

export function findHealingPotion(state: GameRuntimeState) {
  return state.inventory.find(
    (item) =>
      item.id === "healing-potion" ||
      item.name.toLowerCase().includes("healing potion") ||
      item.name.toLowerCase() === "potion",
  );
}

function roll2d4Plus2(): number {
  const d4 = () => Math.floor(Math.random() * 4) + 1;
  return d4() + d4() + 2;
}

export type AutoPotionResult = {
  state: GameRuntimeState;
  used: boolean;
  healAmount: number;
};

export function applyAutoHealingPotion(state: GameRuntimeState): AutoPotionResult {
  if (state.hp > 0) {
    return { state, used: false, healAmount: 0 };
  }

  const potion = findHealingPotion(state);
  if (!potion) {
    return { state, used: false, healAmount: 0 };
  }

  const healAmount = roll2d4Plus2();
  const newHp = Math.min(state.maxHp, healAmount);

  return {
    state: {
      ...state,
      hp: newHp,
      inventory: state.inventory.filter((item) => item.id !== potion.id),
    },
    used: true,
    healAmount,
  };
}

function inventoryHasTarget(state: GameRuntimeState, target: string): boolean {
  const needle = target.toLowerCase().trim();
  if (!needle) return false;

  return state.inventory.some((item) => {
    const name = item.name.toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
}

function flagsIndicateMissionComplete(
  flags: Record<string, boolean>,
  changes?: StateChanges | null,
): boolean {
  if (flags.mission_complete || flags.mission_target_defeated || flags.mission_object_obtained) {
    return true;
  }

  const newFlags = changes?.flags_set ?? {};
  return Boolean(
    newFlags.mission_complete ||
      newFlags.mission_target_defeated ||
      newFlags.mission_object_obtained,
  );
}

export function shouldCompleteReachMission(mission: MainMission | null, node: MapNode): boolean {
  if (!mission || mission.type !== "reach") return false;
  if (!node.isGoal) return false;
  if (mission.targetNodeId) {
    return node.id === mission.targetNodeId;
  }
  return true;
}

export function evaluateMissionVictory(
  mission: MainMission | null,
  node: MapNode,
  state: GameRuntimeState,
  stateChanges?: StateChanges | null,
): boolean {
  if (!mission) {
    return Boolean(stateChanges?.node_complete && node.isGoal);
  }

  const flags = state.flags;

  if (mission.type === "slay") {
    return flagsIndicateMissionComplete(flags, stateChanges);
  }

  if (mission.type === "recover") {
    if (flagsIndicateMissionComplete(flags, stateChanges)) return true;
    return inventoryHasTarget(state, mission.target);
  }

  return false;
}

export function getEndReasonLabel(reason: AdventureEndReason | null): string {
  switch (reason) {
    case "victory":
      return "Mission Complete!";
    case "early_exit":
      return "Adventure Ended Early";
    case "death":
      return "You Have Fallen";
    default:
      return "Adventure Over";
  }
}

export function getEndReasonDescription(
  reason: AdventureEndReason | null,
  mission: MainMission | null,
): string {
  switch (reason) {
    case "victory":
      if (mission?.type === "slay") return `You defeated ${mission.target}.`;
      if (mission?.type === "reach") return `You reached ${mission.target}.`;
      if (mission?.type === "recover") return `You recovered ${mission.target}.`;
      return "Your quest is complete.";
    case "early_exit":
      return "You chose to leave the adventure behind.";
    case "death":
      return "Your hero succumbed to their wounds with no healing left.";
    default:
      return "Your story reaches its conclusion.";
  }
}
