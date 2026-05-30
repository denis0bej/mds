import asyncio
import json
import sys
import os

# Adăugăm directorul curent în path pentru a putea importa din routers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from routers.game import get_openai_client, clean_json_response
except ImportError:
    # Dacă rulăm din folderul backend, încercăm import direct
    from routers.game import get_openai_client, clean_json_response

async def test_ollama():
    print("🚀 Testând conexiunea către Ollama (llama3.1)...")
    client = get_openai_client()
    
    system_prompt = "You are a test bot. Respond EXCLUSIVELY with valid JSON, no markdown."
    user_prompt = "Generate a dummy JSON with a 'status' key set to 'success'."
    
    try:
        response = client.chat.completions.create(
            model="llama3.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        
        raw_content = response.choices[0].message.content
        print(f"\n--- Rezultat Brut ---\n{raw_content}\n")
        
        cleaned_content = clean_json_response(raw_content)
        parsed_json = json.loads(cleaned_content)
        
        print(f"--- Rezultat Parsat ---\n{json.dumps(parsed_json, indent=2)}\n")
        
        if parsed_json.get("status") == "success":
            print("✅ SUCCES: Backend-ul comunică perfect cu Ollama!")
        else:
            print("⚠️ ATENȚIE: Răspunsul a fost parsat, dar conținutul nu este cel așteptat.")
            
    except Exception as e:
        print(f"❌ EROARE: Testul a eșuat. Detalii: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_ollama())
