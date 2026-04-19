import { motion } from "framer-motion";

interface MapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  status: "current" | "discovered" | "hidden";
}

const nodes: MapNode[] = [
  { id: "1", label: "Village of Thornhaven", x: 150, y: 100, status: "discovered" },
  { id: "2", label: "Dark Forest", x: 350, y: 80, status: "discovered" },
  { id: "3", label: "Ancient Ruins", x: 550, y: 150, status: "current" },
  { id: "4", label: "Cursed Swamp", x: 300, y: 250, status: "discovered" },
  { id: "5", label: "Dragon's Lair", x: 650, y: 320, status: "hidden" },
  { id: "6", label: "Crystal Caverns", x: 500, y: 350, status: "hidden" },
  { id: "7", label: "Tower of Shadows", x: 200, y: 380, status: "hidden" },
  { id: "8", label: "Sacred Temple", x: 450, y: 450, status: "hidden" },
];

const edges: [string, string][] = [
  ["1", "2"],
  ["2", "3"],
  ["1", "4"],
  ["4", "2"],
  ["3", "5"],
  ["3", "6"],
  ["4", "7"],
  ["6", "8"],
  ["7", "8"],
];

const getNode = (id: string) => nodes.find((n) => n.id === id)!;

const MapView = () => {
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
          {edges.map(([a, b]) => {
            const na = getNode(a);
            const nb = getNode(b);
            const anyHidden = na.status === "hidden" || nb.status === "hidden";
            return (
              <line
                key={`${a}-${b}`}
                x1={na.x}
                y1={na.y}
                x2={nb.x}
                y2={nb.y}
                stroke="hsl(40 49% 56%)"
                strokeWidth={2}
                strokeDasharray={anyHidden ? "6 4" : "none"}
                opacity={anyHidden ? 0.15 : 0.4}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="absolute flex flex-col items-center"
            style={{
              left: node.x - 36,
              top: node.y - 36,
            }}
          >
            <div
              className={`w-[72px] h-[72px] rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                node.status === "current"
                  ? "border-primary bg-primary/20 animate-pulse-glow"
                  : node.status === "discovered"
                  ? "border-primary/40 bg-card"
                  : "border-muted/30 bg-muted/20 opacity-30"
              }`}
            >
              <span className="font-display text-[10px] text-center leading-tight px-1 text-foreground">
                {node.status === "hidden" ? "???" : node.label.split(" ").slice(-1)[0]}
              </span>
            </div>
            {node.status !== "hidden" && (
              <span className="mt-1 font-body text-[10px] text-muted-foreground text-center max-w-[90px]">
                {node.label}
              </span>
            )}
            {node.status === "current" && (
              <span className="mt-0.5 font-display text-[8px] uppercase tracking-widest text-primary">
                You are here
              </span>
            )}
          </motion.div>
        ))}
        </div>
      </div>
    </motion.div>
  );
};

export default MapView;
