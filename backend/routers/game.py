from fastapi import APIRouter
from pydantic import BaseModel
import anthropic
import os
import uuid
import json
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Asigurăm existența folderului pentru sesiuni
os.makedirs("data", exist_ok=True)

class CharacterData(BaseModel):
    name: str
    race: str
    characterClass: str
    backstory: str
    stats: dict

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
    return {"error": "Session not found"}

@router.post("/action")
async def handle_action(req: ActionRequest):
    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        system="Ești un Game Master pentru un joc D&D. Răspunzi la acțiunile jucătorului narativ și decizi consecințele.",
        messages=[
            {"role": "user", "content": f"Starea jucătorului: {req.state}\nAcțiunea: {req.action}"}
        ]
    )
    return {"response": message.content[0].text}

@router.get("/health")
async def health():
    return {"status": "ok"}