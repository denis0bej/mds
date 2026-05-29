import { useState, FormEvent, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Footprints, Trophy, Skull, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useGame, getAvailableTravelDestinations } from "@/context/GameContext";
import { NarrationPanel } from "@/components/NarrationPanel";
import { CharacterPanel } from "@/components/CharacterPanel";
import { EventLog } from "@/components/EventLog";
import { DiceRoller, ROLL_DURATION_MS } from "@/components/DiceRoller";
import { toRollCheck, toRollResult, type RollCheck, type RollResult } from "@/lib/dice";
import { getEndReasonDescription, getEndReasonLabel } from "@/lib/adventureEnd";

type DiceUiState = {
  check: RollCheck;
  result: RollResult | null;
  isRolling: boolean;
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
    lastCheck,
    runtimeState,
    progressCompletedNodeIds,
    sessionEvents,
    eventLogVisible,
    eventLogMinimized,
    setEventLogVisible,
    setEventLogMinimized,
    adventureComplete,
    adventureEndReason,
    mainMission,
  } = useGame();

  const navigate = useNavigate();
  const [actionInput, setActionInput] = useState("");
  const [diceUi, setDiceUi] = useState<DiceUiState | null>(null);
  const autoEnterAttempted = useRef(false);
  const rollKeyRef = useRef("");

  const currentNode = map?.nodes.find((n) => n.id === currentNodeId);
  const travelDestinations =
    map && currentNodeId
      ? getAvailableTravelDestinations(map, currentNodeId, progressCompletedNodeIds)
      : [];
  const canTravelAway = travelDestinations.length > 0 && !adventureComplete;
  const isBusy = isEnteringNode || isSubmittingAction || !!animateMessageId;

  useEffect(() => {
    if (!lastRoll || !lastCheck) {
      setDiceUi(null);
      return;
    }

    const check = toRollCheck(lastCheck);
    if (!check) return;

    const rollKey = `${lastRoll.d20}-${lastRoll.total}-${lastRoll.dc}-${check.dice}`;
    if (rollKeyRef.current === rollKey) return;
    rollKeyRef.current = rollKey;

    const result = toRollResult(lastRoll, check);
    setDiceUi({ check, result, isRolling: true });

    const timer = setTimeout(() => {
      setDiceUi({ check, result, isRolling: false });
    }, ROLL_DURATION_MS);

    return () => clearTimeout(timer);
  }, [lastRoll, lastCheck]);

  useEffect(() => {
    if (!map || !currentNodeId || !character || isEnteringNode || adventureComplete) return;
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
    adventureComplete,
    enterLocation,
  ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!actionInput.trim() || isBusy || adventureComplete) return;

    try {
      await submitAction(actionInput);
      setActionInput("");
    } catch {
      // error shown via actionError
    }
  };

  const handleTravel = async (nodeId: string, nodeName: string) => {
    if (isBusy || adventureComplete) return;

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

  const endIcon =
    adventureEndReason === "death" ? (
      <Skull className="h-8 w-8 text-destructive mx-auto mb-3" />
    ) : (
      <Trophy className="h-8 w-8 text-primary mx-auto mb-3" />
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]"
    >
      <div className="lg:w-[60%] flex flex-col">
        {mainMission && !adventureComplete && (
          <div className="mb-4 bg-card/60 border border-gold/30 rounded-sm px-4 py-3">
            <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
              <Target className="h-3 w-3" />
              Main Mission — {mainMission.type}
            </p>
            <p className="font-body text-sm text-foreground/90">{mainMission.title}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">Target: {mainMission.target}</p>
          </div>
        )}

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

        {adventureComplete && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 victory-panel px-5 py-5 text-center"
          >
            {endIcon}
            <h2 className="font-display text-xl text-primary text-gold-glow tracking-wider mb-2">
              {getEndReasonLabel(adventureEndReason)}
            </h2>
            <p className="font-body text-sm text-muted-foreground mb-4">
              {getEndReasonDescription(adventureEndReason, mainMission)}
            </p>
            <button
              type="button"
              onClick={() => navigate("/summary")}
              className="btn-fantasy text-xs px-8"
            >
              Go to Summary
            </button>
          </motion.div>
        )}

        {!adventureComplete && currentEncounter && currentEncounter.suggested_actions.length > 0 && (
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

        {!adventureComplete && canTravelAway && (
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

        {!adventureComplete && (
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
              for discovered locations. To leave early, type e.g. &quot;I end the adventure&quot;.
            </p>
          </form>
        )}

        <EventLog
          events={sessionEvents}
          visible={eventLogVisible}
          minimized={eventLogMinimized}
          onToggleVisible={() => setEventLogVisible(!eventLogVisible)}
          onToggleMinimized={() => setEventLogMinimized(!eventLogMinimized)}
        />
      </div>

      <div className="lg:w-[40%] space-y-6">
        <CharacterPanel character={character} runtimeState={runtimeState} />

        <AnimatePresence>
          {diceUi && !adventureComplete && (
            <DiceRoller
              check={diceUi.check}
              result={diceUi.result}
              isRolling={diceUi.isRolling}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default GameLoop;
