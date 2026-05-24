import random
from typing import Optional


def roll_d20(modifier: int = 0) -> dict:
    d20 = random.randint(1, 20)
    return {"d20": d20, "modifier": modifier, "total": d20 + modifier}


def resolve_outcome(d20: int, total: int, dc: int) -> str:
    if d20 == 1:
        return "critical_fail"
    if d20 == 20:
        return "critical_success"
    if total >= dc:
        return "success"
    if total >= dc - 2:
        return "partial"
    return "fail"


def get_ability_modifier(character: dict, ability: str) -> int:
    stats = character.get("stats") or {}
    score = stats.get(ability, 10)
    return (int(score) - 10) // 2
