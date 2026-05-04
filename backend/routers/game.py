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
- Nodul 1 (start) -> status: "current".
- Nodurile 2-3 -> status: "discovered".
- Restul nodurilor -> status: "hidden".
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

@router.get("/health")
async def health():
    return {"status": "ok"}