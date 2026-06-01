import { describe, it, expect } from "vitest";
import { mergePastAdventures } from "@/lib/gameSaves";
import type { PastAdventureArchive } from "@/lib/pastAdventures";

describe("mergePastAdventures", () => {
  it("unions archives by id without dropping remote entries", () => {
    const local = [] as PastAdventureArchive[];
    const remote = [
      {
        id: "a1",
        completedAt: "2026-01-01T00:00:00.000Z",
        endReason: "victory" as const,
        adventureDescription: null,
        mainMission: null,
        narrativeIntro: null,
        summary: null,
        sessionStats: { enemiesDefeated: 0, locationsVisited: [], itemsCollected: 0 },
        sessionEvents: [],
        narrativeHistory: [],
        map: null,
        progressCompletedNodeIds: [],
        characterSnapshot: { name: "Hero", race: "Human", characterClass: "Fighter", backstory: "", stats: {} as never },
        runtimeState: null,
      },
    ];
    expect(mergePastAdventures(local, remote)).toHaveLength(1);
    expect(mergePastAdventures(local, remote)[0].id).toBe("a1");
  });
});
