import { useCallback, useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

export type NarrativeMessage = {
  id: string;
  role: "gm" | "player" | "system";
  text: string;
};

type NarrationPanelProps = {
  messages: NarrativeMessage[];
  animateMessageId?: string | null;
  onAnimationComplete?: () => void;
  locationName?: string;
  isLoading?: boolean;
  loadingText?: string;
};

const roleStyles: Record<NarrativeMessage["role"], string> = {
  gm: "border-l-2 border-primary bg-primary/5 pl-4 py-3 rounded-r-sm",
  player: "border-l-2 border-muted-foreground/40 bg-muted/20 pl-4 py-3 rounded-r-sm italic",
  system: "text-muted-foreground text-xs italic text-center py-2",
};

const roleLabels: Record<NarrativeMessage["role"], string | null> = {
  gm: "Dungeon Master",
  player: "You",
  system: null,
};

import { useUIPreferences } from "@/context/UIPreferencesContext";

function TypewriterText({
  text,
  animate,
  onComplete,
  onSkip,
}: {
  text: string;
  animate: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}) {
  const { speedMs } = useUIPreferences();
  const [displayed, setDisplayed] = useState(animate ? "" : text);
  const [isAnimating, setIsAnimating] = useState(animate);
  const indexRef = useRef(0);
  const completedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setDisplayed(text);
    setIsAnimating(false);
    onComplete?.();
  }, [text, onComplete]);

  useEffect(() => {
    completedRef.current = false;
    indexRef.current = 0;

    if (!animate) {
      setDisplayed(text);
      setIsAnimating(false);
      return;
    }

    setDisplayed("");
    setIsAnimating(true);

    const interval = window.setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));

      if (indexRef.current >= text.length) {
        window.clearInterval(interval);
        finish();
      }
    }, speedMs);

    return () => window.clearInterval(interval);
  }, [text, animate, finish, speedMs]);

  return (
    <div className="relative">
      <p className="font-body text-foreground leading-relaxed whitespace-pre-line text-sm">
        {displayed}
        {isAnimating && (
          <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
        )}
      </p>
      {isAnimating && onSkip && (
        <button
          type="button"
          onClick={() => {
            finish();
            onSkip();
          }}
          className="mt-3 flex items-center gap-1.5 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip
        </button>
      )}
    </div>
  );
}

export function NarrationPanel({
  messages,
  animateMessageId,
  onAnimationComplete,
  locationName,
  isLoading,
  loadingText = "The Dungeon Master is setting the scene...",
}: NarrationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="narrative-panel flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-primary tracking-wider">
          {locationName ? locationName : "Adventure"}
        </h2>
        {isLoading && (
          <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">
            Summoning...
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 mb-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <p className="font-body text-sm text-muted-foreground italic text-center py-8">
            No narration yet. Enter a location on the map to begin.
          </p>
        )}

        {messages.map((message) => {
          const label = roleLabels[message.role];
          const shouldAnimate = message.id === animateMessageId && message.role === "gm";

          return (
            <div key={message.id} className={cn(roleStyles[message.role])}>
              {label && (
                <p className="font-display text-[10px] uppercase tracking-widest text-primary/70 mb-2">
                  {label}
                </p>
              )}
              {message.role === "system" ? (
                <p className="font-body text-xs text-muted-foreground italic">{message.text}</p>
              ) : (
                <TypewriterText
                  text={message.text}
                  animate={shouldAnimate}
                  onComplete={shouldAnimate ? onAnimationComplete : undefined}
                  onSkip={shouldAnimate ? onAnimationComplete : undefined}
                />
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className={roleStyles.gm}>
            <p className="font-display text-[10px] uppercase tracking-widest text-primary/70 mb-2">
              Dungeon Master
            </p>
            <p className="font-body text-sm text-muted-foreground italic animate-pulse">
              {loadingText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
