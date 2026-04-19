import { motion } from "framer-motion";
import { Heart, Shield, Sword, Scroll, Gem, Flame, Hexagon } from "lucide-react";

const narrativeText = `The ancient stone doors groan open, revealing a vast chamber lit by phosphorescent fungi clinging to the cavern ceiling. The air is thick with the scent of damp earth and something else — something old and metallic, like dried blood.

Before you, a narrow bridge of carved stone spans a chasm of unknowable depth. On the far side, you can make out the faint glow of runic inscriptions pulsing with an amber light. The whispers you've been hearing since entering the ruins grow louder here, overlapping into a discordant chorus.

To your left, a collapsed passage is partially cleared — it might lead to a side chamber. To your right, water drips steadily from stalactites into a dark pool. Something moves beneath the surface.

The bridge looks stable, but ancient. What do you do?`;

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

const GameLoop = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]"
    >
      {/* Left: Narrative Panel (60%) */}
      <div className="lg:w-[60%] flex flex-col">
        <div className="narrative-panel flex-1 flex flex-col overflow-hidden">
          <h2 className="font-display text-lg text-primary tracking-wider mb-4">
            Chapter III — The Sunken Archive
          </h2>
          <div className="flex-1 overflow-y-auto pr-2 mb-4">
            <p className="font-body text-parchment leading-relaxed whitespace-pre-line text-sm">
              {narrativeText}
            </p>
          </div>

          {/* Input */}
          <div className="border-t border-gold pt-4">
            <label className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
              What do you do?
            </label>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-background/50 border border-gold rounded-sm px-4 py-2.5 text-foreground font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                placeholder="I carefully step onto the bridge, testing each stone..."
                
              />
              <button className="btn-fantasy text-xs px-6">Submit</button>
            </div>
          </div>
        </div>

        {/* Dice Roll HUD */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 bg-card border border-gold rounded-sm px-6 py-3 flex items-center justify-center gap-4"
        >
          <div className="w-10 h-10 rounded-sm border border-primary bg-primary/10 flex items-center justify-center font-display text-primary text-lg">
            D20
          </div>
          <div>
            <span className="font-display text-sm text-primary">Roll: 17</span>
            <span className="mx-2 text-muted-foreground">—</span>
            <span className="font-display text-sm text-primary text-gold-glow">Success!</span>
          </div>
          <div className="text-xs text-muted-foreground font-body">
            Perception Check (DC 15)
          </div>
        </motion.div>
      </div>

      {/* Right: Character Panel (40%) */}
      <div className="lg:w-[40%] space-y-6">
        {/* HP Bar */}
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
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-display">XP:</span> 6,500
            </div>
          </div>
        </div>

        {/* Inventory */}
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

        {/* Status Effects */}
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
