import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import type { NarrativeMessage } from "@/components/NarrationPanel";
import {
  createInitialRuntimeState,
  normalizeRuntimeState,
  runtimeStateToApi,
  resolveRuntimeStateAfterAction,
  type GameRuntimeState,
  type StateChanges,
} from "@/lib/gameState";

export type { GameRuntimeState, InventoryItem, StatusEffect } from "@/lib/gameState";

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

export type MapNode = {
  id: string;
  name: string;
  description: string;
  status: "current" | "discovered" | "hidden";
  isGoal?: boolean;
  x?: number;
  y?: number;
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
};

const ADVENTURE_STORAGE_KEY = "dnd_adventure_state";

type PersistedAdventure = {
  narrativeIntro: string | null;
  adventureDescription: string | null;
  map: GameMap | null;
  currentNodeId: string | null;
  narrativeHistory: NarrativeMessage[];
  progressCompletedNodeIds: string[];
  runtimeState: GameRuntimeState | null;
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
  setAdventureData: (intro: string, mapData: GameMap, description: string) => void;
  updateMap: (mapData: GameMap) => void;
  clearAdventureData: () => void;
  enterLocation: (nodeId: string, travelPrompt?: string) => Promise<void>;
  travelToLocation: (nodeId: string, prompt: string) => Promise<void>;
  submitAction: (action: string) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    savePersistedAdventure({
      narrativeIntro,
      adventureDescription,
      map,
      currentNodeId,
      narrativeHistory,
      progressCompletedNodeIds,
      runtimeState,
    });
  }, [
    narrativeIntro,
    adventureDescription,
    map,
    currentNodeId,
    narrativeHistory,
    progressCompletedNodeIds,
    runtimeState,
  ]);

  useEffect(() => {
    if (character && map && !runtimeState) {
      setRuntimeState(createInitialRuntimeState(character));
    }
  }, [character, map, runtimeState]);

  const setAdventureData = (intro: string, mapData: GameMap, description: string) => {
    setNarrativeIntro(intro);
    setMap(mapData);
    setAdventureDescription(description);
    setCurrentNodeId(mapData.nodes.find((n) => n.status === "current")?.id ?? null);
    setNarrativeHistory([]);
    setProgressCompletedNodeIds([]);
    setRuntimeState(character ? createInitialRuntimeState(character) : null);
    setCurrentEncounter(null);
    setAnimateMessageId(null);
    setLastRoll(null);
    setLastCheck(null);
  };

  const updateMap = (mapData: GameMap) => {
    setMap(mapData);
  };

  const clearAdventureData = () => {
    setNarrativeIntro(null);
    setAdventureDescription(null);
    setMap(null);
    setCurrentNodeId(null);
    setNarrativeHistory([]);
    setProgressCompletedNodeIds([]);
    setRuntimeState(null);
    setCurrentEncounter(null);
    setAnimateMessageId(null);
    setLastRoll(null);
    setLastCheck(null);
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

      let historyForApi = narrativeHistory;
      if (travelPrompt?.trim()) {
        const playerMessage: NarrativeMessage = {
          id: `player-${Date.now()}`,
          role: "player",
          text: travelPrompt.trim(),
        };
        historyForApi = [...narrativeHistory, playerMessage];
        setNarrativeHistory(historyForApi);
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
        if (isTravel) {
          setProgressCompletedNodeIds((prev) => prev.filter((id) => id !== nodeId));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to enter location.";
        setEnterNodeError(message);
        throw err;
      } finally {
        setIsEnteringNode(false);
      }
    },
    [map, character, narrativeIntro, adventureDescription, narrativeHistory, progressCompletedNodeIds, runtimeState],
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
            game_state: {
              current_node_id: currentNodeId,
              progress_completed_node_ids: progressCompletedNodeIds,
              ...(apiRuntime ? runtimeStateToApi(apiRuntime) : {}),
            },
          }),
        });

        const gmMessage: NarrativeMessage = {
          id: `gm-${Date.now()}`,
          role: "gm",
          text: result.narrative,
        };
        setNarrativeHistory((prev) => [...prev, gmMessage]);
        setAnimateMessageId(gmMessage.id);

        if (result.roll_result) {
          setLastRoll(result.roll_result);
          setLastCheck(result.check ?? null);
        }

        if (result.game_state || result.state_changes) {
          setRuntimeState(
            resolveRuntimeStateAfterAction(trimmed, apiRuntime ?? createInitialRuntimeState(character), result),
          );
        }

        setProgressCompletedNodeIds((prev) => {
          if (prev.includes(currentNodeId)) return prev;
          return [...prev, currentNodeId];
        });

        if (result.state_changes?.node_complete) {
          setProgressCompletedNodeIds((prev) =>
            prev.includes(currentNodeId) ? prev : [...prev, currentNodeId],
          );
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
      travelToLocation,
    ],
  );

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("dnd_session_id", sessionId);
      fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/character/${sessionId}`)
        .then((res) => res.json())
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
        setAdventureData,
        updateMap,
        clearAdventureData,
        enterLocation,
        travelToLocation,
        submitAction,
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
