import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AIProvider = "ollama" | "openai";

interface SettingsState {
  typingSpeed: number;
  setTypingSpeed: (speed: number) => void;
  aiProvider: AIProvider;
  setAiProvider: (provider: AIProvider) => void;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [typingSpeed, setTypingSpeedState] = useState<number>(() => {
    const saved = localStorage.getItem("dnd-typing-speed");
    return saved ? parseInt(saved, 10) : 18;
  });

  const [aiProvider, setAiProviderState] = useState<AIProvider>(() => {
    const saved = localStorage.getItem("dnd-ai-provider");
    return (saved as AIProvider) || "ollama";
  });

  const setTypingSpeed = (speed: number) => {
    setTypingSpeedState(speed);
    localStorage.setItem("dnd-typing-speed", speed.toString());
  };

  const setAiProvider = (provider: AIProvider) => {
    setAiProviderState(provider);
    localStorage.setItem("dnd-ai-provider", provider);
  };

  return (
    <SettingsContext.Provider value={{ typingSpeed, setTypingSpeed, aiProvider, setAiProvider }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
