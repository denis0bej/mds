from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import openai
from openai import OpenAI
import os
import uuid
import json
import httpx
from dotenv import load_dotenv
from rules_engine import roll_d20, resolve_outcome, get_ability_modifier

load_dotenv()
router = APIRouter()
# Configure OpenAI client
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    timeout=60.0
)

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
    "flags_set": {},
    "node_complete": false
  }
}

For "complex_action" (roll NOT yet resolved — propose the check only):
{
  "category": "complex_action",
  "phase": "roll_requested",
  "check": {
    "type": "ability_check",
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

When resolving a roll (you will receive roll_result), respond with:
{
  "category": "complex_action",
  "phase": "roll_resolved",
  "narrative": "describe outcome based on roll_result",
  "state_changes": {
    "hp_delta": 0,
    "flags_set": {},
    "node_complete": false
  }
}"""

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
    
    system_prompt = """Ești un "Story Weaver" — un maestru narator D&D. 
Misiunea ta este să generezi o introducere epică și o hartă a aventurii bazată pe descrierea jucătorului.

Răspunde EXCLUSIV cu un obiect JSON valid, fără markdown, fără explicații suplimentare.

Structura JSON cerută:
{
  "narrativeIntro": "2-3 paragrafe de introducere epică, adaptată descrierii și personajului (dacă e disponibil).",
  "map": {
    "nodes": [
      {
        "id": "1",
        "name": "Nume locație",
        "description": "Scurtă descriere atmosferică",
        "status": "current",
        "isGoal": false,
        "x": 150,
        "y": 100
      }
    ],
    "edges": [
      {
        "from": "1",
        "to": "2",
        "condition": "Opțional - ce trebuie să facă jucătorul pentru a traversa"
      }
    ]
  }
}

Reguli pentru hartă:
- Generează exact 6-10 noduri.
- Nodul 1 (start) -> status: "current", isGoal: false.
- Nodurile 2-3 -> status: "discovered", isGoal: false.
- Restul nodurilor -> status: "hidden", isGoal: false — cu EXCEPȚIA nodului final.
- EXACT UN singur nod trebuie să aibă isGoal: true. Acesta este destinația finală a aventurii (boss, artefact, ritual etc.) și trebuie să fie status: "hidden".
- TOATE nodurile trebuie să fie conectate în graf — niciun nod izolat. Fiecare nod trebuie să aibă cel puțin un edge care îl conectează la alt nod.
- Harta trebuie să fie coerentă tematic cu aventura.
- Include coordonate x (100-700) și y (100-440) pentru fiecare nod pentru a fi afișate pe o pânză de 800x540.
- Dacă ai date despre personaj (nume, rasă, clasă, backstory), integrează-le în narațiune și în numele locațiilor."""

    user_content = f"Descriere aventură: {req.description}"
    if character_context:
        user_content += f"\n\nContext personaj: {json.dumps(character_context)}"

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={ "type": "json_object" }
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
            "map": adventure_data.get("map"),
            "session_id": used_session_id
        }

    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="Maestrul Dungeonului a adormit. Răspunsul a întârziat prea mult.")
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Generation failed", "detail": str(e)})

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
        response = client.chat.completions.create(
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

    try:
        classify_response = client.chat.completions.create(
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

            resolve_response = client.chat.completions.create(
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

            return {
                **resolved,
                "roll_result": roll_result,
                "check": check,
            }

        return result
    except openai.APITimeoutError:
        raise HTTPException(status_code=504, detail="The Dungeon Master has fallen asleep. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Action failed", "detail": str(e)})

@router.post("/action")
async def handle_action(req: ActionRequest):
    try:
        response = client.chat.completions.create(
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