import json
from typing import Any


def clean_json_response(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def parse_agent_json(raw_text: str) -> dict[str, Any]:
    """Parse agent output that may be wrapped in markdown fences."""
    cleaned = clean_json_response(raw_text)
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("Agent output must be a JSON object")
    return data
