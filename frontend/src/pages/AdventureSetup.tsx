import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Hexagon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

const loadingMessages = [
  "The Dungeon Master is consulting the stars...",
  "The realm's map is taking shape...",
  "Shadows gather at the edge of the known...",
  "Your destiny is woven in silence...",
  "Arcane forces answer the call...",
];

const AdventureSetup = () => {
  const navigate = useNavigate();
  const { character, sessionId, setSessionId, setAdventureData } = useGame();
  const [adventureText, setAdventureText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: number | undefined;
    if (isLoading) {
      interval = window.setInterval(() => {
        setLoadingIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleGenerate = async () => {
    if (adventureText.length < 20) return;

    setIsLoading(true);
    setError(null);

    const body: Record<string, unknown> = { description: adventureText };
    if (sessionId) body.session_id = sessionId;
    if (character) body.character = character;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/adventure/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 504) {
          throw new Error("The Dungeon Master has fallen asleep. The response took too long — please try again.");
        }
        throw new Error(data.detail?.error || data.detail || "Something went wrong in the magical realms. Please try again.");
      }

      setAdventureData(data.narrativeIntro, data.map);
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }
      navigate("/map");
    } catch (err: any) {
      console.error("Generation error:", err);
      if (err.message.includes("Failed to fetch")) {
        setError("Forces of darkness have blocked the transmission. Check your connection and try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!character && !sessionId) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="narrative-panel text-center">
          <p className="font-body text-muted-foreground mb-3">
            You must create a character first.
          </p>
          <a href="/" className="btn-fantasy text-sm inline-block">Create Character</a>
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
      <p className="text-muted-foreground font-body mb-8 text-sm italic">
        Describe your dream adventure — realms, dangers, mysteries, foes...
      </p>

      <div className="narrative-panel border-gold mb-6">
        <textarea
          className="w-full bg-background/50 border-none rounded-sm px-4 py-3 text-foreground font-body placeholder:text-muted-foreground focus:outline-none min-h-[250px] resize-none"
          placeholder="Describe your dream adventure — realms, dangers, mysteries, foes..."
          value={adventureText}
          onChange={(e) => setAdventureText(e.target.value)}
          maxLength={1000}
          disabled={isLoading}
        />
        <div className="text-right text-[10px] font-display text-muted-foreground mt-2 uppercase tracking-tighter">
          {adventureText.length} / 1000
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[120px]">
        {!isLoading ? (
          <motion.button
            whileHover={{ scale: adventureText.length >= 20 ? 1.02 : 1 }}
            whileTap={{ scale: adventureText.length >= 20 ? 0.98 : 1 }}
            onClick={handleGenerate}
            disabled={adventureText.length < 20}
            className={`btn-fantasy flex items-center gap-3 text-base px-12 py-4 ${
              adventureText.length < 20 ? "opacity-50 cursor-not-allowed" : "animate-pulse-glow"
            }`}
          >
            <Sparkles className="h-5 w-5" />
            Generate Adventure
          </motion.button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Hexagon className="h-8 w-8 text-primary animate-pulse" />
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="font-body text-gold-glow text-sm text-center"
              >
                {loadingMessages[loadingIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="narrative-panel border-accent mt-6 w-full max-w-md"
          >
            <p className="font-body text-accent text-sm">{error}</p>
            <button 
              className="btn-fantasy mt-3 text-xs" 
              onClick={() => handleGenerate()}
            >
              Try Again
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default AdventureSetup;

