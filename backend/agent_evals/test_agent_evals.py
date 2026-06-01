import json
from pathlib import Path

from agent_evals.schemas import (
    validate_adventure_critic,
    validate_dm_action,
    validate_world_architect,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_world_architect_good_passes_eval():
    data = json.loads((FIXTURES / "world_architect_good.json").read_text())
    assert validate_world_architect(data) == []


def test_world_architect_bad_fails_eval():
    data = json.loads((FIXTURES / "world_architect_bad.json").read_text())
    errors = validate_world_architect(data)
    assert errors


def test_dm_action_good_passes_eval():
    data = json.loads((FIXTURES / "dm_action_good.json").read_text())
    assert validate_dm_action(data) == []


def test_critic_good_passes_eval():
    data = json.loads((FIXTURES / "critic_good.json").read_text())
    assert validate_adventure_critic(data) == []
