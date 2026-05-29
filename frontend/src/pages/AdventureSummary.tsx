import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Skull, MapPin, Package, Download, RotateCcw, Trophy, Sparkles, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { getLocationsVisitedCount } from "@/lib/sessionStats";

const AdventureSummary = () => {
  const navigate = useNavigate();
  const {
    character,
    adventureComplete,
    adventureSummary,
    sessionStats,
    isGeneratingSummary,
    summaryError,
    generateAdventureSummary,
    clearAdventureData,
  } = useGame();

  useEffect(() => {
    if (!adventureComplete) return;
    if (adventureSummary || isGeneratingSummary) return;
    generateAdventureSummary().catch(() => {
      // error surfaced via summaryError
    });
  }, [adventureComplete, adventureSummary, isGeneratingSummary, generateAdventureSummary]);

  const stats = useMemo(() => {
    const apiStats = adventureSummary?.stats;
    return [
      {
        label: "Enemies Defeated",
        value: apiStats?.enemies_defeated ?? sessionStats.enemiesDefeated,
        icon: Skull,
      },
      {
        label: "Locations Visited",
        value: apiStats?.locations_visited ?? getLocationsVisitedCount(sessionStats),
        icon: MapPin,
      },
      {
        label: "Items Collected",
        value: apiStats?.items_collected ?? sessionStats.itemsCollected,
        icon: Package,
      },
    ];
  }, [adventureSummary, sessionStats]);

  const title = adventureSummary?.title ?? "Your Adventure Summary";
  const subtitle = character
    ? `The tale of ${character.name} — ${character.characterClass} of ${character.race}`
    : "A hero's journey concludes";

  const handleDownload = () => {
    if (!adventureSummary) return;

    const lines = [
      title,
      subtitle,
      "",
      adventureSummary.narrative,
      "",
      "Final Statistics",
      `- Enemies Defeated: ${stats[0].value}`,
      `- Locations Visited: ${stats[1].value}`,
      `- Items Collected: ${stats[2].value}`,
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${character?.name ?? "adventure"}-summary.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleNewAdventure = () => {
    clearAdventureData();
    navigate("/adventure");
  };

  if (!adventureComplete) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-display text-2xl text-primary mb-3">No completed adventure yet</h1>
        <p className="font-body text-muted-foreground mb-6">
          Finish your quest to unlock the Chronicler&apos;s tale.
        </p>
        <Link to="/game" className="btn-fantasy text-sm inline-block">
          Return to Game
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="summary-celebration max-w-3xl mx-auto relative"
    >
      <div className="summary-sparkles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="summary-sparkle" style={{ left: `${8 + i * 7.5}%`, animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="text-center mb-8 relative z-10"
      >
        <motion.div
          animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-primary/60 bg-primary/10 mb-4"
        >
          <Trophy className="h-8 w-8 text-primary" />
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-display text-primary text-gold-glow mb-2 tracking-wider">
          {title}
        </h1>
        <p className="text-muted-foreground font-body flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-primary/70" />
          {subtitle}
          <Sparkles className="h-4 w-4 text-primary/70" />
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="narrative-panel summary-narrative mb-8 relative z-10"
      >
        {isGeneratingSummary && !adventureSummary ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-display text-sm uppercase tracking-wider">
              The Chronicler weaves your tale...
            </p>
          </div>
        ) : summaryError && !adventureSummary ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{summaryError}</p>
            <button type="button" onClick={() => generateAdventureSummary()} className="btn-fantasy text-xs">
              Try Again
            </button>
          </div>
        ) : (
          <p className="font-body text-parchment leading-relaxed whitespace-pre-line text-sm">
            {adventureSummary?.narrative}
          </p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 relative z-10">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.45 + i * 0.12, type: "spring", stiffness: 120 }}
            className="stat-card summary-stat-card flex flex-col items-center gap-2 py-6"
          >
            <stat.icon className="h-6 w-6 text-primary" />
            <div className="font-display text-3xl text-primary text-gold-glow">{stat.value}</div>
            <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className="flex flex-col sm:flex-row justify-center gap-4 relative z-10"
      >
        <button
          type="button"
          onClick={handleDownload}
          disabled={!adventureSummary}
          className="btn-fantasy flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download Summary
        </button>
        <button
          type="button"
          onClick={handleNewAdventure}
          className="btn-fantasy flex items-center justify-center gap-2 bg-secondary text-secondary-foreground border-gold hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" />
          Start New Adventure
        </button>
      </motion.div>
    </motion.div>
  );
};

export default AdventureSummary;
