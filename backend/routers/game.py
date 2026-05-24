from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import openai
from openai import OpenAI
import os
import uuid
import json
import httpx
from dotenv import load_dotenv
from rules_engine import (
    roll_d20,
    resolve_outcome,
    get_ability_modifier,
    create_initial_game_state,
    apply_state_changes,
    reconcile_state_changes,
)

load_dotenv()
router = APIRouter()

_openai_client: Optional[OpenAI] = None


def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="OPENAI_API_KEY is not configured. Add it to backend/.env for AI features.",
            )
        _openai_client = OpenAI(api_key=api_key, timeout=60.0)
    return _openai_client

# Asigurăm existența folderului pentru sesiuni
os.makedirs("data", exist_ok=True)

class CharacterData(BaseModel):
    name: str
    race: str
    characterClass: str
    backstory: str
    stats: dict

class AdventureRequest(BaseModel):
    description: str
    session_id: Optional[str] = None
    character: Optional[dict] = None

class ActionRequest(BaseModel):
    action: str
    state: dict

class HistoryMessage(BaseModel):
    role: str
    text: str

class EnterNodeRequest(BaseModel):
    character: dict
    node: dict
    narrative_intro: Optional[str] = None
    adventure_description: Optional[str] = None
    recent_history: Optional[List[HistoryMessage]] = []
    game_state: Optional[dict] = None

class GameActionRequest(BaseModel):
    action: str
    character: dict
    node: dict
    narrative_intro: Optional[str] = None
    adventure_description: Optional[str] = None
    recent_history: Optional[List[HistoryMessage]] = []
    game_state: Optional[dict] = None


def _format_history(recent_history: Optional[List[HistoryMessage]]) -> str:
    if not recent_history:
        return ""
    return "\n".join(
        f"{msg.role.upper()}: {msg.text}" for msg in recent_history[-10:]
    )


def _build_action_user_content(req: GameActionRequest) -> str:
    user_content = f"""Player action: {req.action}

Current location:
{json.dumps(req.node, indent=2)}

Character:
{json.dumps(req.character, indent=2)}"""

    if req.adventure_description:
        user_content += f"\n\nAdventure concept:\n{req.adventure_description}"
    if req.narrative_intro:
        user_content += f"\n\nAdventure introduction (context only):\n{req.narrative_intro}"
    history_text = _format_history(req.recent_history)
    if history_text:
        user_content += f"\n\nRecent history:\n{history_text}"
    if req.game_state:
        user_content += f"\n\nGame state:\n{json.dumps(req.game_state, indent=2)}"
    return user_content


DM_ACTION_SYSTEM_PROMPT = """You are the Dungeon Master for a single-player D&D 5e adventure.

Classify the player's input into EXACTLY ONE category and respond with valid JSON only.

Categories:
1. "question" — player asks for clarification; no game state change; no dice roll.
2. "simple_action" — player does something that succeeds without a roll (D&D 5e trivial actions).
3. "complex_action" — player attempts something risky/contested; requires a dice roll.

For "question":
{
  "category": "question",
  "narrative": "informative answer in second person"
}

For "simple_action":
{
  "category": "simple_action",
  "narrative": "describe what happens",
  "state_changes": {
    "hp_delta": 0,
    "inventory_add": [],
    "inventory_remove": [],
    "status_effects_add": [],
    "status_effects_remove": [],
    "flags_set": {},
    "flags_unset": [],
    "node_complete": false
  }
}

For "complex_action" (roll NOT yet resolved — propose the check only):
{
  "category": "complex_action",
  "phase": "roll_requested",
  "check": {
    "type": "ability_check",
    "dice": "D20",
    "ability": "DEX",
    "skill": "Stealth",
    "dc": 14,
    "reason": "short label for UI"
  },
  "narrative": "optional brief setup before the roll"
}

Rules:
- Write in English, second person, evocative but concise.
- Respect the current location and recent history.
- Do NOT invent numeric dice results.
- Use complex_action when failure would matter mechanically or narratively.
- Use question for "what do I see?", "can I...?", "what are my options?"
- Mark node_complete true in state_changes only when the player clearly finishes the location's main challenge.
- ALWAYS populate state_changes for simple_action and roll_resolved complex_action when HP, inventory, or effects change.
- When the player CONSUMES an item (drink potion, use scroll): MUST set inventory_remove with the exact item name from game_state inventory AND hp_delta if it heals or damages.
- When the player PICKS UP an item: MUST set inventory_add with { "name", "description", "icon" }.
- When the player DROPS an item: MUST set inventory_remove with the item name.
- Example — "I drink the healing potion" with Healing Potion in inventory:
  { "hp_delta": 9, "inventory_remove": ["Healing Potion"], "inventory_add": [], "status_effects_add": [], "status_effects_remove": [] }
- Use status_effects_add / status_effects_remove for buffs and debuffs (e.g. Burning, Blessed). Debuffs use type "debuff".

When resolving a roll (you will receive roll_result), respond with:
{
  "category": "complex_action",
  "phase": "roll_resolved",
  "narrative": "describe outcome based on roll_result",
  "state_changes": {
    "hp_delta": 0,
    "inventory_add": [],
    "inventory_remove": [],
    "status_effects_add": [],
    "status_effects_remove": [],
    "flags_set": {},
    "flags_unset": [],
    "node_complete": false
  }
}"""


