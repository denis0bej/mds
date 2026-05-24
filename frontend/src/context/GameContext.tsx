import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

interface GameState {
  character: CharacterData | null;
  setCharacter: (char: CharacterData | null) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  narrativeIntro: string | null;
  map: GameMap | null;
  setAdventureData: (narrativeIntro: string, map: GameMap) => void;
  updateMap: (map: GameMap) => void;
  clearAdventureData: () => void;
  isLoading: boolean;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem("dnd_session_id"));
  const [narrativeIntro, setNarrativeIntro] = useState<string | null>(null);
  const [map, setMap] = useState<GameMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setAdventureData = (intro: string, mapData: GameMap) => {
    setNarrativeIntro(intro);
    setMap(mapData);
  };

  const updateMap = (mapData: GameMap) => {
    setMap(mapData);
  };

  const clearAdventureData = () => {
    setNarrativeIntro(null);
    setMap(null);
  };

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("dnd_session_id", sessionId);
      // Fetch character data from backend
      fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/character/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.character) {
            setCharacter(data.character);
          } else {
            // Session not found or error
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
    <GameContext.Provider value={{ 
      character, 
      setCharacter, 
      sessionId, 
      setSessionId, 
      narrativeIntro, 
      map, 
      setAdventureData, 
      updateMap,
      clearAdventureData,
      isLoading 
    }}>
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
