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

interface GameState {
  character: CharacterData | null;
  setCharacter: (char: CharacterData | null) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  isLoading: boolean;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem("dnd_session_id"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("dnd_session_id", sessionId);
      // Fetch character data from backend
      fetch(`http://localhost:8000/character/${sessionId}`)
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
    <GameContext.Provider value={{ character, setCharacter, sessionId, setSessionId, isLoading }}>
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
