"""Minimal structural checks for AI agent JSON outputs (offline evals, no LLM calls)."""

from typing import Any


def validate_world_architect(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not isinstance(data.get("narrativeIntro"), str) or not data["narrativeIntro"].strip():
        errors.append("missing or empty narrativeIntro")
    map_data = data.get("map")
    if not isinstance(map_data, dict):
        errors.append("missing map object")
        return errors
    nodes = map_data.get("nodes")
    if not isinstance(nodes, list) or len(nodes) < 1:
        errors.append("map.nodes must be a non-empty array")
    return errors


def validate_adventure_critic(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if "needs_revision" not in data:
        errors.append("missing needs_revision")
    if not isinstance(data.get("feedback"), str):
        errors.append("missing feedback string")
    return errors


def validate_dm_action(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not isinstance(data.get("classification"), str):
        errors.append("missing classification")
    if not isinstance(data.get("narrative"), str) or not data["narrative"].strip():
        errors.append("missing or empty narrative")
    if data.get("classification") == "skill_check":
        check = data.get("check")
        if not isinstance(check, dict) or "dc" not in check:
            errors.append("skill_check requires check.dc")
    return errors
