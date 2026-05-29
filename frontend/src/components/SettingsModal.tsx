import { Settings, Moon, Sun, Type } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useUIPreferences, TypewriterSpeed } from "@/context/UIPreferencesContext";
import { Label } from "@/components/ui/label";

export function SettingsModal() {
  const { theme, setTheme, typewriterSpeed, setTypewriterSpeed } = useUIPreferences();

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  const speedToValue = (speed: TypewriterSpeed): number => {
    if (speed === "slow") return 0;
    if (speed === "normal") return 1;
    return 2;
  };

  const valueToSpeed = (value: number): TypewriterSpeed => {
    if (value === 0) return "slow";
    if (value === 1) return "normal";
    return "fast";
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
          <span className="text-sm font-display uppercase tracking-wider">Settings</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-gold">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary tracking-widest uppercase">
            UI Preferences
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-primary" />
              ) : (
                <Sun className="h-4 w-4 text-primary" />
              )}
              <Label htmlFor="theme-mode" className="font-display text-sm uppercase tracking-wider">
                Dark Mode
              </Label>
            </div>
            <Switch
              id="theme-mode"
              checked={theme === "dark"}
              onCheckedChange={handleThemeChange}
            />
          </div>

          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              <Label className="font-display text-sm uppercase tracking-wider">
                Typewriter Speed
              </Label>
            </div>
            <div className="px-2">
              <Slider
                defaultValue={[speedToValue(typewriterSpeed)]}
                max={2}
                step={1}
                onValueChange={(vals) => setTypewriterSpeed(valueToSpeed(vals[0]))}
                className="my-4"
              />
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground font-display">
                <span className={typewriterSpeed === "slow" ? "text-primary font-bold" : ""}>Slow</span>
                <span className={typewriterSpeed === "normal" ? "text-primary font-bold" : ""}>Normal</span>
                <span className={typewriterSpeed === "fast" ? "text-primary font-bold" : ""}>Fast</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