def _extract_runtime_state(req: GameActionRequest) -> dict:
    game_state = req.game_state or {}
    runtime = {
        "hp": game_state.get("hp"),
        "max_hp": game_state.get("max_hp"),
        "ac": game_state.get("ac"),
        "level": game_state.get("level"),
        "inventory": game_state.get("inventory"),
        "status_effects": game_state.get("status_effects"),
        "flags": game_state.get("flags"),
    }
    if runtime["hp"] is None:
        return create_initial_game_state(req.character)
    return {
        "hp": int(runtime["hp"]),
        "max_hp": int(runtime.get("max_hp") or runtime["hp"]),
        "ac": int(runtime.get("ac") or 10),
        "level": int(runtime.get("level") or 1),
        "inventory": runtime.get("inventory") or [],
        "status_effects": runtime.get("status_effects") or [],
        "flags": runtime.get("flags") or {},
    }


def _finalize_action_result(result: dict, runtime_state: dict, player_action: str) -> dict:
    category = result.get("category")
    phase = result.get("phase")
    should_apply = category in ("simple_action", "complex_action") and phase != "roll_requested"

    if should_apply:
        merged_changes = reconcile_state_changes(
            player_action,
            runtime_state,
            result.get("state_changes"),
        )
        updated_state = apply_state_changes(merged_changes, runtime_state)
        return {
            **result,
            "state_changes": merged_changes,
            "game_state": updated_state,
        }

    return {
        **result,
        "game_state": runtime_state,
    }

@router.post("/character")
async def save_character(char: CharacterData):
    session_id = str(uuid.uuid4())
    file_path = f"data/{session_id}.json"
    with open(file_path, "w") as f:
        json.dump(char.dict(), f)
    return {"session_id": session_id, "character": char.dict()}

@router.get("/character/{session_id}")
async def get_character(session_id: str):
    file_path = f"data/{session_id}.json"
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            data = json.load(f)
        return {"character": data}
    raise HTTPException(status_code=404, detail="Session not found")

