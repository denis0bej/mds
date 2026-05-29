import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=5
    )
    print(f"SUCCESS: {response.choices[0].message.content}")
except Exception as e:
    print(f"FAILURE: {e}")
