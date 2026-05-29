import type { NarrativeMessage } from "@/components/NarrationPanel";
import type {
  AdventureEndReason,
  AdventureSummaryData,
  CharacterData,
  GameMap,
  MainMission,
} from "@/context/GameContext";
import type { GameRuntimeState } from "@/lib/gameState";
import type { SessionStats } from "@/lib/sessionStats";
import type { SessionEvent } from "@/lib/sessionEvents";

export type PastAdventureArchive = {
  id: string;
  completedAt: string;
  endReason: AdventureEndReason;
  adventureDescription: string | null;
  mainMission: MainMission | null;
  narrativeIntro: string | null;
  summary: AdventureSummaryData | null;
  sessionStats: SessionStats;
  sessionEvents: SessionEvent[];
  narrativeHistory: NarrativeMessage[];
  map: GameMap | null;
  progressCompletedNodeIds: string[];
  characterSnapshot: CharacterData;
  runtimeState: GameRuntimeState | null;
};

export type PastAdventureArchiveInput = {
  id: string;
  completedAt: string;
  endReason: AdventureEndReason;
  adventureDescription: string | null;
  mainMission: MainMission | null;
  narrativeIntro: string | null;
  summary: AdventureSummaryData | null;
  sessionStats: SessionStats;
  sessionEvents: SessionEvent[];
  narrativeHistory: NarrativeMessage[];
  map: GameMap | null;
  progressCompletedNodeIds: string[];
  characterSnapshot: CharacterData;
  runtimeState: GameRuntimeState | null;
};

export function createPastAdventureArchive(input: PastAdventureArchiveInput): PastAdventureArchive {
  return { ...input };
}

export function getPastAdventureTitle(archive: PastAdventureArchive): string {
  if (archive.summary?.title) return archive.summary.title;
  if (archive.mainMission?.title) return archive.mainMission.title;
  if (archive.adventureDescription) {
    const line = archive.adventureDescription.trim().split("\n")[0];
    return line.length > 64 ? `${line.slice(0, 61)}...` : line;
  }
  return "Untitled Adventure";
}

export function formatArchiveDate(completedAt: string): string {
  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
