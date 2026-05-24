# DNDAGENTS.md — AI Agent Specification

> Reference document for developers and LLMs. Defines the **roles, boundaries, inputs, outputs, and flow** of the project's two major AI agents, plus the responsibilities of the **Rules Engine** (code, non-AI).

---

## 1. Architecture Principles

### 1.1 The Two AI Agents

| Agent | Phase | Frequency |
|-------|-------|-----------|
| **World Architect** | Adventure preparation | At the start + when generating node content |
| **Dungeon Master** | Game loop | On each active node + on each player input |

Agents may use the **same LLM model** with **different system prompts**. What matters is the separation of **roles**, not necessarily separate technical instances.

### 1.2 What AI Agents Do NOT Do

The following are the responsibility of the **Rules Engine** (Python backend), not the LLM:

- Actual dice generation (`roll_d20()`)
- Applying modifiers from stats (STR, DEX, etc.)
- Comparing the result against DC (Difficulty Class)
- Deterministic game state updates (HP, inventory, map position, flags)
- Validating graph transitions (allowed edges between nodes)

**The LLM does not calculate or invent mechanical results.** It receives pre-calculated results and **narrates** them.

### 1.3 Singleplayer

The game is **singleplayer**. Agents receive a single player character as the protagonist. NPCs, monsters, and obstacles are generated/narrated entities, not characters controlled by other players.

---

## 2. World Architect

### 2.1 Role

World Architect is the **world design** agent. It builds the adventure structure before and during exploration, so the Dungeon Master has coherent, pre-generated or semi-pre-generated content for each location.

**Primary responsibilities:**

1. Generating the adventure **narrative introduction**
2. Generating the **map** as a graph (nodes + edges)
3. Iterating through map nodes and generating the **mechanical and narrative content** of each node

It does **not** handle live dialogue with the player during actions. It does **not** categorize player input. It does **not** run dice rolls.

### 2.2 Execution Phases

#### Phase A — Map Generation (Adventure Setup)

**Trigger:** the user finalizes the adventure description after character creation.

**Input:**

```json
{
  "adventure_description": "string — free text from the player",
  "character": {
    "name": "string",
    "race": "string",
    "characterClass": "string",
    "backstory": "string",
    "stats": { "STR": 0, "DEX": 0, "INT": 0, "WIS": 0, "CON": 0, "CHA": 0 }
  }
}
```

**Output:**

```json
{
  "narrativeIntro": "string — 2-3 paragraphs, epic D&D tone",
  "map": {
    "nodes": [
      {
        "id": "string",
        "name": "string",
        "description": "string — short atmospheric description",
        "status": "current | discovered | hidden",
        "x": 0,
        "y": 0
      }
    ],
    "edges": [
      {
        "from": "string — node id",
        "to": "string — node id",
        "condition": "string — optional, narrative/mechanical condition for traversal"
      }
    ]
  }
}
```

**Constraints:**

- 6–10 nodes
- Start node: `status: "current"`
- 2–3 initially visible nodes: `status: "discovered"`
- Remaining nodes: `status: "hidden"`
- Coordinates for 800×540 canvas: `x` ∈ [100, 700], `y` ∈ [100, 440]
- The map must be **thematically coherent** with the adventure description and character backstory
- Edges must form an **explorable** graph (no completely isolated nodes)

#### Phase B — Node Content Generation (Node Population)

**Trigger:** a node becomes active (the player arrives there) **and** the node does not yet have generated `content`.

**Input:**

```json
{
  "character": { "...": "..." },
  "adventure_description": "string",
  "narrativeIntro": "string",
  "node": {
    "id": "string",
    "name": "string",
    "description": "string"
  },
  "map_context": {
    "visited_node_ids": ["string"],
    "adjacent_node_ids": ["string"]
  }
}
```

**Output — node content:**

```json
{
  "node_id": "string",
  "content": {
    "summary": "string — internal summary for the DM (1-2 sentences)",
    "scene_type": "exploration | trap | combat | social | puzzle | boss | reward | mixed",
    "narrative_seed": "string — detailed atmospheric description for the DM",
    "elements": [
      {
        "type": "trap | monster | npc | item | environmental_hazard | boss | reward | clue",
        "name": "string",
        "description": "string",
        "mechanics": {
          "dc": 0,
          "check_type": "string — e.g. DEX save, Investigation, Stealth",
          "damage": "string — e.g. 2d6 piercing, or null",
          "hp": 0,
          "ac": 0,
          "cr": "string — Challenge Rating, if applicable"
        },
        "rewards": [
          {
            "type": "item | gold | xp | lore | key_item",
            "name": "string",
            "description": "string"
          }
        ]
      }
    ],
    "completion_conditions": [
      "string — clear conditions for considering the node resolved"
    ],
    "failure_consequences": [
      "string — optional, what happens on major failure"
    ]
  }
}
```

**Node content design rules:**

