import type { NarrativeMessage } from "@/components/NarrationPanel";
import type {
  AdventureEndReason,
  AdventureSummaryData,
  CharacterData,
  GameMap,
  MainMission,
} from "@/context/GameContext";
import type { GameRuntimeState } from "@/lib/gameState";
import { createInitialSessionStats, type SessionStats } from "@/lib/sessionStats";
import type { SessionEvent } from "@/lib/sessionEvents";
import { supabase } from "@/lib/supabase";

export type SaveData = {
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

export type GameSaveRow = {
  id: string;
  user_id: string;
  character: CharacterData;
  save_data: SaveData;
  character_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type GameSaveSummary = {
  id: string;
  character_name: string;
  character: CharacterData;
  save_data: SaveData;
  is_active: boolean;
  updated_at: string;
  phase: "character_only" | "adventure_active" | "completed";
};

const ADVENTURE_STORAGE_KEY = "dnd_adventure_state";
const SESSION_ID_KEY = "dnd_session_id";

export function createEmptySaveData(): SaveData {
  return {
    narrativeIntro: null,
    adventureDescription: null,
    mainMission: null,
    map: null,
    currentNodeId: null,
    narrativeHistory: [],
    progressCompletedNodeIds: [],
    runtimeState: null,
    sessionEvents: [],
    sessionStats: createInitialSessionStats(),
    adventureComplete: false,
    adventureEndReason: null,
    adventureSummary: null,
    summaryDownloaded: false,
  };
}

function normalizeSaveData(raw: Partial<SaveData> | null | undefined): SaveData {
  const base = createEmptySaveData();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    sessionStats: raw.sessionStats ?? base.sessionStats,
    sessionEvents: Array.isArray(raw.sessionEvents) ? raw.sessionEvents : base.sessionEvents,
    narrativeHistory: Array.isArray(raw.narrativeHistory) ? raw.narrativeHistory : base.narrativeHistory,
    progressCompletedNodeIds: Array.isArray(raw.progressCompletedNodeIds)
      ? raw.progressCompletedNodeIds
      : base.progressCompletedNodeIds,
  };
}

function getSavePhase(saveData: SaveData): GameSaveSummary["phase"] {
  if (saveData.adventureComplete) return "completed";
  if (saveData.map) return "adventure_active";
  return "character_only";
}

function toSummary(row: GameSaveRow): GameSaveSummary {
  const save_data = normalizeSaveData(row.save_data);
  return {
    id: row.id,
    character_name: row.character_name,
    character: row.character,
    save_data,
    is_active: row.is_active,
    updated_at: row.updated_at,
    phase: getSavePhase(save_data),
  };
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function listSaves(userId: string): Promise<GameSaveSummary[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("game_saves")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as GameSaveRow[]).map(toSummary);
}

export async function fetchSave(saveId: string): Promise<GameSaveSummary> {
  const client = assertSupabase();
  const { data, error } = await client.from("game_saves").select("*").eq("id", saveId).single();
  if (error) throw new Error(error.message);
  return toSummary(data as GameSaveRow);
}

export async function createSave(
  userId: string,
  character: CharacterData,
  saveData: SaveData = createEmptySaveData(),
): Promise<GameSaveSummary> {
  const client = assertSupabase();

  await client.from("game_saves").update({ is_active: false }).eq("user_id", userId);

  const { data, error } = await client
    .from("game_saves")
    .insert({
      user_id: userId,
      character,
      save_data: saveData,
      character_name: character.name,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toSummary(data as GameSaveRow);
}

export async function updateSave(
  saveId: string,
  character: CharacterData,
  saveData: SaveData,
): Promise<void> {
  const client = assertSupabase();
  const { error } = await client
    .from("game_saves")
    .update({
      character,
      save_data: saveData,
      character_name: character.name,
    })
    .eq("id", saveId);

  if (error) throw new Error(error.message);
}

export async function setActiveSave(userId: string, saveId: string): Promise<void> {
  const client = assertSupabase();
  const { error: deactivateError } = await client
    .from("game_saves")
    .update({ is_active: false })
    .eq("user_id", userId);

  if (deactivateError) throw new Error(deactivateError.message);

  const { error: activateError } = await client
    .from("game_saves")
    .update({ is_active: true })
    .eq("id", saveId)
    .eq("user_id", userId);

  if (activateError) throw new Error(activateError.message);
}

export async function deleteSave(saveId: string): Promise<void> {
  const client = assertSupabase();
  const { error } = await client.from("game_saves").delete().eq("id", saveId);
  if (error) throw new Error(error.message);
}

export function readLocalLegacyState(): {
  sessionId: string | null;
  saveData: SaveData | null;
} {
  try {
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    const raw = localStorage.getItem(ADVENTURE_STORAGE_KEY);
    if (!raw) return { sessionId, saveData: null };
    return { sessionId, saveData: normalizeSaveData(JSON.parse(raw)) };
  } catch {
    return { sessionId: null, saveData: null };
  }
}

export async function fetchLegacyCharacter(sessionId: string): Promise<CharacterData | null> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/character/${sessionId}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.character ?? null;
  } catch {
    return null;
  }
}

export function clearLocalLegacyState(): void {
  localStorage.removeItem(ADVENTURE_STORAGE_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
}

export function formatSavePhaseLabel(phase: GameSaveSummary["phase"]): string {
  switch (phase) {
    case "completed":
      return "Completed";
    case "adventure_active":
      return "In progress";
    default:
      return "Character only";
  }
}

export function formatLastPlayed(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
