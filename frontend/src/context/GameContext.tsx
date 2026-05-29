import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import type { NarrativeMessage } from "@/components/NarrationPanel";
import {
  applyAutoHealingPotion,
  evaluateMissionVictory,
  shouldCompleteReachMission,
  type AdventureEndReason,
} from "@/lib/adventureEnd";
import {
  createInitialRuntimeState,
  runtimeStateToApi,
  resolveRuntimeStateAfterAction,
  type GameRuntimeState,
  type StateChanges,
} from "@/lib/gameState";
import {
  backfillEventsFromHistory,
  createSessionEvent,
  formatStateChangeSummary,
  loadEventLogVisible,
  saveEventLogVisible,
  type SessionEvent,
} from "@/lib/sessionEvents";
import {
  createInitialSessionStats,
  recordLocationVisit,
  updateSessionStatsAfterAction,
  type SessionStats,
} from "@/lib/sessionStats";

export type { AdventureEndReason } from "@/lib/adventureEnd";

export type MissionType = "slay" | "reach" | "recover";

export type MainMission = {
  type: MissionType;
  title: string;
  target: string;
  targetNodeId?: string;
};

export type { GameRuntimeState, InventoryItem, StatusEffect } from "@/lib/gameState";
export type { SessionEvent, SessionEventType } from "@/lib/sessionEvents";

export interface CharacterStats {
  STR: number;
  DEX: number;
  INT: number;
  WIS: number;
  CON: number;
  CHA: number;
}

export interface CharacterData {
  name: string;
  race: string;
  characterClass: string;
  backstory: string;
  stats: CharacterStats;
}

export type SceneType =
  | "exploration"
  | "trap"
  | "combat"
  | "social"
  | "puzzle"
  | "boss"
  | "reward"
  | "mixed";

export type ElementType =
  | "trap"
  | "monster"
  | "npc"
  | "item"
  | "environmental_hazard"
  | "boss"
  | "reward"
  | "clue"
  | "key_item";

export type RewardType = "item" | "gold" | "xp" | "lore" | "key_item";

export interface NodeElementMechanics {
  dc?: number;
  check_type?: string | null;
  damage?: string | null;
  hp?: number;
  ac?: number;
  cr?: string | null;
}

export interface NodeElementReward {
  type: RewardType;
  name: string;
  description: string;
}

export interface NodeElement {
  type: ElementType;
  name: string;
  description: string;
  mechanics?: NodeElementMechanics;
  rewards?: NodeElementReward[];
}

export interface NodeContent {
  summary: string;
  scene_type: SceneType;
  narrative_seed: string;
  elements: NodeElement[];
  completion_conditions?: string[];
  failure_consequences?: string[];
}

export type MapNode = {
  id: string;
  name: string;
  description: string;
  status: "current" | "discovered" | "hidden";
  isGoal?: boolean;
  x?: number;
  y?: number;
  content?: NodeContent;
};

export type MapEdge = {
  from: string;
  to: string;
  condition?: string;
};

export type GameMap = {
  nodes: MapNode[];
  edges: MapEdge[];
};

export type EncounterData = {
  narrative: string;
  visible_elements: string[];
  suggested_actions: string[];
  adventure_complete?: boolean;
  completion_reason?: AdventureEndReason;
};

const ADVENTURE_STORAGE_KEY = "dnd_adventure_state";

type PersistedAdventure = {
  narrativeIntro: string | null;
  adventureDescription: string | null;
  mainMission: MainMission | null;
  map: GameMap | null;
  currentNodeId: string | null;
  narrativeHistory: NarrativeMessage[];
  progressCompletedNodeIds: string[];
  runtimeState: GameRuntimeState | null;
  sessionEvents: SessionEvent[];
  sessionStats: SessionStats;
  adventureComplete: boolean;
  adventureEndReason: AdventureEndReason | null;
  adventureSummary: AdventureSummaryData | null;
  summaryDownloaded: boolean;
};

export type AdventureSummaryData = {
  title: string;
  narrative: string;
  stats: {
    enemies_defeated: number;
    locations_visited: number;
    items_collected: number;
    hero_name?: string;
    hero_class?: string;
    hero_race?: string;
    location_names?: string[];
  };
};

