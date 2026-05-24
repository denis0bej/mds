import { useState, FormEvent, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, Shield, Sword, Scroll, Gem, Flame, Hexagon, Compass, Footprints } from "lucide-react";
import { Link } from "react-router-dom";
import { useGame, getAvailableTravelDestinations } from "@/context/GameContext";
import { NarrationPanel } from "@/components/NarrationPanel";

const inventoryItems = [
  { name: "Elvish Longbow", icon: Sword, desc: "+2 Attack" },
  { name: "Healing Potion", icon: Heart, desc: "Restores 2d4+2 HP" },
  { name: "Ancient Map", icon: Scroll, desc: "Quest Item" },
  { name: "Fire Gem", icon: Gem, desc: "1d6 Fire Damage" },
];

const statusEffects = [
  { name: "Darkvision", icon: Hexagon, color: "text-primary" },
  { name: "Blessed", icon: Shield, color: "text-primary" },
  { name: "Burning", icon: Flame, color: "text-accent" },
];

const outcomeLabels: Record<string, string> = {
  critical_fail: "Critical Fail!",
  fail: "Failure",
  partial: "Partial Success",
  success: "Success!",
  critical_success: "Critical Success!",
};

const GameLoop = () => {
  const {
    map,
    currentNodeId,
    narrativeHistory,
    animateMessageId,
    currentEncounter,
    isEnteringNode,
    clearAnimateMessage,
    character,
    submitAction,
    travelToLocation,
    enterLocation,
    isSubmittingAction,
    actionError,
    lastRoll,
    progressCompletedNodeIds,
  } = useGame();

  const [actionInput, setActionInput] = useState("");
  const autoEnterAttempted = useRef(false);

  const currentNode = map?.nodes.find((n) => n.id === currentNodeId);
  const travelDestinations =
    map && currentNodeId
      ? getAvailableTravelDestinations(map, currentNodeId, progressCompletedNodeIds)
      : [];
  const canTravelAway = travelDestinations.length > 0;
  const isBusy = isEnteringNode || isSubmittingAction || !!animateMessageId;

  useEffect(() => {
    if (!map || !currentNodeId || !character || isEnteringNode) return;
    if (narrativeHistory.length > 0 || currentEncounter) return;
    if (autoEnterAttempted.current) return;

    autoEnterAttempted.current = true;
    enterLocation(currentNodeId).catch(() => {
      autoEnterAttempted.current = false;
    });
  }, [
    map,
    currentNodeId,
    character,
    narrativeHistory.length,
    currentEncounter,
    isEnteringNode,
    enterLocation,
  ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!actionInput.trim() || isBusy) return;

    try {
      await submitAction(actionInput);
      setActionInput("");
    } catch {
      // error shown via actionError
    }
  };

  const handleTravel = async (nodeId: string, nodeName: string) => {
    if (isBusy) return;

    const prompt = `I travel to ${nodeName}`;
    try {
      await travelToLocation(nodeId, prompt);
      setActionInput("");
    } catch {
      // error shown via actionError
    }
  };

  if (!map || !currentNodeId) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="narrative-panel text-center">
          <Compass className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-body text-muted-foreground mb-4">
            Start an adventure to begin your journey.
          </p>
          <Link to="/adventure" className="btn-fantasy text-sm inline-block">
            Start Adventure
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]"
    >
      <div className="lg:w-[60%] flex flex-col">
        <NarrationPanel
          messages={narrativeHistory}
          animateMessageId={animateMessageId}
          onAnimationComplete={clearAnimateMessage}
          locationName={currentNode?.name}
          isLoading={isEnteringNode || isSubmittingAction}
          loadingText={
            isSubmittingAction
              ? "The Dungeon Master considers your action..."
              : "The Dungeon Master is setting the scene..."
          }
        />

        {currentEncounter && currentEncounter.suggested_actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-card/60 border border-gold/30 rounded-sm px-4 py-3"
          >
            <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              You might...
            </p>
            <ul className="flex flex-wrap gap-2">
              {currentEncounter.suggested_actions.map((action) => (
                <li key={action}>
                  <button
                    type="button"
                    onClick={() => setActionInput(action)}
                    disabled={isBusy}
                    className="text-xs font-body text-foreground/70 bg-muted/30 border border-gold/20 rounded-sm px-2.5 py-1 hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {action}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {canTravelAway && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-card/60 border border-emerald-500/30 rounded-sm px-4 py-3"
          >
            <p className="font-display text-[10px] uppercase tracking-wider text-emerald-400/80 mb-2">
              Where do you go?
            </p>
            <ul className="flex flex-wrap gap-2">
              {travelDestinations.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => handleTravel(node.id, node.name)}
                    disabled={isBusy}
                    className="text-xs font-body text-foreground/80 bg-emerald-950/30 border border-emerald-500/30 rounded-sm px-2.5 py-1.5 hover:border-emerald-400/60 hover:text-emerald-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Footprints className="h-3 w-3" />
                    Travel to {node.name}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Or type it yourself, e.g. &quot;I head toward {travelDestinations[0]?.name}&quot;
            </p>
          </motion.div>
        )}

        {lastRoll && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-card border border-gold rounded-sm px-6 py-3 flex items-center justify-center gap-4 flex-wrap"
          >
            <div className="w-10 h-10 rounded-sm border border-primary bg-primary/10 flex items-center justify-center font-display text-primary text-lg">
              {lastRoll.d20}
            </div>
            <div>
              <span className="font-display text-sm text-primary">
                Roll: {lastRoll.total}
              </span>
              <span className="mx-2 text-muted-foreground">—</span>
              <span className="font-display text-sm text-primary text-gold-glow">
                {outcomeLabels[lastRoll.outcome] ?? lastRoll.outcome}
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-body">
              d20 ({lastRoll.d20}) + {lastRoll.modifier} vs DC {lastRoll.dc}
            </div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-gold pt-4 mt-4">
          <label className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
            What do you do?
          </label>
          <div className="flex gap-3">
            <input
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              disabled={isBusy}
              className="flex-1 bg-background/50 border border-gold rounded-sm px-4 py-2.5 text-foreground font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm disabled:opacity-50"
              placeholder={
                canTravelAway
                  ? `I travel to ${travelDestinations[0]?.name ?? "the next location"}...`
                  : "I carefully step onto the bridge, testing each stone..."
              }
            />
            <button
              type="submit"
              disabled={isBusy || !actionInput.trim()}
              className="btn-fantasy text-xs px-6 disabled:opacity-50"
            >
              {isSubmittingAction || isEnteringNode ? "..." : "Submit"}
            </button>
          </div>
          {actionError && (
            <p className="text-destructive text-sm mt-2">{actionError}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 italic">
            Consult the{" "}
            <Link to="/map" className="text-primary hover:underline">
              realm map
            </Link>{" "}
            for discovered locations.
          </p>
        </form>
      </div>

      <div className="lg:w-[40%] space-y-6">
        <div className="bg-card border border-gold rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-xs uppercase tracking-wider text-primary">Hit Points</span>
            <span className="font-display text-sm text-foreground">32 / 45</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-sm overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "71%" }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-accent rounded-sm"
              style={{ background: "linear-gradient(90deg, hsl(0 69% 35%), hsl(0 69% 45%))" }}
            />
          </div>
          <div className="flex gap-4 mt-3">
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-display">AC:</span> 16
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-display">Level:</span> 5
            </div>
            {character && (
              <div className="text-xs text-muted-foreground truncate">
                <span className="text-foreground font-display">Hero:</span> {character.name}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-gold rounded-sm p-4">
          <h3 className="font-display text-xs uppercase tracking-wider text-primary mb-3">Inventory</h3>
          <div className="space-y-2">
            {inventoryItems.map((item) => (
              <div key={item.name} className="flex items-center gap-3 p-2 rounded-sm hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-sm bg-muted/50 border border-gold flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-body text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-gold rounded-sm p-4">
          <h3 className="font-display text-xs uppercase tracking-wider text-primary mb-3">Status Effects</h3>
          <div className="flex flex-wrap gap-2">
            {statusEffects.map((effect) => (
              <div
                key={effect.name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-muted/30 border border-gold"
              >
                <effect.icon className={`h-3.5 w-3.5 ${effect.color}`} />
                <span className="text-xs font-body text-foreground">{effect.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GameLoop;
