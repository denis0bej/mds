import { useState } from "react";
import { Settings, Moon, Sun, Type, Cpu, Cloud } from "lucide-react";
import { useTheme } from "next-themes";
import { useSettings } from "@/context/SettingsContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SettingsDialog() {
  const { theme, setTheme } = useTheme();
  const { typingSpeed, setTypingSpeed, aiProvider, setAiProvider } = useSettings();
  const [open, setOpen] = useState(false);

  const isDark = theme === "dark";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background border-gold">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary tracking-widest uppercase">
            Game Settings
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-8 py-6">
          {/* AI Provider Switcher */}
          <div className="flex flex-col gap-3">
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
              AI Master Intelligence
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAiProvider("ollama")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 rounded-sm border transition-all",
                  aiProvider === "ollama" 
                    ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(212,175,55,0.1)]" 
                    : "bg-black/20 border-gold/20 text-muted-foreground hover:border-gold/40"
                )}
              >
                <Cpu className="h-4 w-4" />
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-display uppercase tracking-widest leading-none">Local LLM</span>
                  <span className="text-[8px] font-body opacity-60">Llama 3.1 (Ollama)</span>
                </div>
              </button>
              
              <button
                onClick={() => setAiProvider("openai")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 rounded-sm border transition-all",
                  aiProvider === "openai" 
                    ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(212,175,55,0.1)]" 
                    : "bg-black/20 border-gold/20 text-muted-foreground hover:border-gold/40"
                )}
              >
                <Cloud className="h-4 w-4" />
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-display uppercase tracking-widest leading-none">Cloud AI</span>
                  <span className="text-[8px] font-body opacity-60">GPT-4o (OpenAI)</span>
                </div>
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground/60 italic px-1">
              Switching will take effect for the next response or generation.
            </p>
          </div>

          {/* Custom Theme Switcher */}
          <div className="flex flex-col gap-3">
            <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
              Appearance
            </Label>
            <div className="flex items-center justify-between px-2">
               <span className={cn("text-[10px] font-display uppercase tracking-tighter transition-colors", !isDark ? "text-primary" : "text-muted-foreground")}>
                Light
              </span>
              
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className={cn(
                  "relative w-16 h-8 rounded-full transition-all duration-500 overflow-hidden shadow-inner border border-border",
                  isDark ? "bg-slate-900" : "bg-sky-400"
                )}
              >
                {/* Visual effects for backgrounds */}
                {isDark ? (
                  <div className="absolute inset-0">
                    <div className="absolute top-1 left-4 w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
                    <div className="absolute top-4 left-2 w-0.5 h-0.5 bg-white rounded-full animate-pulse delay-75" />
                    <div className="absolute top-2 left-6 w-0.5 h-0.5 bg-white rounded-full animate-pulse delay-150" />
                  </div>
                ) : (
                  <div className="absolute inset-0">
                    <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/20 rounded-full blur-xl" />
                  </div>
                )}
                
                {/* Thumb with icons */}
                <div
                  className={cn(
                    "absolute top-1 w-6 h-6 rounded-full transition-all duration-500 flex items-center justify-center shadow-lg",
                    isDark 
                      ? "left-9 bg-slate-800 text-yellow-200" 
                      : "left-1 bg-white text-orange-500"
                  )}
                >
                  {isDark ? (
                    <Moon className="h-4 w-4 fill-yellow-200" />
                  ) : (
                    <Sun className="h-4 w-4 fill-orange-500" />
                  )}
                </div>
              </button>

              <span className={cn("text-[10px] font-display uppercase tracking-tighter transition-colors", isDark ? "text-primary" : "text-muted-foreground")}>
                Dark
              </span>
            </div>
          </div>

          {/* Typing Speed Slider */}
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <Label className="font-display text-xs uppercase tracking-wider">
                  Typing Speed
                </Label>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {typingSpeed}ms
              </span>
            </div>
            <Slider
              value={[typingSpeed]}
              min={0}
              max={100}
              step={1}
              onValueChange={(vals) => setTypingSpeed(vals[0])}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-display">
              <span>Instant</span>
              <span>Lent</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <Button 
            onClick={() => setOpen(false)}
            className="btn-fantasy py-2 h-auto text-[10px]"
          >
            Salvează Setările
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
