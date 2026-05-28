from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import openai
from openai import OpenAI
import os
import uuid
import json
from dotenv import load_dotenv
from rules_engine import (
    roll_d20,
    resolve_outcome,
    get_ability_modifier,
    create_initial_game_state,
    apply_state_changes,
    reconcile_state_changes,
)
from prompts import (
    DM_ACTION_SYSTEM_PROMPT,
    WORLD_ARCHITECT_SYSTEM_PROMPT,
    ENCOUNTER_PRESENTATION_SYSTEM_PROMPT,
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
    
    completion_conditions = req.node.get("content", {}).get("completion_conditions", [])
    if completion_conditions:
        user_content += f"\n\nCompletion Conditions (MUST be met for node_complete: true):\n- " + "\n- ".join(completion_conditions)

    history_text = _format_history(req.recent_history)
    if history_text:
        user_content += f"\n\nRecent history:\n{history_text}"
    if req.game_state:
        user_content += f"\n\nGame state:\n{json.dumps(req.game_state, indent=2)}"
    return user_content


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


def _finalize_action_result(result: dict, runtime_state: dict, player_action: str, node: dict) -> dict:
    category = result.get("category")
    phase = result.get("phase")
    
    # Safety Check: question should NEVER complete a node
    if category == "question" and "state_changes" in result:
        result["state_changes"]["node_complete"] = False
    
    # Safety Check: trivial simple_action in serious nodes
    # According to D&D 5e rules and our prompt, simple_action is for trivial tasks.
    # Trivial tasks should not resolve combat, traps, or boss encounters.
    if category == "simple_action" and result.get("state_changes", {}).get("node_complete"):
        scene_type = node.get("content", {}).get("scene_type", "")
        if scene_type in ("combat", "boss", "trap"):
            result["state_changes"]["node_complete"] = False

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
        json.dump(char.model_dump(), f)
    return {"session_id": session_id, "character": char.model_dump()}

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
                {"role": "system", "content": WORLD_ARCHITECT_SYSTEM_PROMPT},
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
    edges = raw_map.get("edges") or []
    
    # 1. First pass: basic normalization and identify current nodes
    normalized = []
    current_node_ids = set()
    for node in nodes:
        if not isinstance(node, dict):
            continue
        n = dict(node)
        n.setdefault("isGoal", False)
        n.setdefault("status", "hidden")
        n["content"] = _ensure_content(n)
        if n["status"] == "current":
            current_node_ids.add(str(n.get("id")))
        normalized.append(n)
    
    # 2. Identify neighbors of current nodes
    neighbor_ids = set()
    for edge in edges:
        f = str(edge.get("from"))
        t = str(edge.get("to"))
        if f in current_node_ids:
            neighbor_ids.add(t)
        if t in current_node_ids:
            neighbor_ids.add(f)
            
    # 3. Second pass: ensure neighbors are discovered
    for n in normalized:
        node_id = str(n.get("id"))
        if node_id in neighbor_ids and n["status"] == "hidden":
            n["status"] = "discovered"
            
    return {"nodes": normalized, "edges": edges}

@router.post("/game/enter-node")
async def enter_node(req: EnterNodeRequest):
    history_text = ""
    if req.recent_history:
        history_text = "\n".join(
            f"{msg.role.upper()}: {msg.text}" for msg in req.recent_history[-8:]
        )

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
                {"role": "system", "content": ENCOUNTER_PRESENTATION_SYSTEM_PROMPT},
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
                req.node,
            )

        return _finalize_action_result(result, runtime_state, req.action, req.node)
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Dungeon Master has fallen asleep. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Action failed", "detail": str(e)})

@router.get("/health")
async def health():
    return {"status": "ok"}