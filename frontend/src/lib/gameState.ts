import type { CharacterData } from "@/context/GameContext";

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export type StatusEffect = {
  id: string;
  name: string;
  description: string;
  type: "buff" | "debuff";
};

export type GameRuntimeState = {
  hp: number;
  maxHp: number;
  ac: number;
  level: number;
  inventory: InventoryItem[];
  statusEffects: StatusEffect[];
  flags: Record<string, boolean>;
};

export type StateChanges = {
  hp_delta?: number;
  inventory_add?: Array<string | Partial<InventoryItem>>;
  inventory_remove?: string[];
  status_effects_add?: Array<string | Partial<StatusEffect>>;
  status_effects_remove?: string[];
  flags_set?: Record<string, boolean>;
  flags_unset?: string[];
  node_complete?: boolean;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getAbilityModifier(stats: CharacterData["stats"], ability: keyof CharacterData["stats"]): number {
  return Math.floor((stats[ability] - 10) / 2);
}

export function createInitialRuntimeState(character: CharacterData): GameRuntimeState {
  const conMod = getAbilityModifier(character.stats, "CON");
  const dexMod = getAbilityModifier(character.stats, "DEX");
  const level = 5;
  const maxHp = Math.max(1, 10 + (level - 1) * (6 + conMod) + conMod);
  const ac = 10 + dexMod + 2;

  const race = character.race.toLowerCase();
  const statusEffects: StatusEffect[] = [];
  if (race.includes("elf") || race.includes("drow") || race.includes("dwarf")) {
    statusEffects.push({
      id: "darkvision",
      name: "Darkvision",
      description: "You can see in dim light within 60 feet.",
      type: "buff",
    });
  }

  return {
    hp: maxHp,
    maxHp,
    ac,
    level,
    inventory: [
      {
        id: "travelers-blade",
        name: "Traveler's Blade",
        description: "A worn but reliable sword.",
        icon: "sword",
      },
      {
        id: "healing-potion",
        name: "Healing Potion",
        description: "Restores 2d4+2 HP when consumed.",
        icon: "heart",
      },
    ],
    statusEffects,
    flags: {},
  };
}

function normalizeInventoryItem(item: string | Partial<InventoryItem>): InventoryItem {
  if (typeof item === "string") {
    return {
      id: slugify(item),
      name: item,
      description: "",
      icon: "package",
    };
  }
  const name = item.name ?? "Item";
  return {
    id: item.id ?? slugify(name),
    name,
    description: item.description ?? "",
    icon: item.icon ?? "package",
  };
}

function normalizeStatusEffect(effect: string | Partial<StatusEffect>): StatusEffect {
  if (typeof effect === "string") {
    return {
      id: slugify(effect),
      name: effect,
      description: "",
      type: "buff",
    };
  }
  const name = effect.name ?? "Effect";
  return {
    id: effect.id ?? slugify(name),
    name,
    description: effect.description ?? "",
    type: effect.type === "debuff" ? "debuff" : "buff",
  };
}

export function normalizeRuntimeState(raw: Record<string, unknown>): GameRuntimeState {
  return {
    hp: Number(raw.hp ?? 0),
    maxHp: Number(raw.max_hp ?? raw.maxHp ?? 1),
    ac: Number(raw.ac ?? 10),
    level: Number(raw.level ?? 1),
    inventory: Array.isArray(raw.inventory)
      ? raw.inventory.map((item) => normalizeInventoryItem(item as string | Partial<InventoryItem>))
      : [],
    statusEffects: Array.isArray(raw.status_effects)
      ? raw.status_effects.map((effect) =>
          normalizeStatusEffect(effect as string | Partial<StatusEffect>),
        )
      : Array.isArray(raw.statusEffects)
        ? raw.statusEffects.map((effect) =>
            normalizeStatusEffect(effect as string | Partial<StatusEffect>),
          )
        : [],
    flags: (raw.flags as Record<string, boolean>) ?? {},
  };
}

export function runtimeStateToApi(state: GameRuntimeState): Record<string, unknown> {
  return {
    hp: state.hp,
    max_hp: state.maxHp,
    ac: state.ac,
    level: state.level,
    inventory: state.inventory,
    status_effects: state.statusEffects,
    flags: state.flags,
  };
}

const CONSUME_VERBS = /\b(drink|consume|use|quaff|swig|gulp|imbibe|down)\b/i;
const DROP_VERBS = /\b(drop|discard|throw away|leave behind|toss)\b/i;
const DEBUFF_KEYWORDS = new Set([
  "burning",
  "poisoned",
  "bleeding",
  "stunned",
  "frightened",
  "cursed",
  "paralyzed",
  "blinded",
]);

function emptyStateChanges(): StateChanges {
  return {
    hp_delta: 0,
    inventory_add: [],
    inventory_remove: [],
    status_effects_add: [],
    status_effects_remove: [],
    flags_set: {},
    flags_unset: [],
    node_complete: false,
  };
}

function coerceStateChanges(changes?: StateChanges | null): StateChanges {
  const base = emptyStateChanges();
  if (!changes) return base;
  return {
    ...base,
    ...changes,
    inventory_add: changes.inventory_add ?? [],
    inventory_remove: changes.inventory_remove ?? [],
    status_effects_add: changes.status_effects_add ?? [],
    status_effects_remove: changes.status_effects_remove ?? [],
    flags_set: changes.flags_set ?? {},
    flags_unset: changes.flags_unset ?? [],
  };
}

function findInventoryItem(inventory: InventoryItem[], ...needles: string[]): InventoryItem | null {
  for (const item of inventory) {
    const name = item.name.toLowerCase();
    const id = item.id.toLowerCase();
    for (const needle of needles) {
      const n = needle.toLowerCase();
      if (name.includes(n) || id.includes(n) || n.includes(name)) return item;
    }
  }
  return null;
}

function removeListIncludes(removes: Array<string | Partial<InventoryItem>>, item: InventoryItem): boolean {
  return removes.some((raw) => {
    const token = typeof raw === "string" ? raw.toLowerCase() : (raw.name ?? raw.id ?? "").toLowerCase();
    return (
      token === item.name.toLowerCase() ||
      token === item.id ||
      item.name.toLowerCase().includes(token) ||
      slugify(token) === item.id
    );
  });
}

function collectRemoveTokens(removes: Array<string | Partial<InventoryItem>> | string[]): Set<string> {
  const tokens = new Set<string>();
  for (const raw of removes) {
    if (typeof raw === "string") {
      tokens.add(raw.toLowerCase());
      tokens.add(slugify(raw));
    } else {
      if (raw.id) {
        tokens.add(raw.id.toLowerCase());
        tokens.add(slugify(raw.id));
      }
      if (raw.name) {
        tokens.add(raw.name.toLowerCase());
        tokens.add(slugify(raw.name));
      }
    }
  }
  return tokens;
}

function shouldRemoveItem(item: { id: string; name: string }, tokens: Set<string>): boolean {
  const name = item.name.toLowerCase();
  for (const token of tokens) {
    if (token === item.id || token === name) return true;
    if (name.includes(token) || token.includes(name)) return true;
    if (slugify(token) === item.id) return true;
  }
  return false;
}

function roll2d4Plus2(): number {
  const d4 = () => Math.floor(Math.random() * 4) + 1;
  return d4() + d4() + 2;
}

export function reconcileStateChanges(
  action: string,
  state: GameRuntimeState,
  dmChanges?: StateChanges | null,
): StateChanges {
  const changes = coerceStateChanges(dmChanges);
  const actionLower = action.toLowerCase();

  if (CONSUME_VERBS.test(action) && actionLower.includes("potion")) {
    const potion = findInventoryItem(state.inventory, "healing potion", "healing-potion", "potion");
    if (potion) {
      const removes = [...(changes.inventory_remove ?? [])];
      if (!removeListIncludes(removes, potion)) removes.push(potion.name);
      changes.inventory_remove = removes;
      if ((changes.hp_delta ?? 0) <= 0) {
        changes.hp_delta = roll2d4Plus2();
      }
    }
  }

  if (DROP_VERBS.test(action)) {
    for (const item of state.inventory) {
      const name = item.name.toLowerCase();
      if (actionLower.includes(name) || actionLower.includes(item.id.replace(/-/g, " "))) {
        const removes = [...(changes.inventory_remove ?? [])];
        if (!removeListIncludes(removes, item)) removes.push(item.name);
        changes.inventory_remove = removes;
        break;
      }
    }
  }

  return changes;
}

export function applyStateChanges(
  state: GameRuntimeState,
  changes?: StateChanges | null,
): GameRuntimeState {
  if (!changes) return state;

  const next: GameRuntimeState = {
    ...state,
    inventory: [...state.inventory],
    statusEffects: [...state.statusEffects],
    flags: { ...state.flags },
  };

  const hpDelta = changes.hp_delta ?? 0;
  if (hpDelta !== 0) {
    next.hp = Math.max(0, Math.min(next.maxHp, next.hp + hpDelta));
  }

  const existingIds = new Set(next.inventory.map((i) => i.id));
  const existingNames = new Set(next.inventory.map((i) => i.name.toLowerCase()));
  for (const raw of changes.inventory_add ?? []) {
    const item = normalizeInventoryItem(raw);
    if (existingIds.has(item.id) || existingNames.has(item.name.toLowerCase())) continue;
    next.inventory.push(item);
    existingIds.add(item.id);
    existingNames.add(item.name.toLowerCase());
  }

  const removeTokens = collectRemoveTokens(changes.inventory_remove ?? []);
  next.inventory = next.inventory.filter((item) => !shouldRemoveItem(item, removeTokens));

  const effectIds = new Set(next.statusEffects.map((e) => e.id));
  const effectNames = new Set(next.statusEffects.map((e) => e.name.toLowerCase()));
  for (const raw of changes.status_effects_add ?? []) {
    const effect = normalizeStatusEffect(raw);
    if (DEBUFF_KEYWORDS.has(effect.id) || DEBUFF_KEYWORDS.has(effect.name.toLowerCase())) {
      effect.type = "debuff";
    }
    if (effectIds.has(effect.id) || effectNames.has(effect.name.toLowerCase())) continue;
    next.statusEffects.push(effect);
    effectIds.add(effect.id);
    effectNames.add(effect.name.toLowerCase());
  }

  const removeEffectTokens = collectRemoveTokens(changes.status_effects_remove ?? []);
  next.statusEffects = next.statusEffects.filter(
    (effect) => !shouldRemoveItem(effect, removeEffectTokens),
  );

  next.flags = { ...next.flags, ...(changes.flags_set ?? {}) };
  for (const key of changes.flags_unset ?? []) {
    delete next.flags[key];
  }

  return next;
}

export function resolveRuntimeStateAfterAction(
  action: string,
  currentState: GameRuntimeState,
  result: { game_state?: Record<string, unknown>; state_changes?: StateChanges | null },
): GameRuntimeState {
  if (result.game_state) {
    return normalizeRuntimeState(result.game_state);
  }
  const merged = reconcileStateChanges(action, currentState, result.state_changes);
  return applyStateChanges(currentState, merged);
}