- Each node must have **at least one interactive element** (not just empty text)
- Nodes may combine multiple elements (e.g. trap + reward, monsters + mini-boss, social + clue)
- Difficulty must be **scaled** based on map progress (earlier nodes are simpler)
- Boss / mini-boss: reserved for central nodes or toward the end
- Rewards must be **narratively justified** (chest after a trap, loot after combat, etc.)
- Mechanics (`dc`, `hp`, `damage`) are **suggestions for the Rules Engine**; the DM uses them at runtime, it does not invent them from scratch

**Persistence:** generated content is saved on the node. World Architect **does not regenerate** an already populated node unless an explicit regen mechanism exists (e.g. adventure reset).

---

## 3. Dungeon Master

### 3.1 Role

Dungeon Master is the **runtime** agent. It takes node content (generated by World Architect), turns it into a digestible experience for the player, and manages the action–reaction cycle.

**Primary responsibilities:**

1. **Presenting the encounter** when the player enters a node
2. **Classifying** each player input into one of 3 categories
3. **Narrative response** adapted to the category
4. **Requesting a roll** (via Rules Engine) for complex actions — not executing the roll itself

It does **not** generate the map from scratch. It does **not** populate ungenerated nodes (calls World Architect or waits for content). It does **not** manually calculate d20 results.

### 3.2 Entry Context (Encounter Presentation)

**Trigger:** the player arrives at a node with `content` available.

**Input:**

```json
{
  "character": { "...": "..." },
  "game_state": {
    "current_node_id": "string",
    "hp": 0,
    "inventory": [],
    "active_effects": [],
    "flags": {}
  },
  "node_content": { "...": "structure from World Architect Phase B" },
  "recent_history": [
    { "role": "dm | player", "text": "string" }
  ]
}
```

**Output — encounter presentation:**

```json
{
  "type": "encounter_presentation",
  "narrative": "string — digestible text for the player: scene setting, visible threats, implicit options",
  "visible_elements": ["string — what the player can observe/clarify"],
  "suggested_actions": ["string — optional, 2-4 suggestions without limiting freedom"]
}
```

**Presentation rules:**

- Text must be **concise but evocative** (avoid walls of text)
- Highlight what the player can do **without deciding for them**
- Do not reveal hidden mechanical information (e.g. trap DC) unless the player succeeded a relevant check earlier
- Respect D&D 5e tone: second person or epic perspective

### 3.3 Player Input Classification

On **every** player message, the DM classifies intent into **exactly one** of the categories below.

#### Category 1 — `question`

**Definition:** the player asks for clarifications about the scene, rules, options, or potential consequences. They do **not** perform an action that modifies game state.

**Examples:**

- "Can I slip past the guard?"
- "What do I notice in the room?"
- "Is the trap visible?"
- "What does that symbol mean?"

**DM behavior:**

- Responds informatively, within what the character **could know** (no metagaming)
- Does **not** trigger a dice roll
- Does **not** modify HP, inventory, or position
- May reveal hints if the character has relevant abilities (e.g. Darkvision) — no roll if it is a trivial passive observation

**Output:**

```json
{
  "category": "question",
  "narrative": "string",
  "state_changes": null
}
```

#### Category 2 — `simple_action`

**Definition:** the player performs an action that **does not require an ability check or saving throw** per D&D 5e, or the action automatically succeeds in the scene context.

**Rules reference (D&D 5e — indicative):**

- Normal movement in a safe area
- Consuming a potion (if item rules do not require a check)
- Trivial interactions: opening an unlocked door, picking up an uncontested object
- Passive exploration actions under favorable conditions
- Uncontested dialogue without social stakes (small talk)

**Examples:**

- "I drink the healing potion."
- "I open the door." (if not locked/trapped)
- "I take the torch from the wall."
- "I walk toward the altar." (with no active obstacle)

**DM behavior:**

- Describes the action outcome
- Proposes structured `state_changes` for the Rules Engine
- Does **not** call `roll_d20`

**Output:**

```json
{
  "category": "simple_action",
  "narrative": "string",
  "state_changes": {
    "hp_delta": 0,
    "inventory_add": [],
    "inventory_remove": [],
    "flags_set": {},
    "flags_unset": [],
    "node_status": null
  }
}
```

#### Category 3 — `complex_action`

**Definition:** the player attempts something with **mechanical stakes** — failure or success significantly affects game state. Requires an **ability check, saving throw, or attack roll**.

**Rules reference (D&D 5e — indicative):**

- Attacks, theft, contested social escalation (Persuasion/Deception/Intimidation)
- Perception/Investigation to detect hidden traps
- Stealth to pass unnoticed
- Saving throws (TRAP, poison, spells)
- Acrobatics/Athletics for risky physical actions
- Any action where the DM evaluates there is a **reasonable chance of failure**

**Mandatory flow:**

```
1. DM classifies the action as complex_action
2. DM specifies check type and proposed DC
3. Rules Engine executes roll_d20() + modifiers
4. Rules Engine returns mechanical result
5. DM generates final narrative based on the result
6. Rules Engine applies state_changes
```

**Output — step 1 (roll request):**