@router.post("/adventure/generate")
async def generate_adventure(req: AdventureRequest):
    character_context = None
    used_session_id = req.session_id

    if req.session_id:
        file_path = f"data/{req.session_id}.json"
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                character_context = json.load(f)
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    elif req.character:
        character_context = req.character
    
    system_prompt = """Ești "World Architect" — agentul de design al aventurii D&D.
Misiunea ta: generezi introducerea narativă și o hartă detaliată a aventurii. Fiecare nod al hărții TREBUIE să conțină un eveniment concret (capcană, monstru, NPC, puzzle, comoară etc.).

Răspunde EXCLUSIV cu un obiect JSON valid, fără markdown, fără text suplimentar.

STRUCTURA OBLIGATORIE a răspunsului (respectă EXACT această schemă de nivel superior):
{
  "narrativeIntro": "2-3 paragrafe de introducere epică",
  "map": {
    "nodes": [ <lista de noduri — vezi formatul de nod mai jos> ],
    "edges": [
      { "from": "1", "to": "2", "condition": "opțional" }
    ]
  }
}

FORMATUL UNUI NOD (FIECARE nod din lista nodes TREBUIE să arate astfel):
{
  "id": "1",
  "name": "Nume locație",
  "description": "Scurtă descriere atmosferică afișată în UI (1-2 propoziții).",
  "status": "current",
  "isGoal": false,
  "x": 150,
  "y": 100,
  "content": {
    "summary": "Ce se întâmplă aici, miza scenei (1-2 propoziții).",
    "scene_type": "exploration",
    "narrative_seed": "Descriere atmosferică detaliată pentru DM (3-5 propoziții): sunete, mirosuri, indicii vizuale, pericole.",
    "elements": [
      {
        "type": "trap",
        "name": "Placa de presiune",
        "description": "O dală ascunsă declanșează săgeți din pereți.",
        "mechanics": { "dc": 13, "check_type": "DEX save", "damage": "2d6 piercing", "hp": 0, "ac": 0, "cr": null },
        "rewards": []
      },
      {
        "type": "monster",
        "name": "Schelet-Gardian",
        "description": "Un schelet trezit de profanare.",
        "mechanics": { "dc": 0, "check_type": "Attack Roll", "damage": "1d6+2 slashing", "hp": 13, "ac": 13, "cr": "1/4" },
        "rewards": [{ "type": "gold", "name": "10 aur", "description": "Loot de la gardian." }]
      }
    ],
    "completion_conditions": ["A învins gardianul"],
    "failure_consequences": ["Pierde 1d4 HP din otravă"]
  }
}

REGULI PENTRU HARTĂ:
- Generează exact 5-8 noduri.
- Nodul cu id "1" -> status: "current", isGoal: false (start).
- 2-3 noduri -> status: "discovered", isGoal: false.
- Restul -> status: "hidden", isGoal: false.
- EXACT UN singur nod are isGoal: true și status: "hidden" (destinația finală: boss, artefact etc.).
- TOATE nodurile conectate în graf — niciun nod izolat.
- Coordonate: x ∈ [100, 700], y ∈ [100, 440] pentru canvas 800x540.

REGULI PENTRU CONTENT:
- FIECARE nod TREBUIE să aibă câmpul "content" complet — nod fără content = INVALID.
- scene_type: exploration | trap | combat | social | puzzle | boss | reward | mixed. Variază între noduri.
- elements: cel puțin 1 element (ideal 2-3). Tipuri: trap | monster | npc | item | environmental_hazard | boss | reward | clue | key_item.
- mechanics cu valori D&D 5e realiste. Pentru clue/lore pune dc:0, damage:null, hp:0.
- Dificultate: start DC 10-12 → mid DC 12-15 → boss DC 15-20.
- Boss/mini-boss NICIODATĂ în nodul start.
- NarrativeIntro: integrează rasa/clasa/backstory-ul personajului."""

    user_content = f"Descriere aventură: {req.description}"
    if character_context:
        user_content += f"\n\nContext personaj: {json.dumps(character_context, ensure_ascii=False)}"
    user_content += (
        "\n\nReamintire: FIECARE nod TREBUIE să aibă câmpul \"content\" complet populat "
        "(summary, scene_type, narrative_seed, elements cu mechanics, completion_conditions). "
        "Nu omite acest câmp pentru niciun nod."
    )

    try:
        response = get_openai_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            max_tokens=8192,
            temperature=0.85,
        )

        raw_content = response.choices[0].message.content
        try:
            adventure_data = json.loads(raw_content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail={
                "error": "Invalid map format",
                "detail": "LLM returned non-parseable JSON",
                "raw": raw_content[:500]
            })

        return {
            "narrativeIntro": adventure_data.get("narrativeIntro"),
            "map": _normalize_map(adventure_data.get("map")),
            "session_id": used_session_id
        }

    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="Maestrul Dungeonului a adormit. Răspunsul a întârziat prea mult.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Generation failed", "detail": str(e)})


# ---------------------------------------------------------------------------
# World Architect — defensive normalizer.
# Ensures every node has a usable `content` block even if the LLM drops fields.
# ---------------------------------------------------------------------------
_DEFAULT_MECHANICS: Dict[str, Any] = {
    "dc": 0, "check_type": None, "damage": None, "hp": 0, "ac": 0, "cr": None
}


def _ensure_element(elem: Any) -> Dict[str, Any]:
    if not isinstance(elem, dict):
        elem = {}
    mechanics = {**_DEFAULT_MECHANICS, **(elem.get("mechanics") or {})}
    return {
        "type": elem.get("type") or "clue",
        "name": elem.get("name") or "Element misterios",
        "description": elem.get("description") or "Un detaliu pe care DM-ul îl va explora la fața locului.",
        "mechanics": mechanics,
        "rewards": elem.get("rewards") or [],
    }


def _ensure_content(node: Dict[str, Any]) -> Dict[str, Any]:
    raw = node.get("content")
    if not isinstance(raw, dict):
        raw = {}
    elements = raw.get("elements")
    if not isinstance(elements, list) or not elements:
        elements = [{
            "type": "clue",
            "name": f"Indiciu în {node.get('name', 'această locație')}",
            "description": "Un detaliu narativ pe care DM-ul îl va dezvolta la sosirea jucătorului.",
            "mechanics": dict(_DEFAULT_MECHANICS),
            "rewards": [],
        }]
    else:
        elements = [_ensure_element(e) for e in elements]
    return {
        "summary": raw.get("summary") or node.get("description") or "Scenă de explorat.",
        "scene_type": raw.get("scene_type") or "exploration",
        "narrative_seed": raw.get("narrative_seed") or node.get("description") or "Scenă fără context detaliat.",
        "elements": elements,
        "completion_conditions": raw.get("completion_conditions") or [],
        "failure_consequences": raw.get("failure_consequences") or [],
    }


