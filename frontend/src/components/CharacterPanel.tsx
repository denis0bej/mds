import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Shield,
  Sword,
  Scroll,
  Gem,
  Flame,
  Hexagon,
  Package,
  Sparkles,
  Skull,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CharacterData } from "@/context/GameContext";
import type { GameRuntimeState, InventoryItem, StatusEffect } from "@/lib/gameState";

const ICON_MAP: Record<string, LucideIcon> = {
  sword: Sword,
  heart: Heart,
  scroll: Scroll,
  gem: Gem,
  flame: Flame,
  shield: Shield,
  hexagon: Hexagon,
  package: Package,
  sparkles: Sparkles,
  skull: Skull,
};

function getItemIcon(icon: string): LucideIcon {
  return ICON_MAP[icon] ?? Package;
}

function getEffectIcon(effect: StatusEffect): LucideIcon {
  if (effect.type === "debuff") return Flame;
  if (effect.id.includes("darkvision")) return Hexagon;
  if (effect.id.includes("bless")) return Shield;
  return Sparkles;
}

type CharacterPanelProps = {
  character: CharacterData | null;
  runtimeState: GameRuntimeState | null;
};

export function CharacterPanel({ character, runtimeState }: CharacterPanelProps) {
  const prevHp = useRef<number | null>(null);
  const hpPulseKey = useRef(0);

  useEffect(() => {
    if (runtimeState && prevHp.current !== null && prevHp.current !== runtimeState.hp) {
      hpPulseKey.current += 1;
    }
    if (runtimeState) {
      prevHp.current = runtimeState.hp;
    }
  }, [runtimeState]);

  if (!runtimeState) {
    return (
      <div className="bg-card border border-gold rounded-sm p-4">
        <p className="font-body text-xs text-muted-foreground italic">Loading character state...</p>
      </div>
    );
  }

  const hpPercent = runtimeState.maxHp > 0 ? (runtimeState.hp / runtimeState.maxHp) * 100 : 0;
  const isLowHp = hpPercent <= 25;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <motion.div
          key={hpPulseKey.current}
          initial={{ boxShadow: "0 0 0 0 hsl(var(--primary) / 0)" }}
          animate={{
            boxShadow: [
              "0 0 0 0 hsl(var(--primary) / 0)",
              "0 0 0 4px hsl(var(--primary) / 0.15)",
              "0 0 0 0 hsl(var(--primary) / 0)",
            ],
          }}
          transition={{ duration: 0.6 }}
          className="bg-card border border-gold rounded-sm p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-xs uppercase tracking-wider text-primary">Hit Points</span>
            <motion.span
              key={`${runtimeState.hp}-${runtimeState.maxHp}`}
              initial={{ scale: 1.2, color: "hsl(var(--primary))" }}
              animate={{ scale: 1, color: "hsl(var(--foreground))" }}
              transition={{ duration: 0.35 }}
              className="font-display text-sm"
            >
              {runtimeState.hp} / {runtimeState.maxHp}
            </motion.span>
          </div>
          <div className="w-full h-3 bg-muted rounded-sm overflow-hidden">
            <motion.div
              animate={{ width: `${hpPercent}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
              className="h-full rounded-sm"
              style={{
                background: isLowHp
                  ? "linear-gradient(90deg, hsl(0 69% 30%), hsl(0 69% 45%))"
                  : "linear-gradient(90deg, hsl(0 69% 35%), hsl(0 69% 50%))",
              }}
            />
          </div>
          <div className="flex gap-4 mt-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-display">AC:</span> {runtimeState.ac}
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-display">Level:</span> {runtimeState.level}
            </div>
            {character && (
              <div className="text-xs text-muted-foreground truncate">
                <span className="text-foreground font-display">Hero:</span> {character.name}
              </div>
            )}
          </div>
        </motion.div>

        <div className="bg-card border border-gold rounded-sm p-4">
          <h3 className="font-display text-xs uppercase tracking-wider text-primary mb-3">Inventory</h3>
          {runtimeState.inventory.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground italic">Your pack is empty.</p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {runtimeState.inventory.map((item) => (
                  <InventoryRow key={item.id} item={item} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="bg-card border border-gold rounded-sm p-4">
          <h3 className="font-display text-xs uppercase tracking-wider text-primary mb-3">Status Effects</h3>
          {runtimeState.statusEffects.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground italic">No active effects.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {runtimeState.statusEffects.map((effect) => (
                  <StatusEffectBadge key={effect.id} effect={effect} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const Icon = getItemIcon(item.icon);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 12, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-3 p-2 rounded-sm hover:bg-muted/30 transition-colors cursor-default">
            <motion.div
              whileHover={{ scale: 1.08 }}
              className="w-8 h-8 rounded-sm bg-muted/50 border border-gold flex items-center justify-center"
            >
              <Icon className="h-4 w-4 text-primary" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-body text-foreground truncate">{item.name}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground truncate">{item.description}</div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        {item.description && (
          <TooltipContent side="left" className="max-w-xs font-body text-xs">
            {item.description}
          </TooltipContent>
        )}
      </Tooltip>
    </motion.div>
  );
}

function StatusEffectBadge({ effect }: { effect: StatusEffect }) {
  const Icon = getEffectIcon(effect);
  const color = effect.type === "debuff" ? "text-accent" : "text-primary";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm bg-muted/30 border ${
              effect.type === "debuff" ? "border-accent/40" : "border-gold"
            } cursor-default`}
          >
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span className="text-xs font-body text-foreground">{effect.name}</span>
          </div>
        </TooltipTrigger>
        {effect.description && (
          <TooltipContent side="top" className="max-w-xs font-body text-xs">
            {effect.description}
          </TooltipContent>
        )}
      </Tooltip>
    </motion.div>
  );
}
