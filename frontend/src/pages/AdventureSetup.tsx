import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const AdventureSetup = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-3xl font-display text-primary text-gold-glow mb-2 tracking-wider">
        Craft Your Quest
      </h1>
      <p className="text-muted-foreground font-body mb-8">
        Describe your ideal adventure and the AI Game Master will weave it into reality.
      </p>

      <div className="narrative-panel mb-8">
        <label className="font-display text-xs uppercase tracking-wider text-primary mb-3 block">
          Adventure Concept
        </label>
        <textarea
          className="w-full bg-background/50 border border-gold rounded-sm px-4 py-3 text-foreground font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[200px] resize-none"
          readOnly
          defaultValue={`A dark quest through the Underdark, where ancient dwarven ruins hold the key to sealing a rift between planes. The party must navigate treacherous caverns filled with mind flayers and their thralls, while deciphering runes left by a long-dead archmage. Political intrigue among the drow houses adds another layer of danger — trust no one in the depths.`}
        />
      </div>

      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-fantasy flex items-center gap-3 text-base px-12 py-4 animate-pulse-glow"
        >
          <Sparkles className="h-5 w-5" />
          Generate Adventure
        </motion.button>
      </div>
    </motion.div>
  );
};

export default AdventureSetup;
