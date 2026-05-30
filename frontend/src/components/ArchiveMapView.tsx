import { useMemo } from "react";
import { Crown, EyeOff } from "lucide-react";
import type { GameMap, MapNode } from "@/context/GameContext";
import { cn } from "@/lib/utils";

const NODE_RADIUS = 28;
const MAP_PADDING = 56;
const MAP_MIN_WIDTH = 560;
const MAP_MIN_HEIGHT = 360;

type ArchiveMapViewProps = {
  map: GameMap;
  progressCompletedNodeIds: string[];
  locationsVisited: string[];
};

function isNodeGoal(node: MapNode, map: GameMap): boolean {
  if (node.isGoal) return true;
  const hasExplicitGoal = map.nodes.some((n) => n.isGoal);
  if (hasExplicitGoal) return false;
  const outgoingIds = new Set(map.edges.map((e) => e.from));
  const sinkNodes = map.nodes.filter((n) => !outgoingIds.has(n.id) && n.status !== "current");
  return sinkNodes.length === 1 && sinkNodes[0].id === node.id;
}

export function ArchiveMapView({
  map,
  progressCompletedNodeIds,
  locationsVisited,
}: ArchiveMapViewProps) {
  const getNode = (id: string) => map.nodes.find((n) => n.id === id);

  const visitedSet = useMemo(() => {
    return new Set<string>([
      ...locationsVisited,
      ...progressCompletedNodeIds,
      ...map.nodes.filter((n) => n.status !== "hidden").map((n) => n.id),
    ]);
  }, [locationsVisited, progressCompletedNodeIds, map.nodes]);

  const pathPoints = useMemo(() => {
    const ids =
      locationsVisited.length > 0
        ? locationsVisited
        : progressCompletedNodeIds.length > 0
          ? progressCompletedNodeIds
          : map.nodes.filter((n) => n.status !== "hidden").map((n) => n.id);

    return ids
      .map((id) => map.nodes.find((n) => n.id === id))
      .filter((node): node is MapNode => Boolean(node))
      .map((node) => ({ x: node.x ?? 0, y: node.y ?? 0, id: node.id }));
  }, [locationsVisited, progressCompletedNodeIds, map.nodes]);

  const mapWidth = Math.max(
    MAP_MIN_WIDTH,
    ...map.nodes.map((n) => (n.x ?? 0) + NODE_RADIUS + MAP_PADDING),
  );
  const mapHeight = Math.max(
    MAP_MIN_HEIGHT,
    ...map.nodes.map((n) => (n.y ?? 0) + NODE_RADIUS + MAP_PADDING),
  );

  const pathPolyline = pathPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 px-1">
        {[
          { className: "bg-primary/25 border-primary", label: "Your path" },
          { className: "bg-primary/10 border-primary/50", label: "Visited" },
          { className: "bg-muted/10 border-muted/25 opacity-60", label: "Unknown" },
          { className: "bg-amber-950/40 border-amber-400/60", label: "Objective", crown: true },
        ].map(({ className, label, crown }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full border flex items-center justify-center",
                className,
              )}
            >
              {crown && <Crown className="w-1.5 h-1.5 text-amber-400/70" />}
            </div>
            <span className="font-display text-[9px] text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="relative bg-card border border-gold/40 rounded-sm overflow-auto max-h-[min(52vh,420px)]">
        <div
          className="relative"
          style={{ width: mapWidth, height: mapHeight, minWidth: mapWidth, minHeight: mapHeight }}
        >
          <svg
            className="absolute inset-0 pointer-events-none"
            width={mapWidth}
            height={mapHeight}
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          >
            {map.edges.map((edge, index) => {
              const na = getNode(edge.from);
              const nb = getNode(edge.to);
              if (!na || !nb) return null;
              if (na.status === "hidden" && nb.status === "hidden") return null;
              const anyHidden = na.status === "hidden" || nb.status === "hidden";
              return (
                <line
                  key={`edge-${index}`}
                  x1={na.x ?? 0}
                  y1={na.y ?? 0}
                  x2={nb.x ?? 0}
                  y2={nb.y ?? 0}
                  stroke="hsl(40 49% 56%)"
                  strokeWidth={anyHidden ? 1 : 1.5}
                  strokeDasharray={anyHidden ? "4 4" : "none"}
                  opacity={anyHidden ? 0.15 : 0.35}
                />
              );
            })}

            {pathPoints.length > 1 && (
              <polyline
                points={pathPolyline}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            )}

            {pathPoints.map((point, index) => (
              <g key={`path-${point.id}`}>
                <circle cx={point.x} cy={point.y} r={6} fill="hsl(var(--primary))" opacity={0.9} />
                <text
                  x={point.x}
                  y={point.y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="hsl(var(--primary-foreground))"
                >
                  {index + 1}
                </text>
              </g>
            ))}
          </svg>

          {map.nodes.map((node) => {
            const isGoal = isNodeGoal(node, map);
            const isHidden = node.status === "hidden";
            const isOnPath = pathPoints.some((p) => p.id === node.id);
            const isVisited = visitedSet.has(node.id);

            return (
              <div
                key={node.id}
                className="absolute flex flex-col items-center pointer-events-none"
                style={{
                  left: (node.x ?? 0) - NODE_RADIUS,
                  top: (node.y ?? 0) - NODE_RADIUS,
                }}
              >
                <div
                  className={cn(
                    "rounded-full border-2 flex items-center justify-center",
                    isOnPath &&
                      "border-primary bg-primary/25 shadow-[0_0_12px_hsl(var(--primary)/0.45)]",
                    !isOnPath && isVisited && "border-primary/50 bg-card",
                    isHidden && !isGoal && "border-muted/25 bg-muted/10 opacity-50",
                    isGoal && "border-amber-400/60 bg-amber-950/40",
                  )}
                  style={{ width: NODE_RADIUS * 2, height: NODE_RADIUS * 2 }}
                >
                  {isHidden && !isGoal ? (
                    <EyeOff className="h-3 w-3 text-muted-foreground/40" />
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 px-1.5">
                      {isGoal && <Crown className="h-2.5 w-2.5 text-amber-400" />}
                      <span
                        className={cn(
                          "font-display text-[8px] text-center leading-tight line-clamp-3",
                          isOnPath ? "text-primary font-semibold" : "text-foreground/80",
                          isGoal && "text-amber-400/90",
                        )}
                      >
                        {isHidden ? "???" : node.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pathPoints.length > 0 && (
        <p className="font-body text-[11px] text-muted-foreground italic px-1">
          Path order:{" "}
          {pathPoints
            .map((p, i) => {
              const node = getNode(p.id);
              return node ? `${i + 1}. ${node.name}` : null;
            })
            .filter(Boolean)
            .join(" → ")}
        </p>
      )}
    </div>
  );
}