```json
{
  "category": "complex_action",
  "phase": "roll_requested",
  "check": {
    "type": "ability_check | saving_throw | attack_roll",
    "ability": "STR | DEX | CON | INT | WIS | CHA",
    "skill": "string — optional, e.g. Stealth, Perception",
    "dc": 0,
    "reason": "string — short, for UI"
  },
  "narrative": "string — optional, setup before roll"
}
```

**Input — step 2 (after roll, from Rules Engine):**

```json
{
  "roll_result": {
    "d20": 0,
    "modifier": 0,
    "total": 0,
    "dc": 0,
    "outcome": "critical_fail | fail | partial | success | critical_success"
  },
  "player_action": "string",
  "context": { "...": "same context as classification" }
}
```

**Output — step 2 (outcome narrative):**

```json
{
  "category": "complex_action",
  "phase": "roll_resolved",
  "narrative": "string",
  "state_changes": {
    "hp_delta": 0,
    "inventory_add": [],
    "inventory_remove": [],
    "flags_set": {},
    "node_complete": false
  }
}
```

**Outcome → narrative mapping (aligned with project README):**

| Outcome | Total vs DC | Narrative effect |
|---------|-------------|------------------|
| `critical_fail` | natural 1 | Catastrophic failure, severe consequences |
| `fail` | total < DC | Failure, no progress or with cost |
| `partial` | total ≈ DC or marginal success | Success with compromise |
| `success` | total ≥ DC | Clear success |
| `critical_success` | natural 20 | Exceptional success, narrative bonus |

---

## 4. Rules Engine (non-AI)

Mandatory backend component. Mediates between agents and game state.

### 4.1 Exposed Functions

| Function | Description |
|----------|-------------|
| `roll_d20(modifier)` | Returns `{ d20, modifier, total }` |
| `resolve_check(total, dc)` | Returns `outcome` per the table above |
| `apply_state_changes(changes, game_state)` | Applies HP delta, inventory, flags |
| `validate_node_transition(from, to, map)` | Validates edge on graph |
| `get_modifier(character, ability, skill)` | Calculates modifier from stats + proficiency (if applicable) |

### 4.2 Contract

- Only the Rules Engine **calls** `roll_d20`
- The DM **requests** a roll via JSON (`phase: roll_requested`)
- Backend executes the roll, re-invokes the DM with the result
- The DM is **not** allowed to generate numeric roll values in the final output

---

## 5. End-to-End Flow

```
[Character Creation]
        │
        ▼
[Adventure Setup — adventure description]
        │
        ▼
┌─────────────────────────┐
│  WORLD ARCHITECT        │
│  Phase A: map + intro   │
└─────────────────────────┘
        │
        ▼
[Map View — player navigates]
        │
        ▼ (arrives at node without content)
┌─────────────────────────┐
│  WORLD ARCHITECT        │
│  Phase B: node content  │
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│  DUNGEON MASTER         │
│  Encounter presentation │
└─────────────────────────┘
        │
        ▼
    ┌─────── loop ───────┐
    │  Player input      │
    │        │           │
    │        ▼           │
    │  DM classifies     │
    │   ├─ question      │──► narrative response
    │   ├─ simple_action │──► response + state_changes
    │   └─ complex_action│──► roll_requested
    │            │       │
    │            ▼       │
    │     Rules Engine   │
    │       roll_d20     │
    │            │       │
    │            ▼       │
    │  DM narrates       │
    │   + state_changes  │
    └────────────────────┘
        │
        ▼ (node complete / adventure end)
[Adventure Summary — generated by DM or dedicated agent, future]
```

---

## 6. API Interfaces (indicative)

| Endpoint | Agent | Description |
|----------|-------|-------------|
| `POST /adventure/generate` | World Architect (Phase A) | Intro + map |
| `POST /adventure/node/{id}/populate` | World Architect (Phase B) | Node content |
| `POST /game/enter-node` | Dungeon Master | Encounter presentation |
| `POST /game/action` | Dungeon Master | Classification + response |
| `POST /game/resolve-roll` | Dungeon Master + Rules Engine | After d20 roll |

---

## 7. Quality Criteria

### World Architect

- Thematic coherence between nodes, intro, and backstory
- Variation in encounter types (not all nodes = combat)
- **Realistic** suggested mechanics for D&D 5e (DC 10–20 for most checks)
- Each node has a clear progression purpose

### Dungeon Master

- **Correct and consistent** action classification
- Does not request a roll when the action is trivial
- Does not allow impossible actions without consequences (complex_action)
- Clear narrative, no mechanical jargon exposed to the player (DC, modifier) unless diegetically relevant
- Respects node content — does not invent monsters/rewards absent from `node_content`

---

## 8. Future Evolution (out of scope for MVP)

- **Chronicler Agent** — final adventure summary, long-term consistency
- Dynamic regeneration of failed nodes
- Multi-step combat initiative tracker (still with Rules Engine for order and damage)
- Save system integration (Supabase) — persist map, node content, game state, action history

---

## 9. Internal References

- `readme.md` — project overview, simplified d20 rules
- `backend/routers/game.py` — partial World Architect implementation (Phase A)
- `frontend/src/context/GameContext.tsx` — frontend state (character, map, narrativeIntro)
