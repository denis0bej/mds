import { motion } from "framer-motion";
import { useGame } from "../context/GameContext";

const MapView = () => {
  const { map } = useGame();

  if (!map) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="narrative-panel text-center">
          <p className="font-body text-muted-foreground mb-3">
            No map has been generated yet.
          </p>
          <a href="/adventure" className="btn-fantasy text-sm inline-block">Start Adventure</a>
        </div>
      </div>
    );
  }

  const getNode = (id: string) => map.nodes.find((n) => n.id === id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <h1 className="text-3xl font-display text-primary text-gold-glow mb-6 tracking-wider">
        Realm Map
      </h1>

      <div className="relative bg-card border border-gold rounded-sm overflow-x-auto">
        <div className="relative" style={{ width: 800, height: 540 }}>
        {/* SVG connections */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 540">
          {map.edges.map((edge, index) => {
            const na = getNode(edge.from);
            const nb = getNode(edge.to);
            if (!na || !nb) return null;
            
            const anyHidden = na.status === "hidden" || nb.status === "hidden";
            return (
              <line
                key={`edge-${index}`}
                x1={na.x || 0}
                y1={na.y || 0}
                x2={nb.x || 0}
                y2={nb.y || 0}
                stroke="hsl(40 49% 56%)"
                strokeWidth={2}
                strokeDasharray={anyHidden ? "6 4" : "none"}
                opacity={anyHidden ? 0.15 : 0.4}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {map.nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="absolute flex flex-col items-center"
            style={{
              left: (node.x || 0) - 45,
              top: (node.y || 0) - 45,
            }}
          >
            <div
              className={`w-[90px] h-[90px] rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-lg ${
                node.status === "current"
                  ? "border-primary bg-primary/20 animate-pulse-glow"
                  : node.status === "discovered"
                  ? "border-primary/40 bg-card"
                  : "border-muted/30 bg-muted/20 opacity-30"
              }`}
              title={node.status !== "hidden" ? node.description : "Unknown location"}
            >
              <span className="font-display text-[9px] text-center leading-tight px-2 text-foreground break-words overflow-hidden max-h-[70px]">
                {node.status === "hidden" ? "???" : node.name}
              </span>
            </div>
          </motion.div>
        ))}
        </div>
      </div>
    </motion.div>
  );
};

export default MapView;


