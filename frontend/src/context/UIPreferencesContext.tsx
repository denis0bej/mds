import React, { createContext, useContext, useEffect, useState } from "react";

export type TypewriterSpeed = "slow" | "normal" | "fast";
export type Theme = "light" | "dark";

interface UIPreferencesContextType {
  theme: Theme;
  typewriterSpeed: TypewriterSpeed;
  setTheme: (theme: Theme) => void;
  setTypewriterSpeed: (speed: TypewriterSpeed) => void;
  speedMs: number;
}

const UIPreferencesContext = createContext<UIPreferencesContextType | undefined>(undefined);

const SPEED_MAP: Record<TypewriterSpeed, number> = {
  slow: 40,
  normal: 18,
  fast: 5,
};

export const UIPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("ui-theme");
    return (saved as Theme) || "dark";
  });

  const [typewriterSpeed, setTypewriterSpeedState] = useState<TypewriterSpeed>(() => {
    const saved = localStorage.getItem("ui-typewriter-speed");
    return (saved as TypewriterSpeed) || "normal";
  });

  useEffect(() => {
    localStorage.setItem("ui-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("ui-typewriter-speed", typewriterSpeed);
  }, [typewriterSpeed]);

  const setTheme = (t: Theme) => setThemeState(t);
  const setTypewriterSpeed = (s: TypewriterSpeed) => setTypewriterSpeedState(s);

  const speedMs = SPEED_MAP[typewriterSpeed];

  return (
    <UIPreferencesContext.Provider
      value={{
        theme,
        typewriterSpeed,
        setTheme,
        setTypewriterSpeed,
        speedMs,
      }}
    >
      {children}
    </UIPreferencesContext.Provider>
  );
};

export const useUIPreferences = () => {
  const context = useContext(UIPreferencesContext);
  if (!context) {
    throw new Error("useUIPreferences must be used within a UIPreferencesProvider");
  }
  return context;
};
