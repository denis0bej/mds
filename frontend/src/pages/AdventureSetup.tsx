import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Hexagon, User, Sword, AlertTriangle, RefreshCw, Loader2, BookOpen, Map as MapIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useGame, type MainMission } from "@/context/GameContext";
import { apiFetch } from "@/lib/api";

const PLACEHOLDER_SUGGESTIONS = [
  "A dark quest through the Underdark, where ancient dwarven ruins hold the key to sealing a rift between planes...",
  "A coastal city plagued by pirate raids, where the true threat lurks beneath the waves...",
  "A cursed forest where travelers disappear and the trees whisper forgotten names...",
  "A dragon's mountain stronghold where a stolen artifact must be reclaimed before the winter solstice...",
];

function missionLabel(mission: MainMission | null): string | null {
  if (!mission) return null;
  return mission.title;
}

function AdventureConceptSheet({
  concept,
  intro,
  mission,
  locationCount,
  adventureComplete,
}: {
  concept: string;
  intro: string | null;
  mission: MainMission | null;
  locationCount: number;
  adventureComplete: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-3xl font-display text-primary text-gold-glow mb-2 tracking-wider">
        Your Quest
      </h1>
      <p className="text-muted-foreground font-body mb-6 text-sm italic">
        This adventure has already been forged. Continue where you left off.
      </p>

      <div className="narrative-panel border-gold mb-6 space-y-4">
        <div>
          <p className="font-display text-xs uppercase tracking-wider text-primary mb-2">
            Adventure Concept
          </p>
          <p className="font-body text-foreground/90 leading-relaxed whitespace-pre-line">{concept}</p>
        </div>

        {mission && (
          <div>
            <p className="font-display text-xs uppercase tracking-wider text-primary mb-2">
              Main Mission
            </p>
            <p className="font-body text-foreground/90">{missionLabel(mission)}</p>
          </div>
        )}

        {intro && (
          <div>
            <p className="font-display text-xs uppercase tracking-wider text-primary mb-2">
              Opening
            </p>
            <p className="font-body text-foreground/80 text-sm leading-relaxed whitespace-pre-line line-clamp-6">
              {intro}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-gold/20">
          <span className="font-body text-xs text-muted-foreground">
            {locationCount} locations mapped
          </span>
          {adventureComplete && (
            <span className="font-display text-[10px] uppercase tracking-wider text-primary">
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/game" className="btn-fantasy flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4" />
          Continue Adventure
        </Link>
        <Link
          to="/map"
          className="flex items-center gap-2 px-4 py-2 rounded-sm border border-gold/50 font-display text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
        >
          <MapIcon className="h-4 w-4" />
          View Map
        </Link>
      </div>
    </motion.div>
  );
}

const AdventureSetup = () => {
  const navigate = useNavigate();
  const {
    character,
    setAdventureData,
    map,
    adventureDescription,
    narrativeIntro,
    mainMission,
    adventureComplete,
  } = useGame();
  const [adventureText, setAdventureText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [generateConceptError, setGenerateConceptError] = useState<string | null>(null);
  const [suggestionIndex] = useState(() => Math.floor(Math.random() * PLACEHOLDER_SUGGESTIONS.length));

  useEffect(() => {
    if (adventureDescription && !map) {
      setAdventureText(adventureDescription);
    }
  }, [adventureDescription, map]);

  const handleGenerateConcept = async () => {
    setIsGeneratingConcept(true);
    setGenerateConceptError(null);

    try {
      const data = await apiFetch<{ concept: string }>("/adventure/generate-concept", {
        method: "POST",
        body: JSON.stringify({ character: character ?? undefined }),
      });
      setAdventureText(data.concept);
    } catch (err) {
      setGenerateConceptError(err instanceof Error ? err.message : "Could not generate concept.");
    } finally {
      setIsGeneratingConcept(false);
    }
  };

  const handleGenerate = async () => {
    if (adventureText.trim().length < 20) return;

    setIsLoading(true);
    setError(null);
    setGenerationMessage("Initializing generation...");

    const body: Record<string, unknown> = { description: adventureText.trim() };
    if (character) body.character = character;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/adventure/generate-stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error("Forces of darkness have blocked the transmission. Please try again.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Could not start stream reader.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.replace("data: ", "").trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);
              if (event.status === "error") {
                throw new Error(event.message);
              }
              if (event.status === "complete") {
                const data = event.data;
                setAdventureData(data.narrativeIntro, data.map, adventureText.trim(), data.mainMission ?? null);
                navigate("/game");
                return;
              }
              if (event.message) {
                setGenerationMessage(event.message);
              }
            } catch (e) {
              console.error("Error parsing SSE event:", e);
            }
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!character) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="narrative-panel text-center">
          <User className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-body text-muted-foreground mb-4">
            You must forge a hero before the adventure can begin.
          </p>
          <Link to="/" className="btn-fantasy text-sm inline-block">
            Create Character
          </Link>
        </div>
      </div>
    );
  }

  if (map && adventureDescription) {
    return (
      <AdventureConceptSheet
        concept={adventureDescription}
        intro={narrativeIntro}
        mission={mainMission}
        locationCount={map.nodes.length}
        adventureComplete={adventureComplete}
      />
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
        <div className="flex items-center justify-between gap-2 mb-3">
          <label className="font-display text-xs uppercase tracking-wider text-primary block">
            Adventure Concept
          </label>
          <button
            type="button"
            onClick={handleGenerateConcept}
            disabled={isLoading || isGeneratingConcept}
            className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            {isGeneratingConcept ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Can't think of anything? Generate for me
          </button>
        </div>
        <textarea
          className="w-full bg-background/50 border-none rounded-sm px-1 py-1 text-foreground font-body placeholder:text-muted-foreground/50 focus:outline-none min-h-[200px] resize-none text-sm leading-relaxed"
          placeholder={PLACEHOLDER_SUGGESTIONS[suggestionIndex]}
          value={adventureText}
          onChange={(e) => setAdventureText(e.target.value)}
          maxLength={1000}
          disabled={isLoading || isGeneratingConcept}
        />
        {generateConceptError && (
          <p className="text-destructive text-xs mt-2">{generateConceptError}</p>
        )}
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
                  key={generationMessage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="font-body text-gold-glow text-sm text-center italic"
                >
                  {generationMessage}
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