def _normalize_map(raw_map: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw_map, dict):
        return raw_map
    nodes = raw_map.get("nodes") or []
    normalized = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        n = dict(node)
        n.setdefault("isGoal", False)
        n.setdefault("status", "hidden")
        n["content"] = _ensure_content(n)
        normalized.append(n)
    return {"nodes": normalized, "edges": raw_map.get("edges") or []}

@router.post("/game/enter-node")
async def enter_node(req: EnterNodeRequest):
    history_text = ""
    if req.recent_history:
        history_text = "\n".join(
            f"{msg.role.upper()}: {msg.text}" for msg in req.recent_history[-8:]
        )

    system_prompt = """You are the Dungeon Master for a single-player D&D 5e adventure.

The player has just arrived at a new location. Present the encounter in an immersive, digestible way.

Respond EXCLUSIVELY with valid JSON, no markdown:
{
  "type": "encounter_presentation",
  "narrative": "2-4 paragraphs in second person. Describe what the character sees, hears, and feels. Highlight visible threats, NPCs, or points of interest. End with implicit options — do not decide for the player.",
  "visible_elements": ["list of things the player can observe or ask about"],
  "suggested_actions": ["2-4 optional action ideas without limiting player freedom"]
}

Rules:
- Be concise but evocative; avoid walls of text.
- Reflect the current location, adventure context, and character backstory.
- Do NOT reveal hidden mechanical values (DC, trap stats).
- Use D&D 5e tone. Write in English.
- Do NOT repeat the full adventure intro; focus on THIS location."""

    user_content = f"""Location:
{json.dumps(req.node, indent=2)}

Character:
{json.dumps(req.character, indent=2)}"""

    if req.adventure_description:
        user_content += f"\n\nAdventure concept:\n{req.adventure_description}"
    if req.narrative_intro:
        user_content += f"\n\nAdventure introduction (context only):\n{req.narrative_intro}"
    if history_text:
        user_content += f"\n\nRecent history:\n{history_text}"
    if req.game_state:
        user_content += f"\n\nGame state:\n{json.dumps(req.game_state, indent=2)}"

    try:
        response = get_openai_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw_content = response.choices[0].message.content
        try:
            encounter = json.loads(raw_content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail={
                "error": "Invalid encounter format",
                "detail": "LLM returned non-parseable JSON",
                "raw": raw_content[:500],
            })

        return {
            "type": encounter.get("type", "encounter_presentation"),
            "narrative": encounter.get("narrative", ""),
            "visible_elements": encounter.get("visible_elements", []),
            "suggested_actions": encounter.get("suggested_actions", []),
        }
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Dungeon Master has fallen asleep. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Encounter generation failed", "detail": str(e)})

@router.post("/game/action")
async def game_action(req: GameActionRequest):
    user_content = _build_action_user_content(req)
    runtime_state = _extract_runtime_state(req)

    try:
        classify_response = get_openai_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": DM_ACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw = classify_response.choices[0].message.content
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid DM response format.")

        if result.get("category") == "complex_action" and result.get("phase") == "roll_requested":
            check = result.get("check") or {}
            ability = check.get("ability", "DEX")
            modifier = get_ability_modifier(req.character, ability)
            rolled = roll_d20(modifier)
            dc = int(check.get("dc") or 12)
            outcome = resolve_outcome(rolled["d20"], rolled["total"], dc)
            roll_result = {**rolled, "dc": dc, "outcome": outcome}

            resolve_content = user_content + f"\n\nRoll result (already resolved by Rules Engine):\n{json.dumps(roll_result, indent=2)}\n\nResolve the action narratively using this outcome."

            resolve_response = get_openai_client().chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": DM_ACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": resolve_content},
                ],
                response_format={"type": "json_object"},
            )
            resolved_raw = resolve_response.choices[0].message.content
            try:
                resolved = json.loads(resolved_raw)
            except json.JSONDecodeError:
                raise HTTPException(status_code=500, detail="Invalid DM roll resolution format.")

            return _finalize_action_result(
                {
                    **resolved,
                    "roll_result": roll_result,
                    "check": check,
                },
                runtime_state,
                req.action,
            )

        return _finalize_action_result(result, runtime_state, req.action)
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Dungeon Master has fallen asleep. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Action failed", "detail": str(e)})

@router.post("/action")
async def handle_action(req: ActionRequest):
    try:
        response = get_openai_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Ești un Game Master pentru un joc D&D. Răspunzi la acțiunile jucătorului narativ și decizi consecințele."},
                {"role": "user", "content": f"Starea jucătorului: {req.state}\nAcțiunea: {req.action}"}
            ]
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health():
    return {"status": "ok"}