function loadPersistedAdventure(): PersistedAdventure | null {
  try {
    const raw = localStorage.getItem(ADVENTURE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePersistedAdventure(state: PersistedAdventure) {
  localStorage.setItem(ADVENTURE_STORAGE_KEY, JSON.stringify(state));
}

export type GameActionResult = {
  category: "question" | "simple_action" | "complex_action";
  phase?: "roll_requested" | "roll_resolved";
  narrative: string;
  suggested_actions?: string[];
  state_changes?: StateChanges | null;
  game_state?: Record<string, unknown>;
  roll_result?: {
    d20: number;
    modifier: number;
    total: number;
    dc: number;
    outcome: string;
  };
  check?: {
    type: string;
    ability: string;
    skill?: string;
    dc: number;
    reason: string;
    dice?: string;
  };
  adventure_complete?: boolean;
  completion_reason?: AdventureEndReason;
  auto_potion_used?: boolean;
  auto_potion_heal?: number;
};

export function getAdjacentNodeIds(map: GameMap, nodeId: string): string[] {
  const ids = new Set<string>();
  map.edges.forEach((edge) => {
    if (edge.from === nodeId) ids.add(edge.to);
    if (edge.to === nodeId) ids.add(edge.from);
  });
  return [...ids];
}

export function isAdjacentNode(map: GameMap, fromId: string, toId: string): boolean {
  return getAdjacentNodeIds(map, fromId).includes(toId);
}

export function getTravelStatus(
  map: GameMap,
  targetNodeId: string,
  progressCompletedNodeIds: string[] = [],
): { allowed: boolean; reason?: string; isEnter: boolean } {
  const target = map.nodes.find((n) => n.id === targetNodeId);
  if (!target || target.status === "hidden") {
    return { allowed: false, reason: "That location is still unknown.", isEnter: false };
  }

  const current = map.nodes.find((n) => n.status === "current");
  if (!current) {
    return { allowed: false, reason: "No current location set.", isEnter: false };
  }

  if (current.id === targetNodeId) {
    return { allowed: true, isEnter: true };
  }

  if (!progressCompletedNodeIds.includes(current.id)) {
    return {
      allowed: false,
      reason: "Interact with the Dungeon Master here before traveling to another location.",
      isEnter: false,
    };
  }

  if (!isAdjacentNode(map, current.id, targetNodeId)) {
    return {
      allowed: false,
      reason: "You can only travel to directly connected neighboring locations.",
      isEnter: false,
    };
  }

  return { allowed: true, isEnter: false };
}

export function getAvailableTravelDestinations(
  map: GameMap,
  currentNodeId: string,
  progressCompletedNodeIds: string[] = [],
): MapNode[] {
  if (!progressCompletedNodeIds.includes(currentNodeId)) return [];

  return getAdjacentNodeIds(map, currentNodeId)
    .map((id) => map.nodes.find((n) => n.id === id))
    .filter((node): node is MapNode => {
      if (!node || node.status === "hidden") return false;
      const status = getTravelStatus(map, node.id, progressCompletedNodeIds);
      return status.allowed && !status.isEnter;
    });
}

const TRAVEL_VERB_PATTERN =
  /\b(travel|go|head|walk|journey|move|proceed|venture|make my way|set out|rush|run|sneak|ride|climb)\b/i;

export function resolveTravelDestination(
  map: GameMap,
  currentNodeId: string,
  action: string,
  progressCompletedNodeIds: string[] = [],
): MapNode | null {
  const destinations = getAvailableTravelDestinations(map, currentNodeId, progressCompletedNodeIds);
  if (destinations.length === 0) return null;

  const lower = action.toLowerCase();
  const mentionsTravel =
    TRAVEL_VERB_PATTERN.test(action) ||
    /\b(to|toward|towards|into)\b/i.test(action);

  let best: MapNode | null = null;
  for (const node of destinations) {
    const name = node.name.toLowerCase();
    if (lower === name || lower.includes(name)) {
      if (!best || name.length > best.name.length) best = node;
    }
  }

  if (best && mentionsTravel) return best;
  if (best && destinations.length === 1 && lower.includes(best.name.toLowerCase())) return best;

  return null;
}

/** @deprecated use getTravelStatus */
export function canTravelToNode(
  map: GameMap,
  targetNodeId: string,
  progressCompletedNodeIds: string[] = [],
): boolean {
  return getTravelStatus(map, targetNodeId, progressCompletedNodeIds).allowed;
}

export function applyTravel(map: GameMap, targetNodeId: string): GameMap {
  const adjacentIds = new Set<string>();
  map.edges.forEach((e) => {
    if (e.from === targetNodeId) adjacentIds.add(e.to);
    if (e.to === targetNodeId) adjacentIds.add(e.from);
  });

  const nodes = map.nodes.map((node) => {
    if (node.id === targetNodeId) return { ...node, status: "current" as const };
    if (node.status === "current") return { ...node, status: "discovered" as const };
    if (adjacentIds.has(node.id) && node.status === "hidden") {
      return { ...node, status: "discovered" as const };
    }
    return node;
  });

  return { ...map, nodes };
}

interface GameState {
  character: CharacterData | null;
  setCharacter: (char: CharacterData | null) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  narrativeIntro: string | null;
  adventureDescription: string | null;
  mainMission: MainMission | null;
  map: GameMap | null;
  currentNodeId: string | null;
  narrativeHistory: NarrativeMessage[];
  animateMessageId: string | null;
  currentEncounter: EncounterData | null;
  isEnteringNode: boolean;
  enterNodeError: string | null;
  progressCompletedNodeIds: string[];
  runtimeState: GameRuntimeState | null;
  lastRoll: GameActionResult["roll_result"] | null;
  lastCheck: GameActionResult["check"] | null;
  isSubmittingAction: boolean;
  actionError: string | null;
  sessionEvents: SessionEvent[];
  eventLogVisible: boolean;
  eventLogMinimized: boolean;
  setEventLogVisible: (visible: boolean) => void;
  setEventLogMinimized: (minimized: boolean) => void;
  sessionStats: SessionStats;
  adventureComplete: boolean;
  adventureEndReason: AdventureEndReason | null;
  adventureSummary: AdventureSummaryData | null;
  isGeneratingSummary: boolean;
  summaryError: string | null;
  summaryDownloaded: boolean;
  markSummaryDownloaded: () => void;
  setAdventureData: (
    intro: string,
    mapData: GameMap | null,
    description: string,
    mission?: MainMission | null,
  ) => void;
  updateMap: (mapData: GameMap) => void;
  clearAdventureData: () => void;
  enterLocation: (nodeId: string, travelPrompt?: string) => Promise<void>;
  travelToLocation: (nodeId: string, prompt: string) => Promise<void>;
  submitAction: (action: string) => Promise<void>;
  generateAdventureSummary: () => Promise<AdventureSummaryData>;
  clearAnimateMessage: () => void;
  isLoading: boolean;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const persisted = loadPersistedAdventure();

  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem("dnd_session_id"));
  const [narrativeIntro, setNarrativeIntro] = useState<string | null>(persisted?.narrativeIntro ?? null);
  const [adventureDescription, setAdventureDescription] = useState<string | null>(
    persisted?.adventureDescription ?? null,
  );
  const [mainMission, setMainMission] = useState<MainMission | null>(persisted?.mainMission ?? null);
  const [map, setMap] = useState<GameMap | null>(persisted?.map ?? null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(persisted?.currentNodeId ?? null);
  const [narrativeHistory, setNarrativeHistory] = useState<NarrativeMessage[]>(
    persisted?.narrativeHistory ?? [],
  );
  const [animateMessageId, setAnimateMessageId] = useState<string | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<EncounterData | null>(null);
  const [isEnteringNode, setIsEnteringNode] = useState(false);
  const [enterNodeError, setEnterNodeError] = useState<string | null>(null);
  const [progressCompletedNodeIds, setProgressCompletedNodeIds] = useState<string[]>(
    persisted?.progressCompletedNodeIds ?? [],
  );
  const [runtimeState, setRuntimeState] = useState<GameRuntimeState | null>(
    persisted?.runtimeState ?? null,
  );
  const [lastRoll, setLastRoll] = useState<GameActionResult["roll_result"] | null>(null);
  const [lastCheck, setLastCheck] = useState<GameActionResult["check"] | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>(
    persisted?.sessionStats ?? createInitialSessionStats(),
  );
  const [adventureComplete, setAdventureComplete] = useState(persisted?.adventureComplete ?? false);
  const [adventureEndReason, setAdventureEndReason] = useState<AdventureEndReason | null>(
    persisted?.adventureEndReason ?? null,
  );
  const [adventureSummary, setAdventureSummary] = useState<AdventureSummaryData | null>(
    persisted?.adventureSummary ?? null,
  );
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryDownloaded, setSummaryDownloaded] = useState(persisted?.summaryDownloaded ?? false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>(() => {
    if (persisted?.sessionEvents?.length) return persisted.sessionEvents;
    if (persisted?.narrativeHistory?.length) {
      return backfillEventsFromHistory(persisted.narrativeHistory);
    }
    return [];
  });
  const [eventLogVisible, setEventLogVisibleState] = useState(loadEventLogVisible);
  const [eventLogMinimized, setEventLogMinimized] = useState(false);

  const appendSessionEvent = useCallback((event: SessionEvent) => {
    setSessionEvents((prev) => [...prev, event]);
  }, []);

  const markSummaryDownloaded = useCallback(() => {
    setSummaryDownloaded(true);
  }, []);

  const setEventLogVisible = useCallback((visible: boolean) => {
    setEventLogVisibleState(visible);
    saveEventLogVisible(visible);
  }, []);

  useEffect(() => {
    savePersistedAdventure({
      narrativeIntro,
      adventureDescription,
      mainMission,
      map,
      currentNodeId,
      narrativeHistory,
      progressCompletedNodeIds,
      runtimeState,
      sessionEvents,
      sessionStats,
      adventureComplete,
      adventureEndReason,
      adventureSummary,
      summaryDownloaded,
    });
  }, [
    narrativeIntro,
    adventureDescription,
    mainMission,
    map,
    currentNodeId,
    narrativeHistory,
    progressCompletedNodeIds,
    runtimeState,
    sessionEvents,
    sessionStats,
    adventureComplete,
    adventureEndReason,
    adventureSummary,
    summaryDownloaded,
  ]);

  useEffect(() => {
    if (character && map && !runtimeState) {
      setRuntimeState(createInitialRuntimeState(character));
    }
  }, [character, map, runtimeState]);

  useEffect(() => {
    if (mainMission || !map) return;
    const goal = map.nodes.find((n) => n.isGoal);
    if (!goal) return;

    const boss = goal.content?.elements.find((e) => e.type === "boss" || e.type === "monster");
    if (boss) {
      setMainMission({
        type: "slay",
        title: `Slay ${boss.name}`,
        target: boss.name,
        targetNodeId: goal.id,
      });
      return;
    }

    const keyItem = goal.content?.elements.find((e) =>
      ["key_item", "reward", "item"].includes(e.type),
    );
    if (keyItem) {
      setMainMission({
        type: "recover",
        title: `Recover ${keyItem.name}`,
        target: keyItem.name,
        targetNodeId: goal.id,
      });
      return;
    }

    setMainMission({
      type: "reach",
      title: `Reach ${goal.name}`,
      target: goal.name,
      targetNodeId: goal.id,
    });
  }, [mainMission, map]);

  const finishAdventure = useCallback((reason: AdventureEndReason) => {
    setAdventureComplete(true);
    setAdventureEndReason(reason);
  }, []);

  const setAdventureData = (
    intro: string,
    mapData: GameMap | null,
    description: string,
    mission: MainMission | null = null,
  ) => {
    if (!mapData?.nodes) return;
    const startNodeId = mapData.nodes.find((n) => n.status === "current")?.id ?? null;
    const initialStats = startNodeId
      ? recordLocationVisit(createInitialSessionStats(), startNodeId)
      : createInitialSessionStats();

    setNarrativeIntro(intro);
    setMap(mapData);
    setAdventureDescription(description);
    setMainMission(mission);
    setCurrentNodeId(startNodeId);
    setNarrativeHistory([]);
    setProgressCompletedNodeIds([]);
    setRuntimeState(character ? createInitialRuntimeState(character) : null);
    setCurrentEncounter(null);
    setAnimateMessageId(null);
    setLastRoll(null);
    setLastCheck(null);
    setSessionEvents([
      createSessionEvent("system", "A new adventure begins.", {
        location: mapData.nodes.find((n) => n.status === "current")?.name,
      }),
    ]);
    setEventLogMinimized(false);
    setSessionStats(initialStats);
    setAdventureComplete(false);
    setAdventureEndReason(null);
    setAdventureSummary(null);
    setSummaryError(null);
    setSummaryDownloaded(false);
  };

  const updateMap = (mapData: GameMap) => {
    setMap(mapData);
  };

  const clearAdventureData = () => {
    setNarrativeIntro(null);
    setAdventureDescription(null);
    setMainMission(null);
    setMap(null);
    setCurrentNodeId(null);
    setNarrativeHistory([]);
    setProgressCompletedNodeIds([]);
    setRuntimeState(null);
    setCurrentEncounter(null);
    setAnimateMessageId(null);
    setLastRoll(null);
    setLastCheck(null);
    setSessionEvents([]);
    setSessionStats(createInitialSessionStats());
    setAdventureComplete(false);
    setAdventureEndReason(null);
    setAdventureSummary(null);
    setSummaryError(null);
    setSummaryDownloaded(false);
    localStorage.removeItem(ADVENTURE_STORAGE_KEY);
  };

  const clearAnimateMessage = () => {
    setAnimateMessageId(null);
  };

  const enterLocation = useCallback(
    async (nodeId: string, travelPrompt?: string) => {
      if (!map || !character) {
        throw new Error("Character and map are required to enter a location.");
      }

      const targetNode = map.nodes.find((n) => n.id === nodeId);
      if (!targetNode) throw new Error("Location not found.");
      if (!getTravelStatus(map, nodeId, progressCompletedNodeIds).allowed) {
        const status = getTravelStatus(map, nodeId, progressCompletedNodeIds);
        throw new Error(status.reason ?? "You cannot travel to that location from here.");
      }

      const isTravel = map.nodes.find((n) => n.status === "current")?.id !== nodeId;
      setIsEnteringNode(true);
      setEnterNodeError(null);
      setActionError(null);
      if (isTravel) {
        setLastRoll(null);
        setLastCheck(null);
      }

      const traveledMap = isTravel ? applyTravel(map, nodeId) : map;
      const updatedNode = traveledMap.nodes.find((n) => n.id === nodeId)!;

      setMap(traveledMap);
      setCurrentNodeId(nodeId);
      setSessionStats((prev) => recordLocationVisit(prev, nodeId));

      let historyForApi = narrativeHistory;
      if (travelPrompt?.trim()) {
        const playerMessage: NarrativeMessage = {
          id: `player-${Date.now()}`,
          role: "player",
          text: travelPrompt.trim(),
        };
        historyForApi = [...narrativeHistory, playerMessage];
        setNarrativeHistory(historyForApi);
        appendSessionEvent(
          createSessionEvent(isTravel ? "travel" : "action", travelPrompt.trim(), {
            location: updatedNode.name,
          }),
        );
      } else if (!isTravel) {
        appendSessionEvent(
          createSessionEvent("system", `Entered ${updatedNode.name}.`, {
            location: updatedNode.name,
          }),
        );
      } else {
        appendSessionEvent(
          createSessionEvent("travel", `Traveled to ${updatedNode.name}.`, {
            location: updatedNode.name,
          }),
        );
      }

      try {
        const encounter = await apiFetch<EncounterData>("/game/enter-node", {
          method: "POST",
          body: JSON.stringify({
            character,
            node: updatedNode,
            narrative_intro: narrativeIntro,
            adventure_description: adventureDescription,
            recent_history: historyForApi.map((m) => ({ role: m.role, text: m.text })),
            main_mission: mainMission,
            game_state: {
              current_node_id: nodeId,
              visited_node_ids: traveledMap.nodes
                .filter((n) => n.status !== "hidden")
                .map((n) => n.id),
              ...(runtimeState ? runtimeStateToApi(runtimeState) : {}),
            },
          }),
        });

        const messageId = `gm-${nodeId}-${Date.now()}`;
        const gmMessage: NarrativeMessage = {
          id: messageId,
          role: "gm",
          text: encounter.narrative,
        };

        setCurrentEncounter(encounter);
        setNarrativeHistory((prev) => [...prev, gmMessage]);
        setAnimateMessageId(messageId);
        appendSessionEvent(
          createSessionEvent("narrative", encounter.narrative, {
            id: messageId,
            location: updatedNode.name,
          }),
        );
        if (
          encounter.adventure_complete ||
          (isTravel && shouldCompleteReachMission(mainMission, updatedNode))
        ) {
          finishAdventure(encounter.completion_reason ?? "victory");
        }
        if (isTravel) {
          // If we're traveling to a node we've never completed, we don't add it.
          // But we MUST NOT remove it if it was already completed (backtracking).
          setProgressCompletedNodeIds((prev) => 
            prev.includes(nodeId) ? prev : prev.filter((id) => id !== nodeId)
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to enter location.";
        setEnterNodeError(message);
        throw err;
      } finally {
        setIsEnteringNode(false);
      }
    },
    [map, character, narrativeIntro, adventureDescription, narrativeHistory, progressCompletedNodeIds, runtimeState, mainMission, finishAdventure, appendSessionEvent],
  );

  const travelToLocation = useCallback(
    async (nodeId: string, prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      await enterLocation(nodeId, trimmed);
    },
    [enterLocation],
  );

  const submitAction = useCallback(
    async (action: string) => {
      if (!map || !character || !currentNodeId) {
        throw new Error("No active game session.");
      }

      if (adventureComplete) return;

      const trimmed = action.trim();
      if (!trimmed) return;

      const travelNode = resolveTravelDestination(map, currentNodeId, trimmed, progressCompletedNodeIds);
      if (travelNode) {
        await travelToLocation(travelNode.id, trimmed);
        return;
      }

      const currentNode = map.nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) throw new Error("Current location not found.");

      setIsSubmittingAction(true);
      setActionError(null);

      const playerMessage: NarrativeMessage = {
        id: `player-${Date.now()}`,
        role: "player",
        text: trimmed,
      };
      setNarrativeHistory((prev) => [...prev, playerMessage]);
      appendSessionEvent(
        createSessionEvent("action", trimmed, {
          id: playerMessage.id,
          location: currentNode.name,
        }),
      );

      try {
        const apiRuntime = runtimeState ?? (character ? createInitialRuntimeState(character) : null);

        const result = await apiFetch<GameActionResult>("/game/action", {
          method: "POST",
          body: JSON.stringify({
            action: trimmed,
            character,
            node: currentNode,
            narrative_intro: narrativeIntro,
            adventure_description: adventureDescription,
            recent_history: [...narrativeHistory, playerMessage].map((m) => ({
              role: m.role,
              text: m.text,
            })),
            main_mission: mainMission,
            game_state: {
              current_node_id: currentNodeId,
              progress_completed_node_ids: progressCompletedNodeIds,
              ...(apiRuntime ? runtimeStateToApi(apiRuntime) : {}),
            },
          }),
        });

        let narrativeText = result.narrative;
        let nextRuntime =
          result.game_state || result.state_changes
            ? resolveRuntimeStateAfterAction(
                trimmed,
                apiRuntime ?? createInitialRuntimeState(character),
                result,
              )
            : apiRuntime ?? createInitialRuntimeState(character);

        if (!result.auto_potion_used) {
          const potionResult = applyAutoHealingPotion(nextRuntime);
          if (potionResult.used) {
            nextRuntime = potionResult.state;
            narrativeText += `\n\nYour body slumps as you fall — but instinct takes over. You automatically quaff a healing potion from your belt, recovering ${potionResult.healAmount} HP.`;
          }
        }

        const gmMessage: NarrativeMessage = {
          id: `gm-${Date.now()}`,
          role: "gm",
          text: narrativeText,
        };
        setNarrativeHistory((prev) => [...prev, gmMessage]);
        setAnimateMessageId(gmMessage.id);
        appendSessionEvent(
          createSessionEvent("narrative", result.narrative, {
            id: gmMessage.id,
            location: currentNode.name,
          }),
        );

        if (result.roll_result) {
          setLastRoll(result.roll_result);
          setLastCheck(result.check ?? null);
          appendSessionEvent(
            createSessionEvent(
              "roll",
              `Rolled ${result.roll_result.total} (d20: ${result.roll_result.d20} + ${result.roll_result.modifier}) vs DC ${result.roll_result.dc} — ${result.roll_result.outcome.replace(/_/g, " ")}`,
              {
                location: currentNode.name,
                meta: {
                  d20: result.roll_result.d20,
                  total: result.roll_result.total,
                  dc: result.roll_result.dc,
                  outcome: result.roll_result.outcome,
                },
              },
            ),
          );
        }

        setRuntimeState(nextRuntime);

        const stateSummary = result.state_changes
          ? formatStateChangeSummary(result.state_changes)
          : null;
        if (stateSummary) {
          appendSessionEvent(
            createSessionEvent("state", stateSummary, {
              location: currentNode.name,
              meta: { hpDelta: result.state_changes?.hp_delta },
            }),
          );
        }

        if (result.state_changes?.node_complete) {
          setProgressCompletedNodeIds((prev) =>
            prev.includes(currentNodeId) ? prev : [...prev, currentNodeId],
          );
        }

        if (result.suggested_actions?.length) {
          setCurrentEncounter((prev) => ({
            narrative: result.narrative,
            visible_elements: prev?.visible_elements ?? [],
            suggested_actions: result.suggested_actions!,
          }));
        }

        if (result.state_changes) {
          setSessionStats((prev) =>
            updateSessionStatsAfterAction(prev, currentNode, result.state_changes),
          );
        }

        if (result.adventure_complete && result.completion_reason) {
          finishAdventure(result.completion_reason);
        } else if (nextRuntime.hp <= 0) {
          finishAdventure("death");
        } else if (evaluateMissionVictory(mainMission, currentNode, nextRuntime, result.state_changes)) {
          finishAdventure("victory");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed.";
        setActionError(message);
        throw err;
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [
      map,
      character,
      currentNodeId,
      narrativeIntro,
      adventureDescription,
      narrativeHistory,
      progressCompletedNodeIds,
      runtimeState,
      mainMission,
      adventureComplete,
      finishAdventure,
      travelToLocation,
      appendSessionEvent,
    ],
  );

  const buildSummaryStatsPayload = useCallback(() => {
    const locationNames = sessionStats.locationsVisited
      .map((id) => map?.nodes.find((n) => n.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    return {
      enemies_defeated: sessionStats.enemiesDefeated,
      locations_visited: sessionStats.locationsVisited.length,
      location_names: locationNames,
      items_collected: sessionStats.itemsCollected,
      hero_name: character?.name,
      hero_class: character?.characterClass,
      hero_race: character?.race,
    };
  }, [sessionStats, map, character]);

  const generateAdventureSummary = useCallback(async (): Promise<AdventureSummaryData> => {
    if (!character) {
      throw new Error("No character loaded.");
    }

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const summary = await apiFetch<AdventureSummaryData>("/game/summary", {
        method: "POST",
        body: JSON.stringify({
          character,
          session_log: narrativeHistory.map((m) => ({ role: m.role, text: m.text })),
          stats: buildSummaryStatsPayload(),
          end_reason: adventureEndReason,
          main_mission: mainMission,
          adventure_description: adventureDescription,
          narrative_intro: narrativeIntro,
          map_nodes:
            map?.nodes.map((n) => ({
              id: n.id,
              name: n.name,
              isGoal: n.isGoal ?? false,
            })) ?? [],
        }),
      });

      setAdventureSummary(summary);
      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate summary.";
      setSummaryError(message);
      throw err;
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [
    character,
    narrativeHistory,
    buildSummaryStatsPayload,
    adventureDescription,
    narrativeIntro,
    map,
    adventureEndReason,
    mainMission,
  ]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("dnd_session_id", sessionId);
      apiFetch<{ character: CharacterData }>(`/character/${sessionId}`)
        .then((data) => {
          if (data.character) {
            setCharacter(data.character);
          } else {
            localStorage.removeItem("dnd_session_id");
            setSessionId(null);
            setCharacter(null);
          }
        })
        .catch((err) => {
          console.error("Error fetching session:", err);
          // Don't necessarily clear character on network error, only on 404/invalid data
        })
        .finally(() => setIsLoading(false));
    } else {
      localStorage.removeItem("dnd_session_id");
      setCharacter(null);
      setIsLoading(false);
    }
  }, [sessionId]);

  return (
    <GameContext.Provider
      value={{
        character,
        setCharacter,
        sessionId,
        setSessionId,
        narrativeIntro,
        adventureDescription,
        mainMission,
        map,
        currentNodeId,
        narrativeHistory,
        animateMessageId,
        currentEncounter,
        isEnteringNode,
        enterNodeError,
        progressCompletedNodeIds,
        runtimeState,
        lastRoll,
        lastCheck,
        isSubmittingAction,
        actionError,
        sessionEvents,
        eventLogVisible,
        eventLogMinimized,
        setEventLogVisible,
        setEventLogMinimized,
        sessionStats,
        adventureComplete,
        adventureEndReason,
        adventureSummary,
        isGeneratingSummary,
        summaryError,
        summaryDownloaded,
        markSummaryDownloaded,
        setAdventureData,
        updateMap,
        clearAdventureData,
        enterLocation,
        travelToLocation,
        submitAction,
        generateAdventureSummary,
        clearAnimateMessage,
        isLoading,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};
