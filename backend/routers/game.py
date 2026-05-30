from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
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
from adventure_end import (
    apply_auto_healing_potion,
    evaluate_adventure_end,
    ensure_main_mission,
    should_complete_reach_mission,
)
from prompts import (
    DM_ACTION_SYSTEM_PROMPT,
    WORLD_ARCHITECT_SYSTEM_PROMPT,
    ENCOUNTER_PRESENTATION_SYSTEM_PROMPT,
    GENERATE_BACKSTORY_PROMPT,
    GENERATE_ADVENTURE_CONCEPT_PROMPT,
    CHRONICLER_SYSTEM_PROMPT,
    ADVENTURE_CRITIC_SYSTEM_PROMPT,
)

load_dotenv()
router = APIRouter()

_openai_client: Optional[OpenAI] = None


def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        # Punctăm către API-ul local expus de Ollama
        _openai_client = OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama", # Librăria cere o cheie, dar Ollama acceptă orice string
            timeout=600.0 # Crescut la 10 minute pentru inferența locală pe hardware mai slab
        )
    return _openai_client


def clean_json_response(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

# Asigurăm existența folderului pentru sesiuni
os.makedirs("data", exist_ok=True)

class CharacterData(BaseModel):
    name: str
    race: str
    characterClass: str
    backstory: str
    stats: dict
    avatar: Optional[str] = None

class CharacterAvatarUpdate(BaseModel):
    avatar: str

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
    main_mission: Optional[dict] = None

class GameActionRequest(BaseModel):
    action: str
    character: dict
    node: dict
    narrative_intro: Optional[str] = None
    adventure_description: Optional[str] = None
    recent_history: Optional[List[HistoryMessage]] = []
    game_state: Optional[dict] = None
    main_mission: Optional[dict] = None


class AdventureSummaryRequest(BaseModel):
    character: dict
    session_log: List[HistoryMessage]
    stats: dict
    end_reason: Optional[str] = None
    main_mission: Optional[dict] = None
    adventure_description: Optional[str] = None
    narrative_intro: Optional[str] = None
    map_nodes: Optional[List[dict]] = None


class GenerateBackstoryRequest(BaseModel):
    name: Optional[str] = None
    race: Optional[str] = None
    characterClass: Optional[str] = None


class GenerateConceptRequest(BaseModel):
    character: Optional[dict] = None


def _call_json_llm(system_prompt: str, user_content: str) -> dict:
    response = get_openai_client().chat.completions.create(
        model="llama3.1",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content
    cleaned_raw = clean_json_response(raw)
    try:
        return json.loads(cleaned_raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid AI response format.")


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
    if req.main_mission:
        user_content += f"\n\nMain mission (ONLY end adventure on mission completion, early exit, or death — NOT on node_complete alone):\n{json.dumps(req.main_mission, indent=2)}"
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


def _finalize_action_result(
    result: dict,
    runtime_state: dict,
    player_action: str,
    node: dict,
    main_mission: Optional[dict] = None,
) -> dict:
    category = result.get("category")
    phase = result.get("phase")
    
    # Safety Check: question should NEVER complete a node
    if category == "question" and "state_changes" in result:
        result["state_changes"]["node_complete"] = False
    
    # Safety Check: trivial simple_action in serious nodes
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
        updated_state, potion_meta = apply_auto_healing_potion(updated_state)
        finalized = {
            **result,
            "state_changes": merged_changes,
            "game_state": updated_state,
        }
        if potion_meta.get("auto_potion_used"):
            finalized["auto_potion_used"] = True
            finalized["auto_potion_heal"] = potion_meta.get("heal_amount")
            heal = potion_meta.get("heal_amount")
            suffix = (
                f"\n\nYour body slumps as you fall — but instinct takes over. "
                f"You automatically quaff a healing potion from your belt, recovering {heal} HP."
            )
            finalized["narrative"] = (finalized.get("narrative") or "") + suffix
    else:
        finalized = {
            **result,
            "game_state": runtime_state,
        }

    end_game, end_reason = evaluate_adventure_end(
        main_mission,
        node,
        player_action,
        finalized.get("game_state") or runtime_state,
        finalized,
    )
    if end_game:
        finalized["adventure_complete"] = True
        finalized["completion_reason"] = end_reason

    return finalized

@router.post("/character")
async def save_character(char: CharacterData):
    session_id = str(uuid.uuid4())
    file_path = f"data/{session_id}.json"
    with open(file_path, "w") as f:
        json.dump(char.model_dump(), f)
    return {"session_id": session_id, "character": char.model_dump()}

@router.post("/character/generate-backstory")
async def generate_backstory(req: GenerateBackstoryRequest):
    parts = []
    if req.name:
        parts.append(f"Name: {req.name}")
    if req.race:
        parts.append(f"Race: {req.race}")
    if req.characterClass:
        parts.append(f"Class: {req.characterClass}")
    user_content = "\n".join(parts) if parts else "Create a generic heroic fantasy backstory."

    try:
        data = _call_json_llm(GENERATE_BACKSTORY_PROMPT, user_content)
        backstory = (data.get("backstory") or "").strip()
        if len(backstory) < 10:
            raise HTTPException(status_code=500, detail="Generated backstory was too short.")
        return {"backstory": backstory}
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Dungeon Master has fallen asleep. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Backstory generation failed", "detail": str(e)})

@router.get("/character/{session_id}")
async def get_character(session_id: str):
    file_path = f"data/{session_id}.json"
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            data = json.load(f)
        return {"character": data}
    raise HTTPException(status_code=404, detail="Session not found")


@router.patch("/character/{session_id}/avatar")
async def update_character_avatar(session_id: str, body: CharacterAvatarUpdate):
    file_path = f"data/{session_id}.json"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Session not found")

    with open(file_path, "r") as f:
        data = json.load(f)

    data["avatar"] = body.avatar

    with open(file_path, "w") as f:
        json.dump(data, f)

    return {"character": data}

@router.post("/adventure/generate-concept")
async def generate_adventure_concept(req: GenerateConceptRequest):
    user_content = "Create an adventure concept for a solo D&D player."
    if req.character:
        user_content += f"\n\nCharacter context:\n{json.dumps(req.character, ensure_ascii=False)}"

    try:
        data = _call_json_llm(GENERATE_ADVENTURE_CONCEPT_PROMPT, user_content)
        concept = (data.get("concept") or "").strip()
        if len(concept) < 20:
            raise HTTPException(status_code=500, detail="Generated concept was too short.")
        return {"concept": concept}
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Dungeon Master has fallen asleep. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Concept generation failed", "detail": str(e)})

@router.post("/adventure/generate-stream")
async def generate_adventure_stream(req: AdventureRequest):
    character_context = None
    used_session_id = req.session_id

    if req.session_id:
        file_path = f"data/{req.session_id}.json"
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                character_context = json.load(f)
        elif req.character:
            character_context = req.character
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

    async def event_generator():
        try:
            # STEP 1: Draft Generation
            yield f"data: {json.dumps({'status': 'drafting', 'message': 'The World Architect is drafting the initial map...'})}\n\n"
            response = get_openai_client().chat.completions.create(
                model="llama3.1",
                messages=[
                    {"role": "system", "content": WORLD_ARCHITECT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"},
                max_tokens=8192,
                temperature=0.7,
            )
            raw_content = response.choices[0].message.content
            cleaned_raw = clean_json_response(raw_content)
            adventure_data = json.loads(cleaned_raw)

            # STEP 2: Critique
            yield f"data: {json.dumps({'status': 'critiquing', 'message': 'A Senior Designer is evaluating the balance and logic...'})}\n\n"
            critique_response = get_openai_client().chat.completions.create(
                model="llama3.1",
                messages=[
                    {"role": "system", "content": ADVENTURE_CRITIC_SYSTEM_PROMPT},
                    {"role": "user", "content": f"User Request: {req.description}\n\nDrafted Adventure:\n{raw_content}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            raw_critique = critique_response.choices[0].message.content
            cleaned_critique = clean_json_response(raw_critique)
            critique_data = json.loads(cleaned_critique)
            
            # STEP 3: Refinement (only if needed)
            if critique_data.get("needs_revision"):
                yield f"data: {json.dumps({'status': 'refining', 'message': 'Refining the adventure based on expert feedback...'})}\n\n"
                refine_content = (
                    f"Original Request: {req.description}\n\n"
                    f"Your Initial Draft:\n{raw_content}\n\n"
                    f"Feedback from Senior Designer:\n{critique_data.get('feedback')}\n\n"
                    "Please output the corrected, final adventure JSON. Ensure it is balanced and follows all original rules."
                )
                final_response = get_openai_client().chat.completions.create(
                    model="llama3.1",
                    messages=[
                        {"role": "system", "content": WORLD_ARCHITECT_SYSTEM_PROMPT},
                        {"role": "user", "content": refine_content}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7,
                )
                raw_final = final_response.choices[0].message.content
                cleaned_final = clean_json_response(raw_final)
                adventure_data = json.loads(cleaned_final)
            else:
                yield f"data: {json.dumps({'status': 'polishing', 'message': 'Adventure is solid. Polishing the details...'})}\n\n"

            normalized_map = _normalize_map(adventure_data.get("map"))
            final_payload = {
                "narrativeIntro": adventure_data.get("narrativeIntro"),
                "map": normalized_map,
                "mainMission": ensure_main_mission(adventure_data.get("mainMission"), (normalized_map or {}).get("nodes") or []),
                "session_id": used_session_id
            }

            yield f"data: {json.dumps({'status': 'complete', 'data': final_payload})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/adventure/generate")
async def generate_adventure(req: AdventureRequest):
    character_context = None
    used_session_id = req.session_id

    if req.session_id:
        file_path = f"data/{req.session_id}.json"
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                character_context = json.load(f)
        elif req.character:
            character_context = req.character
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
        # STEP 1: Draft Generation
        print("🛠️  Agent Phase 1: World Architect drafting initial map...")
        response = get_openai_client().chat.completions.create(
            model="llama3.1",
            messages=[
                {"role": "system", "content": WORLD_ARCHITECT_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            max_tokens=8192,
            temperature=0.7,
        )
        raw_content = response.choices[0].message.content
        cleaned_raw = clean_json_response(raw_content)
        adventure_data = json.loads(cleaned_raw)

        # STEP 2: Critique
        print("🧐  Agent Phase 2: Design Critic evaluating draft...")
        critique_response = get_openai_client().chat.completions.create(
            model="llama3.1",
            messages=[
                {"role": "system", "content": ADVENTURE_CRITIC_SYSTEM_PROMPT},
                {"role": "user", "content": f"User Request: {req.description}\n\nDrafted Adventure:\n{raw_content}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        raw_critique = critique_response.choices[0].message.content
        cleaned_critique = clean_json_response(raw_critique)
        critique_data = json.loads(cleaned_critique)
        
        # STEP 3: Refinement (only if needed)
        if critique_data.get("needs_revision"):
            print(f"✨  Agent Phase 3: Refining based on feedback: {critique_data.get('feedback')}")
            refine_content = (
                f"Original Request: {req.description}\n\n"
                f"Your Initial Draft:\n{raw_content}\n\n"
                f"Feedback from Senior Designer:\n{critique_data.get('feedback')}\n\n"
                "Please output the corrected, final adventure JSON. Ensure it is balanced and follows all original rules."
            )
            final_response = get_openai_client().chat.completions.create(
                model="llama3.1",
                messages=[
                    {"role": "system", "content": WORLD_ARCHITECT_SYSTEM_PROMPT},
                    {"role": "user", "content": refine_content}
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            raw_final = final_response.choices[0].message.content
            cleaned_final = clean_json_response(raw_final)
            adventure_data = json.loads(cleaned_final)
        else:
            print("✅  No revision needed. Draft is solid.")

        normalized_map = _normalize_map(adventure_data.get("map"))

        return {
            "narrativeIntro": adventure_data.get("narrativeIntro"),
            "map": normalized_map,
            "mainMission": ensure_main_mission(adventure_data.get("mainMission"), (normalized_map or {}).get("nodes") or []),
            "session_id": used_session_id
        }

    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="Maestrul Dungeonului a adormit. Răspunsul a întârziat prea mult.")
    except Exception as e:
        print(f"❌  Adventure generation failed: {str(e)}")
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
            model="llama3.1",
            messages=[
                {"role": "system", "content": ENCOUNTER_PRESENTATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw_content = response.choices[0].message.content
        try:
            encounter = json.loads(clean_json_response(raw_content))
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail={
                "error": "Invalid encounter format",
                "detail": "LLM returned non-parseable JSON",
                "raw": raw_content[:500],
            })

        response_payload = {
            "type": encounter.get("type", "encounter_presentation"),
            "narrative": encounter.get("narrative", ""),
            "visible_elements": encounter.get("visible_elements", []),
            "suggested_actions": encounter.get("suggested_actions", []),
        }

        if should_complete_reach_mission(req.main_mission, req.node):
            response_payload["adventure_complete"] = True
            response_payload["completion_reason"] = "victory"

        return response_payload
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
            model="llama3.1",
            messages=[
                {"role": "system", "content": DM_ACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw = classify_response.choices[0].message.content
        try:
            result = json.loads(clean_json_response(raw))
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
                model="llama3.1",
                messages=[
                    {"role": "system", "content": DM_ACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": resolve_content},
                ],
                response_format={"type": "json_object"},
            )
            resolved_raw = resolve_response.choices[0].message.content
            try:
                resolved = json.loads(clean_json_response(resolved_raw))
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
                req.main_mission,
            )

        return _finalize_action_result(result, runtime_state, req.action, req.node, req.main_mission)
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Dungeon Master has fallen asleep. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Action failed", "detail": str(e)})


@router.post("/game/summary")
async def generate_adventure_summary(req: AdventureSummaryRequest):
    log_text = "\n".join(
        f"{msg.role.upper()}: {msg.text}" for msg in req.session_log
    )
    if not log_text.strip():
        log_text = "(No session events recorded.)"

    user_content = f"""Character:
{json.dumps(req.character, indent=2, ensure_ascii=False)}

Final statistics:
{json.dumps(req.stats, indent=2)}"""

    if req.end_reason:
        user_content += f"\n\nAdventure ended because: {req.end_reason}"
    if req.main_mission:
        user_content += f"\n\nMain mission:\n{json.dumps(req.main_mission, indent=2)}"

    user_content += f"""

Full session log:
{log_text}"""

    if req.adventure_description:
        user_content += f"\n\nAdventure concept:\n{req.adventure_description}"
    if req.narrative_intro:
        user_content += f"\n\nAdventure introduction:\n{req.narrative_intro}"
    if req.map_nodes:
        user_content += f"\n\nLocations in this adventure:\n{json.dumps(req.map_nodes, indent=2, ensure_ascii=False)}"

    try:
        response = get_openai_client().chat.completions.create(
            model="llama3.1",
            messages=[
                {"role": "system", "content": CHRONICLER_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        try:
            data = json.loads(clean_json_response(raw))
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid summary format from AI.")

        return {
            "title": data.get("title", "A Hero's Triumph"),
            "narrative": data.get("narrative", ""),
            "stats": req.stats,
        }
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Chronicler fell silent. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Summary generation failed", "detail": str(e)})


@router.get("/health")
async def health():
    return {"status": "ok"}