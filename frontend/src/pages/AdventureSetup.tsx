import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Hexagon, User, Sword, AlertTriangle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

const LOADING_MESSAGES = [
  "The Dungeon Master is consulting the stars...",
  "Ancient runes are being deciphered...",
  "The realm's map is taking shape...",
  "Shadows gather at the edge of the known...",
  "Your destiny is woven in silence...",
  "Arcane forces answer the call...",
  "The chronicles of fate are being written...",
];

const PLACEHOLDER_SUGGESTIONS = [
  "A dark quest through the Underdark, where ancient dwarven ruins hold the key to sealing a rift between planes...",
  "A coastal city plagued by pirate raids, where the true threat lurks beneath the waves...",
  "A cursed forest where travelers disappear and the trees whisper forgotten names...",
  "A dragon's mountain stronghold where a stolen artifact must be reclaimed before the winter solstice...",
];

const AdventureSetup = () => {
  const navigate = useNavigate();
  const { character, sessionId, setSessionId, setAdventureData } = useGame();
  const [adventureText, setAdventureText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [suggestionIndex] = useState(() => Math.floor(Math.random() * PLACEHOLDER_SUGGESTIONS.length));

  useEffect(() => {
    let interval: number | undefined;
    if (isLoading) {
      interval = window.setInterval(() => {
        setLoadingIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleGenerate = async () => {
    if (adventureText.trim().length < 20) return;

    setIsLoading(true);
    setError(null);

    const body: Record<string, unknown> = { description: adventureText.trim() };
    if (sessionId) body.session_id = sessionId;
    if (character) body.character = character;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/adventure/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 504) {
          throw new Error("The Dungeon Master has fallen asleep. The response took too long — please try again.");
        }
        throw new Error(
          data.detail?.error || data.detail || "Something went wrong in the magical realms. Please try again."
        );
      }

      if (!data.map?.nodes?.length) {
        throw new Error("The realm could not be mapped. The response was incomplete — please try again.");
      }

      setAdventureData(data.narrativeIntro, data.map, adventureText.trim());
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }
      navigate("/game");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Failed to fetch")) {
        setError("Forces of darkness have blocked the transmission. Check your connection and try again.");
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!character && !sessionId) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="narrative-panel text-center">
          <User className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-body text-muted-foreground mb-4">
            You must forge a hero before the adventure can begin.
          </p>
          <a href="/" className="btn-fantasy text-sm inline-block">
            Create Character
          </a>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-3xl font-display text-primary text-gold-glow mb-2 tracking-wider">
        Craft Your Quest
      </h1>
      <p className="text-muted-foreground font-body mb-6 text-sm italic">
        Describe your dream adventure — realms, dangers, mysteries, foes...
      </p>

      {/* Character summary */}
      {character && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="narrative-panel border-gold/30 mb-6 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full border border-gold/50 bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-primary text-sm tracking-wider">
                {character.name}
              </span>
              <span className="font-body text-xs text-muted-foreground">
                {character.race} · {character.characterClass}
              </span>
            </div>
            <p className="font-body text-xs text-muted-foreground/60 mt-0.5 truncate">
              {character.backstory}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Sword className="h-3.5 w-3.5 text-primary/50" />
            <span className="font-display text-[10px] text-primary/50 uppercase tracking-widest">
              Active
            </span>
          </div>
        </motion.div>
      )}

      {/* Adventure textarea */}
      <div className="narrative-panel border-gold mb-6">
        <label className="font-display text-xs uppercase tracking-wider text-primary mb-3 block">
          Adventure Concept
        </label>
        <textarea
          className="w-full bg-background/50 border-none rounded-sm px-1 py-1 text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none min-h-[200px] resize-none text-sm leading-relaxed"
          placeholder={PLACEHOLDER_SUGGESTIONS[suggestionIndex]}
          value={adventureText}
          onChange={(e) => setAdventureText(e.target.value)}
          maxLength={1000}
          disabled={isLoading}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="font-body text-[10px] text-muted-foreground/40 italic">
            {adventureText.trim().length < 20 && adventureText.length > 0
              ? `${20 - adventureText.trim().length} more characters needed`
              : ""}
          </span>
          <span className="font-display text-[10px] text-muted-foreground uppercase tracking-tighter">
            {adventureText.length} / 1000
          </span>
        </div>
      </div>

      {/* Button / Loading */}
      <div className="flex flex-col items-center justify-center min-h-[100px]">
        <AnimatePresence mode="wait">
          {!isLoading ? (
            <motion.button
              key="btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: adventureText.trim().length >= 20 ? 1.02 : 1 }}
              whileTap={{ scale: adventureText.trim().length >= 20 ? 0.98 : 1 }}
              onClick={handleGenerate}
              disabled={adventureText.trim().length < 20}
              className={`btn-fantasy flex items-center gap-3 text-base px-12 py-4 ${
                adventureText.trim().length < 20
                  ? "opacity-40 cursor-not-allowed"
                  : "animate-pulse-glow"
              }`}
            >
              <Sparkles className="h-5 w-5" />
              Generate Adventure
            </motion.button>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Hexagon className="h-10 w-10 text-primary" />
              </motion.div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="font-body text-gold-glow text-sm text-center italic"
                >
                  {LOADING_MESSAGES[loadingIndex]}
                </motion.p>
              </AnimatePresence>
              <div className="flex gap-1 mt-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary/60"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="narrative-panel border-destructive/50 mt-6 w-full"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="font-body text-destructive/90 text-sm flex-1">{error}</p>
              </div>
              <button
                className="btn-fantasy mt-3 text-xs flex items-center gap-2"
                onClick={handleGenerate}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdventureSetup;
