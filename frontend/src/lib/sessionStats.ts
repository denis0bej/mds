import type { MapNode } from "@/context/GameContext";
import type { StateChanges } from "@/lib/gameState";

export type SessionStats = {
  enemiesDefeated: number;
  locationsVisited: string[];
  itemsCollected: number;
};

export function createInitialSessionStats(): SessionStats {
  return {
    enemiesDefeated: 0,
    locationsVisited: [],
    itemsCollected: 0,
  };
}

export function recordLocationVisit(stats: SessionStats, nodeId: string): SessionStats {
  if (stats.locationsVisited.includes(nodeId)) return stats;
  return {
    ...stats,
    locationsVisited: [...stats.locationsVisited, nodeId],
  };
}

export function updateSessionStatsAfterAction(
  stats: SessionStats,
  node: MapNode,
  stateChanges?: StateChanges | null,
): SessionStats {
  if (!stateChanges) return stats;

  const itemsAdded = stateChanges.inventory_add?.length ?? 0;
  let enemiesDefeated = stats.enemiesDefeated;

  if (stateChanges.node_complete) {
    const sceneType = node.content?.scene_type;
    const hostileElements =
      node.content?.elements?.filter((e) => e.type === "monster" || e.type === "boss").length ?? 0;

    if (sceneType === "combat" || sceneType === "boss") {
      enemiesDefeated += 1;
    } else if (hostileElements > 0) {
      enemiesDefeated += hostileElements;
    }
  }

  return {
    ...stats,
    enemiesDefeated,
    itemsCollected: stats.itemsCollected + itemsAdded,
  };
}

export function getLocationsVisitedCount(stats: SessionStats): number {
  return stats.locationsVisited.length;
}
