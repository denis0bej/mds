import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SettingsState {
  typingSpeed: number;
  setTypingSpeed: (speed: number) => void;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [typingSpeed, setTypingSpeedState] = useState<number>(() => {
    const saved = localStorage.getItem("dnd-typing-speed");
    return saved ? parseInt(saved, 10) : 18;
  });

  const setTypingSpeed = (speed: number) => {
    setTypingSpeedState(speed);
    localStorage.setItem("dnd-typing-speed", speed.toString());
  };

  return (
    <SettingsContext.Provider value={{ typingSpeed, setTypingSpeed }}>
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
