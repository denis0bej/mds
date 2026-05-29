import type { NarrativeMessage } from "@/components/NarrationPanel";
import type { StateChanges } from "@/lib/gameState";

export type SessionEventType =
  | "action"
  | "narrative"
  | "roll"
  | "travel"
  | "system"
  | "state";

export type SessionEvent = {
  id: string;
  type: SessionEventType;
  timestamp: number;
  text: string;
  location?: string;
  meta?: {
    d20?: number;
    total?: number;
    dc?: number;
    outcome?: string;
    hpDelta?: number;
  };
};

export const EVENT_LOG_VISIBLE_KEY = "dnd_event_log_visible";

export const eventTypeConfig: Record<
  SessionEventType,
  { label: string; className: string; dotClassName: string }
> = {
  action: {
    label: "Action",
    className: "border-sky-500/40 bg-sky-950/20",
    dotClassName: "bg-sky-400",
  },
  narrative: {
    label: "Narrative",
    className: "border-primary/40 bg-primary/5",
    dotClassName: "bg-primary",
  },
  roll: {
    label: "Roll",
    className: "border-amber-500/40 bg-amber-950/25",
    dotClassName: "bg-amber-400",
  },
  travel: {
    label: "Travel",
    className: "border-emerald-500/40 bg-emerald-950/20",
    dotClassName: "bg-emerald-400",
  },
  system: {
    label: "System",
    className: "border-muted-foreground/30 bg-muted/20",
    dotClassName: "bg-muted-foreground",
  },
  state: {
    label: "State",
    className: "border-violet-500/40 bg-violet-950/20",
    dotClassName: "bg-violet-400",
  },
};

export function createSessionEvent(
  type: SessionEventType,
  text: string,
  options?: { location?: string; meta?: SessionEvent["meta"]; id?: string },
): SessionEvent {
  return {
    id: options?.id ?? `evt-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    timestamp: Date.now(),
    text,
    location: options?.location,
    meta: options?.meta,
  };
}

export function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatEventMeta(meta: SessionEvent["meta"]): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.d20 != null) parts.push(`d20: ${meta.d20}`);
  if (meta.total != null) parts.push(`total: ${meta.total}`);
  if (meta.dc != null) parts.push(`DC ${meta.dc}`);
  if (meta.outcome) parts.push(meta.outcome);
  if (meta.hpDelta != null && meta.hpDelta !== 0) {
    parts.push(`HP ${meta.hpDelta > 0 ? "+" : ""}${meta.hpDelta}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatStateChangeSummary(changes: StateChanges): string | null {
  const parts: string[] = [];

  if (changes.hp_delta) {
    const sign = changes.hp_delta > 0 ? "+" : "";
    parts.push(`HP ${sign}${changes.hp_delta}`);
  }
  if (changes.inventory_add?.length) {
    parts.push(`+ ${changes.inventory_add.map((i) => (typeof i === "string" ? i : i.name)).join(", ")}`);
  }
  if (changes.inventory_remove?.length) {
    parts.push(`− ${changes.inventory_remove.join(", ")}`);
  }
  if (changes.status_effects_add?.length) {
    parts.push(
      `Effect + ${changes.status_effects_add.map((e) => (typeof e === "string" ? e : e.name)).join(", ")}`,
    );
  }
  if (changes.status_effects_remove?.length) {
    parts.push(`Effect − ${changes.status_effects_remove.join(", ")}`);
  }
  if (changes.node_complete) {
    parts.push("Location objective complete");
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function backfillEventsFromHistory(history: NarrativeMessage[]): SessionEvent[] {
  const base = Date.now() - history.length * 60_000;
  return history.map((message, index) => {
    let type: SessionEventType = "system";
    if (message.role === "player") type = "action";
    else if (message.role === "gm") type = "narrative";

    return {
      id: message.id,
      type,
      timestamp: base + index * 60_000,
      text: message.text,
    };
  });
}

export function loadEventLogVisible(): boolean {
  try {
    const raw = localStorage.getItem(EVENT_LOG_VISIBLE_KEY);
    return raw === null ? false : raw === "true";
  } catch {
    return false;
  }
}

export function saveEventLogVisible(visible: boolean) {
  localStorage.setItem(EVENT_LOG_VISIBLE_KEY, String(visible));
}
