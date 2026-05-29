import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Eye, EyeOff, Compass, Crown } from "lucide-react";
import { useGame, MapNode, getAdjacentNodeIds } from "../context/GameContext";

const NODE_RADIUS = 38;
const MAP_PADDING = 80;
const MAP_MIN_WIDTH = 800;
const MAP_MIN_HEIGHT = 540;

import { useUIPreferences } from "../context/UIPreferencesContext";

const statusStyles = {
  current: {
    outer: "border-primary bg-primary/20 shadow-[0_0_24px_4px_hsl(var(--primary)/0.5)]",
    text: "text-primary font-semibold",
  },
  discovered: {
    outer: "border-primary/50 bg-card hover:border-primary/80 hover:bg-primary/10 cursor-pointer transition-all",
    text: "text-foreground",
  },
  hidden: {
    outer: "border-muted/20 bg-muted/10 cursor-not-allowed",
    text: "text-muted-foreground/40",
  },
  goal: {
    outer: "border-amber-500/60 bg-amber-500/10 cursor-not-allowed shadow-[0_0_16px_2px_rgba(251,191,36,0.15)]",
    text: "text-amber-600 dark:text-amber-400 font-medium",
  },
};

const NodeDetailPanel = ({
  node,
  edges,
  nodes,
  currentNodeId,
  onClose,
}: {
  node: MapNode;
  edges: { from: string; to: string; condition?: string }[];
  nodes: MapNode[];
  currentNodeId: string | null;
  onClose: () => void;
}) => {
  const connectedEdges = edges.filter((e) => e.from === node.id || e.to === node.id);
  const isCurrent = node.id === currentNodeId;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.25 }}
        className="absolute top-0 right-0 h-full w-72 bg-card border-l border-gold/40 p-5 flex flex-col gap-4 z-20 overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-display text-primary text-sm tracking-wider leading-tight">
              {node.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-gold/20" />

        <div>
          <p className="font-body text-xs text-muted-foreground leading-relaxed">
            {node.description}
          </p>
        </div>

        {isCurrent && (
          <div className="bg-primary/10 border border-primary/30 rounded-sm px-3 py-2">
            <p className="font-display text-[10px] text-primary uppercase tracking-widest">
              ◆ You are here
            </p>
          </div>
        )}

        {node.isGoal && (
          <div className="bg-amber-950/40 border border-amber-400/40 rounded-sm px-3 py-2 flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-amber-400" />
            <p className="font-display text-[10px] text-amber-400 uppercase tracking-widest">
              Final Objective
            </p>
          </div>
        )}

        {connectedEdges.length > 0 && (
          <div>
            <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Connections
            </p>
            <ul className="flex flex-col gap-2">
              {connectedEdges.map((edge, i) => {
                const otherId = edge.from === node.id ? edge.to : edge.from;
                const other = nodes.find((n) => n.id === otherId);
                if (!other) return null;
                const isHidden = other.status === "hidden";
                return (
                  <li key={i} className="flex items-start gap-2">
                    {isHidden ? (
                      <EyeOff className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                    ) : (
                      <Eye className="h-3 w-3 text-primary/60 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="font-body text-[11px] text-foreground/80">
                        {isHidden ? "???" : other.name}
                      </p>
                      {edge.condition && !isHidden && (
                        <p className="font-body text-[10px] text-muted-foreground italic">
                          {edge.condition}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="font-body text-[11px] text-muted-foreground italic mt-auto border border-gold/20 rounded-sm px-3 py-2">
          Travel by describing your destination on the Game page.
        </p>
      </motion.div>
    </AnimatePresence>
  );
};

const MapView = () => {
  const { map, character, currentNodeId, progressCompletedNodeIds } = useGame();
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  if (!map) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="narrative-panel text-center">
          <Compass className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-body text-muted-foreground mb-4">
            No map has been generated yet.
          </p>
          <a href="/adventure" className="btn-fantasy text-sm inline-block">
            Start Adventure
          </a>
        </div>
      </div>
    );
  }

  const getNode = (id: string) => map.nodes.find((n) => n.id === id);

  const hasExplicitGoal = map.nodes.some((n) => n.isGoal);
  const outgoingIds = new Set(map.edges.map((e) => e.from));
  const sinkNodes = map.nodes.filter(
    (n) => !outgoingIds.has(n.id) && n.status !== "current",
  );
  const inferredGoalId =
    !hasExplicitGoal && sinkNodes.length === 1 ? sinkNodes[0].id : null;

  const isNodeGoal = (node: MapNode) =>
    !!node.isGoal || node.id === inferredGoalId;

  const handleNodeClick = (node: MapNode) => {
    if (node.status === "hidden") return;
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  };

  const discoveredCount = map.nodes.filter((n) => n.status !== "hidden").length;
  const totalCount = map.nodes.length;
  const currentNode = map.nodes.find((n) => n.status === "current");
  const adjacentIds = currentNode ? getAdjacentNodeIds(map, currentNode.id) : [];
  const canTravelFromCurrent =
    !!currentNode && progressCompletedNodeIds.includes(currentNode.id);

  const mapWidth = Math.max(
    MAP_MIN_WIDTH,
    ...map.nodes.map((n) => (n.x ?? 0) + NODE_RADIUS + MAP_PADDING),
  );
  const mapHeight = Math.max(
    MAP_MIN_HEIGHT,
    ...map.nodes.map((n) => (n.y ?? 0) + NODE_RADIUS + MAP_PADDING),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="max-w-5xl mx-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-display text-primary text-gold-glow tracking-wider">
          Realm Map
        </h1>
        <div className="flex items-center gap-2 text-xs font-display text-muted-foreground uppercase tracking-widest">
          <Eye className="h-3.5 w-3.5" />
          <span>
            {discoveredCount} / {totalCount} discovered
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-4 px-1 flex-wrap">
        {[
          { color: "bg-primary/20 border-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]", label: "Current" },
          { color: "bg-card border-primary/50", label: "Discovered" },
          { color: "bg-muted/10 border-muted/20 opacity-50", label: "Unknown" },
          { color: "bg-amber-950/40 border-amber-400/60", label: "Objective", icon: true },
        ].map(({ color, label, icon }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full border ${color} flex items-center justify-center`}>
              {icon && <Crown className="w-2 h-2 text-amber-400/60" />}
            </div>
            <span className="font-display text-[10px] text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
          </div>
        ))}
      </div>

      {!character && (
        <div className="narrative-panel border-gold/30 mb-4 text-center py-3">
          <p className="font-body text-xs text-muted-foreground">
            Create a character before playing.
          </p>
        </div>
      )}

      <div className="relative bg-[hsl(var(--card))] border border-gold/40 rounded-sm overflow-auto max-h-[min(70vh,620px)]">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMCAyTDQgMiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9Ii41Ii8+PC9zdmc+')]" />

        <div
          className="relative"
          style={{ width: mapWidth, height: mapHeight, minWidth: mapWidth, minHeight: mapHeight }}
        >
          <svg
            className="absolute inset-0"
            width={mapWidth}
            height={mapHeight}
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          >
            {map.edges.map((edge, index) => {
              const na = getNode(edge.from);
              const nb = getNode(edge.to);
              if (!na || !nb) return null;

              const bothHidden = na.status === "hidden" && nb.status === "hidden";
              const anyHidden = na.status === "hidden" || nb.status === "hidden";

              if (bothHidden) return null;

              return (
                <line
                  key={`edge-${index}`}
                  x1={na.x ?? 0}
                  y1={na.y ?? 0}
                  x2={nb.x ?? 0}
                  y2={nb.y ?? 0}
                  stroke="hsl(40 49% 56%)"
                  strokeWidth={anyHidden ? 1.5 : 2}
                  strokeDasharray={anyHidden ? "5 5" : "none"}
                  opacity={anyHidden ? 0.2 : 0.5}
                />
              );
            })}
          </svg>

          {map.nodes.map((node, i) => {
            const isGoal = isNodeGoal(node);
            const isHidden = node.status === "hidden";
            const isSelected = selectedNode?.id === node.id;
            const styleKey = isGoal && isHidden ? "goal" : node.status;
            const styles = statusStyles[styleKey as keyof typeof statusStyles];

            const isAdjacent = currentNode ? adjacentIds.includes(node.id) : false;
            const isTravelTarget =
              canTravelFromCurrent &&
              isAdjacent &&
              node.id !== currentNode?.id &&
              node.status !== "hidden";

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07, duration: 0.4, type: "spring", stiffness: 200 }}
                className="absolute flex flex-col items-center"
                style={{
                  left: (node.x ?? 0) - NODE_RADIUS,
                  top: (node.y ?? 0) - NODE_RADIUS,
                }}
                onClick={() => handleNodeClick(node)}
              >
                {node.status === "current" && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: NODE_RADIUS * 2, height: NODE_RADIUS * 2 }}
                  />
                )}

                {isGoal && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-amber-400/40"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: NODE_RADIUS * 2, height: NODE_RADIUS * 2 }}
                  />
                )}

                {isSelected && !isHidden && (
                  <div
                    className="absolute inset-0 rounded-full border-2 border-primary shadow-[0_0_10px_white] dark:shadow-none"
                    style={{ width: NODE_RADIUS * 2, height: NODE_RADIUS * 2 }}
                  />
                )}

                {isTravelTarget && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-emerald-400/70"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.35, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: NODE_RADIUS * 2, height: NODE_RADIUS * 2 }}
                  />
                )}

                <div
                  className={`rounded-full border-2 flex items-center justify-center transition-all duration-200 ${styles.outer} ${isHidden && !isGoal ? "" : isHidden ? "" : "hover:scale-110"}`}
                  style={{ width: NODE_RADIUS * 2, height: NODE_RADIUS * 2 }}
                >
                  {isGoal && isHidden ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400/50" />
                      <span className="font-display text-[8px] text-amber-700 dark:text-amber-400/40">???</span>
                    </div>
                  ) : isHidden ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground/30" />
                      <span className="font-display text-[8px] text-muted-foreground/30">???</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 px-2">
                      {isGoal && <Crown className="h-3 w-3 text-amber-600 dark:text-amber-400 mb-0.5" />}
                      <span
                        className={`font-display text-[9px] text-center leading-tight break-words overflow-hidden max-h-[55px] ${styles.text}`}
                      >
                        {node.name}
                      </span>
                    </div>
                  )}
                </div>

                {isHidden && !isGoal && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      width: NODE_RADIUS * 2,
                      height: NODE_RADIUS * 2,
                      background:
                        "radial-gradient(circle, hsl(var(--background)/0.6) 0%, hsl(var(--background)/0.85) 100%)",
                    }}
                  />
                )}

                {isGoal && (
                  <span className="mt-1 font-sans text-[10px] text-amber-800 dark:text-amber-400 uppercase tracking-wider font-bold">
                    Objective
                  </span>
                )}
              </motion.div>
            );
          })}

          {selectedNode && (
            <NodeDetailPanel
              node={{ ...selectedNode, isGoal: isNodeGoal(selectedNode) }}
              edges={map.edges}
              nodes={map.nodes}
              currentNodeId={currentNodeId}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </div>

      <p className="text-[10px] font-body text-muted-foreground/50 text-center mt-3 italic">
        Scroll to explore the realm. Travel by telling the Dungeon Master where you go on the Game page.
      </p>
    </motion.div>
  );
};

export default MapView;
