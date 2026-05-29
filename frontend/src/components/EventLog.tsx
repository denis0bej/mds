import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import type { SessionEvent } from "@/lib/sessionEvents";
import { eventTypeConfig, formatEventTime } from "@/lib/sessionEvents";
import { cn } from "@/lib/utils";

type EventLogProps = {
  events: SessionEvent[];
  visible: boolean;
  minimized: boolean;
  onToggleVisible: () => void;
  onToggleMinimized: () => void;
};

export function EventLog({
  events,
  visible,
  minimized,
  onToggleVisible,
  onToggleMinimized,
}: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || minimized || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events.length, visible, minimized]);

  if (!visible) {
    return (
      <button
        type="button"
        onClick={onToggleVisible}
        className="mt-3 flex items-center gap-2 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
      >
        <ScrollText className="h-3.5 w-3.5" />
        Show session log ({events.length})
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 border border-gold/30 rounded-sm bg-card/80 overflow-hidden flex flex-col"
      style={{ maxHeight: minimized ? undefined : "220px" }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gold/20 bg-card/90 shrink-0">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-[10px] uppercase tracking-wider text-primary">
            Session Log
          </span>
          <span className="text-[10px] text-muted-foreground">({events.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMinimized}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={minimized ? "Expand log" : "Minimize log"}
          >
            {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onToggleVisible}
            className="px-2 py-0.5 text-[10px] font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Hide
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!minimized && (
          <motion.div
            key="log-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            ref={scrollRef}
            className="overflow-y-auto px-2 py-2 space-y-1.5 flex-1 min-h-0"
            style={{ maxHeight: "180px" }}
          >
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4 font-body">
                Events will appear here as you play.
              </p>
            ) : (
              events.map((event) => {
                const config = eventTypeConfig[event.type];
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-sm border px-2.5 py-2 text-xs font-body",
                      config.className,
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotClassName)} />
                      <span className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                        {config.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground/70 ml-auto tabular-nums">
                        {formatEventTime(event.timestamp)}
                      </span>
                    </div>
                    {event.location && (
                      <p className="text-[9px] text-muted-foreground/80 mb-0.5 truncate">
                        @ {event.location}
                      </p>
                    )}
                    <p className="text-foreground/90 leading-relaxed line-clamp-4">{event.text}</p>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
