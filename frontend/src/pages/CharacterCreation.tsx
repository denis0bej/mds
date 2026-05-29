import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Dices, ChevronDown, Check, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGame, CharacterStats, type CharacterData } from "@/context/GameContext";
import { apiFetch } from "@/lib/api";
import { CharacterAvatarPicker } from "@/components/CharacterAvatarPicker";

const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Gnome", "Half-Elf", "Half-Orc", "Tiefling"];
const CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];

const CustomSelect = ({ value, onChange, options, placeholder }: { value: string, onChange: (v: string) => void, options: string[], placeholder: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full bg-input border border-gold rounded-sm px-4 py-3 text-foreground font-body h-auto focus:ring-1 focus:ring-primary focus:ring-offset-0 items-center justify-between"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-[500px] w-full overflow-y-auto rounded-md border border-gold bg-card text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="p-1">
            {options.map((opt) => (
              <div
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gold/20 hover:text-primary ${
                  value === opt ? "text-primary font-medium" : "text-foreground"
                }`}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {value === opt && <Check className="h-4 w-4" />}
                </span>
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const characterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  race: z.string().min(2, "Race must be at least 2 characters."),
  characterClass: z.string().min(2, "Class must be at least 2 characters."),
  backstory: z.string().min(10, "Backstory must be at least 10 characters."),
});

type CharacterFormValues = z.infer<typeof characterSchema>;

type StatKey = keyof CharacterStats;

const rollStat = () => {
  // Roll 4d6, drop lowest
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
};

const STAT_LABELS: Record<StatKey, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

function CharacterSheet({ character }: { character: CharacterData }) {
  const { updateCharacterAvatar } = useGame();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto pb-10"
    >
      <h1 className="text-3xl font-display text-primary text-gold-glow mb-2 tracking-wider">
        Your Hero
      </h1>
      <p className="text-muted-foreground font-body text-sm mb-8">
        Character sheet — view only. Use &quot;New Character&quot; in the sidebar to start over.
      </p>

      <div className="narrative-panel space-y-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <CharacterAvatarPicker
            avatar={character.avatar}
            onAvatarChange={(nextAvatar) => {
              updateCharacterAvatar(nextAvatar).catch(() => {});
            }}
            label="Character Avatar"
          />

          <div className="flex-1 space-y-4">
            <div>
              <p className="font-display text-xs uppercase tracking-wider text-primary mb-1">Name</p>
              <p className="font-body text-foreground text-lg">{character.name}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-display text-xs uppercase tracking-wider text-primary mb-1">Race</p>
                <p className="font-body text-foreground">{character.race}</p>
              </div>
              <div>
                <p className="font-display text-xs uppercase tracking-wider text-primary mb-1">Class</p>
                <p className="font-body text-foreground">{character.characterClass}</p>
              </div>
            </div>
            <div>
              <p className="font-display text-xs uppercase tracking-wider text-primary mb-1">Backstory</p>
              <p className="font-body text-foreground/90 leading-relaxed whitespace-pre-line">
                {character.backstory}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg text-primary tracking-wider mb-4">Ability Scores</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {(Object.keys(character.stats) as StatKey[]).map((statKey) => {
              const statVal = character.stats[statKey];
              const mod = Math.floor((statVal - 10) / 2);
              return (
                <div key={statKey} className="stat-card flex flex-col items-center justify-center min-h-[100px]">
                  <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-1">
                    {statKey}
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-2">{STAT_LABELS[statKey]}</div>
                  <div className="font-display text-2xl text-primary text-gold-glow">{statVal}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {mod >= 0 ? `+${mod}` : mod}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const CharacterCreation = () => {
  const { setCharacter, setSessionId, character, isLoading } = useGame();

  const [avatar, setAvatar] = useState<string | null>(null);
  const [hasRolledStats, setHasRolledStats] = useState(false);
  const [availableValues, setAvailableValues] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isGeneratingBackstory, setIsGeneratingBackstory] = useState(false);
  const [generateBackstoryError, setGenerateBackstoryError] = useState<string | null>(null);
  
  const [assignedStats, setAssignedStats] = useState<Record<StatKey, number | null>>({
    STR: null,
    DEX: null,
    CON: null,
    INT: null,
    WIS: null,
    CHA: null,
  });

  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: "",
      race: "",
      characterClass: "",
      backstory: "",
    },
  });

  const handleRollStats = () => {
    if (hasRolledStats) return; // Prevent rerolling
    
    const newRolls = Array.from({ length: 6 }, () => rollStat());
    // Sort rolls descending for better UX
    newRolls.sort((a, b) => b - a);
    
    setAvailableValues(newRolls);
    setHasRolledStats(true);
  };

  const handleGenerateBackstory = async () => {
    setIsGeneratingBackstory(true);
    setGenerateBackstoryError(null);
    const { name, race, characterClass } = form.getValues();

    try {
      const data = await apiFetch<{ backstory: string }>("/character/generate-backstory", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || undefined,
          race: race.trim() || undefined,
          characterClass: characterClass.trim() || undefined,
        }),
      });
      form.setValue("backstory", data.backstory, { shouldValidate: true, shouldDirty: true });
    } catch (err) {
      setGenerateBackstoryError(err instanceof Error ? err.message : "Could not generate backstory.");
    } finally {
      setIsGeneratingBackstory(false);
    }
  };

  const handleDropToStat = (e: React.DragEvent, targetStat: StatKey) => {
    e.preventDefault();
    const dataString = e.dataTransfer.getData("text/plain");
    if (!dataString) return;
    
    const data = JSON.parse(dataString);
    const { value, source, sourceStat, index } = data;

    setAssignedStats((prev) => {
      const newStats = { ...prev };
      const existingValueInTarget = newStats[targetStat];

      if (source === "pool") {
        newStats[targetStat] = value;
        
        setAvailableValues((prevAvailable) => {
          const newAvailable = [...prevAvailable];
          newAvailable.splice(index, 1);
          // If the stat slot already had a number, return it to the pool
          if (existingValueInTarget !== null) {
            newAvailable.push(existingValueInTarget);
            newAvailable.sort((a, b) => b - a); // keep pool sorted
          }
          return newAvailable;
        });
      } else if (source === "stat") {
        // Swap values between two stat slots
        newStats[targetStat] = value;
        newStats[sourceStat as StatKey] = existingValueInTarget;
      }
      
      return newStats;
    });
  };

  const handleDropToPool = (e: React.DragEvent) => {
    e.preventDefault();
    const dataString = e.dataTransfer.getData("text/plain");
    if (!dataString) return;
    
    const data = JSON.parse(dataString);
    const { value, source, sourceStat } = data;

    if (source === "stat") {
      setAssignedStats((prev) => ({ ...prev, [sourceStat]: null }));
      setAvailableValues((prev) => {
        const newAvailable = [...prev, value];
        newAvailable.sort((a, b) => b - a);
        return newAvailable;
      });
    }
  };

  const allStatsAssigned = Object.values(assignedStats).every((v) => v !== null);

  const onSubmit = async (data: CharacterFormValues) => {
    if (!hasRolledStats) {
      setSubmitError("Please roll your stats first.");
      return;
    }
    if (!allStatsAssigned) {
      setSubmitError("Please assign all your rolled stats to ability scores.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const characterData: CharacterData = {
      name: data.name,
      race: data.race,
      characterClass: data.characterClass,
      backstory: data.backstory,
      stats: assignedStats as CharacterStats,
      ...(avatar ? { avatar } : {}),
    };

    try {
      const result = await apiFetch<{ session_id: string; character: CharacterData }>("/character", {
        method: "POST",
        body: JSON.stringify(characterData),
      });
      setSessionId(result.session_id);
      setCharacter(result.character);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save character. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="font-display text-xl text-primary animate-pulse">Loading Character...</div>
      </div>
    );
  }

  if (character) {
    return <CharacterSheet character={character} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto pb-10"
    >
      <h1 className="text-3xl font-display text-primary text-gold-glow mb-8 tracking-wider">
        Forge Your Hero
      </h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <CharacterAvatarPicker avatar={avatar} onAvatarChange={setAvatar} label="Character Avatar" />

          {/* Form Fields */}
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-display text-xs uppercase tracking-wider text-primary mb-2 block">Name</label>
                <input
                  {...form.register("name")}
                  className="w-full bg-input border border-gold rounded-sm px-4 py-3 text-foreground font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Thalion Shadowmere"
                />
                {form.formState.errors.name && (
                  <p className="text-destructive text-xs mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="font-display text-xs uppercase tracking-wider text-primary mb-2 block">Race</label>
                <Controller
                  control={form.control}
                  name="race"
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={RACES}
                      placeholder="Select a race"
                    />
                  )}
                />
                {form.formState.errors.race && (
                  <p className="text-destructive text-xs mt-1">{form.formState.errors.race.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="font-display text-xs uppercase tracking-wider text-primary mb-2 block">Class</label>
              <Controller
                control={form.control}
                name="characterClass"
                render={({ field }) => (
                  <CustomSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={CLASSES}
                    placeholder="Select a class"
                  />
                )}
              />
              {form.formState.errors.characterClass && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.characterClass.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="font-display text-xs uppercase tracking-wider text-primary block">Backstory</label>
                <button
                  type="button"
                  onClick={handleGenerateBackstory}
                  disabled={isGeneratingBackstory}
                  className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  {isGeneratingBackstory ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Can't think of anything? Generate for me
                </button>
              </div>
              <textarea
                {...form.register("backstory")}
                className="w-full bg-input border border-gold rounded-sm px-4 py-3 text-foreground font-body placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[120px] resize-none"
                placeholder="Born in the twilight forests..."
                disabled={isGeneratingBackstory}
              />
              {generateBackstoryError && (
                <p className="text-destructive text-xs mt-1">{generateBackstoryError}</p>
              )}
              {form.formState.errors.backstory && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.backstory.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="mt-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-lg text-primary tracking-wider">Ability Scores</h2>
            <button
              type="button"
              onClick={handleRollStats}
              disabled={hasRolledStats}
              className={`flex items-center gap-2 px-4 py-2 border border-gold rounded-sm font-display text-sm tracking-wider transition-colors ${
                hasRolledStats 
                  ? 'opacity-50 cursor-not-allowed bg-black/20 text-muted-foreground border-muted-foreground' 
                  : 'text-gold hover:bg-gold/10'
              }`}
            >
              <Dices className="h-4 w-4" />
              {hasRolledStats ? 'Stats Rolled' : 'Roll Stats'}
            </button>
          </div>
          
          {hasRolledStats && availableValues.length > 0 && (
            <div 
              className="mb-6 p-4 border border-dashed border-gold/50 rounded-sm bg-black/20 min-h-[100px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToPool}
            >
              <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3 text-center">
                Available Rolls (Drag to assign)
              </div>
              <div className="flex gap-4 justify-center flex-wrap">
                {availableValues.map((val, idx) => (
                  <div
                    key={`pool-${idx}-${val}`}
                    draggable
                    onDragStart={(e: React.DragEvent) => e.dataTransfer.setData("text/plain", JSON.stringify({ value: val, source: "pool", index: idx }))}
                    className="w-14 h-14 rounded bg-card border border-gold flex items-center justify-center font-display text-2xl text-primary cursor-grab active:cursor-grabbing hover:bg-gold/10 transition-colors shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                  >
                    {val}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {(Object.keys(assignedStats) as StatKey[]).map((statKey, i) => {
              const statVal = assignedStats[statKey];
              return (
                <motion.div
                  key={statKey}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                >
                  <div
                    className={`stat-card flex flex-col items-center justify-center transition-all min-h-[100px] ${
                      statVal === null ? "border-dashed border-muted-foreground/50 bg-black/10" : ""
                    }`}
                    onDragOver={(e: React.DragEvent) => e.preventDefault()}
                    onDrop={(e: React.DragEvent) => handleDropToStat(e, statKey)}
                  >
                    <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-1">
                      {statKey}
                    </div>

                    {statVal !== null ? (
                      <div
                        draggable
                        onDragStart={(e: React.DragEvent) =>
                          e.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ value: statVal, source: "stat", sourceStat: statKey }),
                          )
                        }
                        className="w-full flex-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/5 rounded"
                      >
                        <div className="font-display text-2xl text-primary text-gold-glow">{statVal}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {statVal >= 10 ? `+${Math.floor((statVal - 10) / 2)}` : Math.floor((statVal - 10) / 2)}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center w-full">
                        <span className="text-muted-foreground/30 text-xs uppercase tracking-wider">Drop</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {hasRolledStats && !allStatsAssigned && (
            <p className="text-amber-500/80 text-xs mt-4 text-center">Assign all rolls to continue.</p>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          {submitError && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <button type="submit" className="btn-fantasy" disabled={!hasRolledStats || !allStatsAssigned || isSubmitting}>
            {isSubmitting ? 'Forging Hero...' : 'Confirm Character'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default CharacterCreation;
