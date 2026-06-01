import json
from pathlib import Path

import pytest

from json_utils import clean_json_response, parse_agent_json
from rules_engine import resolve_outcome


FIXTURES = Path(__file__).resolve().parent.parent / "agent_evals" / "fixtures"


class TestJsonUtils:
    def test_clean_json_strips_markdown_fence(self):
        raw = '```json\n{"status": "ok"}\n```'
        assert json.loads(clean_json_response(raw)) == {"status": "ok"}

    def test_parse_agent_json_rejects_non_object(self):
        with pytest.raises(ValueError, match="JSON object"):
            parse_agent_json('["not", "an", "object"]')


class TestRulesEngine:
    def test_critical_success(self):
        assert resolve_outcome(d20=20, total=25, dc=18) == "critical_success"


class TestAgentJsonFixtures:
    def test_world_architect_fixture_is_valid_json_object(self):
        data = json.loads((FIXTURES / "world_architect_good.json").read_text())
        assert isinstance(data, dict)
        assert "narrativeIntro" in data
        assert "map" in data

    def test_dm_action_fixture_is_valid_json_object(self):
        data = json.loads((FIXTURES / "dm_action_good.json").read_text())
        assert data["classification"] == "skill_check"
        assert "check" in data

    def test_critic_fixture_is_valid_json_object(self):
        data = json.loads((FIXTURES / "critic_good.json").read_text())
        assert "needs_revision" in data
