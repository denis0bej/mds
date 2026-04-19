import { motion } from "framer-motion";
import { Skull, MapPin, Package, Download, RotateCcw } from "lucide-react";

const summaryText = `After weeks of perilous travel through the Underdark, your party emerged victorious from the Sunken Archive. The rift between planes has been sealed — for now — and the ancient dwarven wards hold fast once more.

Thalion Shadowmere proved instrumental in navigating the treacherous caverns, his ranger instincts guiding the party through ambushes and traps alike. The confrontation with the mind flayer elder was the turning point — a battle that nearly cost the party everything.

In the end, the archmage's final rune was deciphered, and the sealing ritual completed under the light of bioluminescent crystals. The drow houses, for once united against the common threat, have retreated to their own domains. An uneasy peace settles over the deep.

Yet whispers remain. The rift may be sealed, but what slipped through before the closing… that is a tale for another day.`;

const stats = [
  { label: "Enemies Defeated", value: 12, icon: Skull },
  { label: "Locations Visited", value: 5, icon: MapPin },
  { label: "Items Collected", value: 8, icon: Package },
];

const AdventureSummary = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-3xl font-display text-primary text-gold-glow mb-2 tracking-wider text-center">
        Your Adventure Summary
      </h1>
      <p className="text-muted-foreground font-body text-center mb-8">
        The tale of Thalion Shadowmere — Ranger of Elyndor
      </p>

      <div className="narrative-panel mb-8">
        <p className="font-body text-parchment leading-relaxed whitespace-pre-line text-sm">
          {summaryText}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="stat-card flex flex-col items-center gap-2 py-6"
          >
            <stat.icon className="h-6 w-6 text-primary" />
            <div className="font-display text-3xl text-primary text-gold-glow">{stat.value}</div>
            <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button className="btn-fantasy flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download Summary
        </button>
        <button className="btn-fantasy flex items-center gap-2 bg-secondary text-secondary-foreground border-gold hover:bg-muted">
          <RotateCcw className="h-4 w-4" />
          Start New Adventure
        </button>
      </div>
    </motion.div>
  );
};

export default AdventureSummary;
