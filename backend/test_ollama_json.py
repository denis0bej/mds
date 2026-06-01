import asyncio
import json

from json_utils import clean_json_response, parse_agent_json
from routers.game import get_ai_client, get_model_name


async def test_ollama():
    print("Testing Ollama connection (llama3.1)...")
    client = get_ai_client("ollama")

    system_prompt = "You are a test bot. Respond EXCLUSIVELY with valid JSON, no markdown."
    user_prompt = 'Generate a dummy JSON with a "status" key set to "success".'

    try:
        response = client.chat.completions.create(
            model=get_model_name("ollama"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        raw_content = response.choices[0].message.content or ""
        print(f"\n--- Raw ---\n{raw_content}\n")

        parsed_json = parse_agent_json(raw_content)
        print(f"--- Parsed ---\n{json.dumps(parsed_json, indent=2)}\n")

        if parsed_json.get("status") == "success":
            print("SUCCESS: Backend communicates with Ollama and JSON parses correctly.")
        else:
            print("WARNING: Parsed JSON but unexpected content.")
    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    asyncio.run(test_ollama())
