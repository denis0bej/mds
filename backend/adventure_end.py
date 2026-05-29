import re
from typing import Optional, Tuple

from rules_engine import (
    _find_inventory_item,
    _item_should_be_removed,
    _normalize_inventory_item,
    _slugify,
    roll_2d4_plus_2,
)


EARLY_EXIT_PATTERN = re.compile(
    r"\b("
    r"end (the )?adventure|quit|give up|"
    r"abandon (the )?(quest|adventure|mission)|"
    r"leave (the )?(adventure|quest)|"
    r"retreat (and )?(end|leave|stop)|"
    r"stop (the )?(adventure|quest)|"
    r"end (my )?journey early"
    r")\b",
    re.IGNORECASE,
)


def is_early_exit_action(action: str) -> bool:
    return bool(EARLY_EXIT_PATTERN.search(action or ""))


def apply_auto_healing_potion(state: dict) -> Tuple[dict, dict]:
    """If HP is 0 or below and a healing potion exists, consume it automatically."""
    meta = {"auto_potion_used": False, "heal_amount": 0}
    hp = int(state.get("hp") or 0)
    if hp > 0:
        return state, meta

    inventory = [_normalize_inventory_item(item) for item in (state.get("inventory") or [])]
    potion = _find_inventory_item(inventory, "healing potion", "healing-potion", "potion")
    if not potion:
        return state, meta

    heal_amount = roll_2d4_plus_2()
    max_hp = int(state.get("max_hp") or 1)
    new_hp = min(max_hp, heal_amount)
    remove_tokens = {_slugify(potion["name"]), potion["id"], potion["name"].lower()}
    new_inventory = [
        item for item in inventory if not _item_should_be_removed(item, remove_tokens)
    ]

    updated = {**state, "hp": new_hp, "inventory": new_inventory}
    return updated, {"auto_potion_used": True, "heal_amount": heal_amount}


def _flags_indicate_mission_complete(flags: dict, changes: Optional[dict]) -> bool:
    if flags.get("mission_complete") or flags.get("mission_target_defeated"):
        return True
    if flags.get("mission_object_obtained"):
        return True

    new_flags = (changes or {}).get("flags_set") or {}
    return bool(
        new_flags.get("mission_complete")
        or new_flags.get("mission_target_defeated")
        or new_flags.get("mission_object_obtained")
    )


def _inventory_has_target(state: dict, target: str) -> bool:
    needle = (target or "").lower().strip()
    if not needle:
        return False

    for item in state.get("inventory") or []:
        name = (item.get("name") or "").lower()
        if needle in name or name in needle:
            return True
    return False


def evaluate_mission_victory(
    mission: Optional[dict],
    node: dict,
    state: dict,
    state_changes: Optional[dict],
) -> bool:
    if not mission:
        return bool(state_changes and state_changes.get("node_complete") and node.get("isGoal"))

    mission_type = mission.get("type")
    flags = state.get("flags") or {}

    if mission_type == "slay":
        return _flags_indicate_mission_complete(flags, state_changes)

    if mission_type == "recover":
        if _flags_indicate_mission_complete(flags, state_changes):
            return True
        return _inventory_has_target(state, mission.get("target") or "")

    return False


def should_complete_reach_mission(mission: Optional[dict], node: dict) -> bool:
    if not mission or mission.get("type") != "reach":
        return False
    if not node.get("isGoal"):
        return False

    target_node_id = mission.get("targetNodeId")
    if target_node_id:
        return str(node.get("id")) == str(target_node_id)
    return True


def evaluate_adventure_end(
    mission: Optional[dict],
    node: dict,
    action: str,
    state: dict,
    result: dict,
    *,
    entered_goal_node: bool = False,
) -> Tuple[bool, Optional[str]]:
    """Return (should_end, reason) where reason is victory | early_exit | death."""
    if int(state.get("hp") or 0) <= 0:
        return True, "death"

    if result.get("end_adventure") and result.get("end_reason") == "early_exit":
        return True, "early_exit"
    if is_early_exit_action(action):
        return True, "early_exit"

    if entered_goal_node and should_complete_reach_mission(mission, node):
        return True, "victory"

    if evaluate_mission_victory(mission, node, state, result.get("state_changes")):
        return True, "victory"

    return False, None


def ensure_main_mission(raw_mission, nodes: list) -> dict:
    goal = next((n for n in nodes if n.get("isGoal")), None)

    if isinstance(raw_mission, dict) and raw_mission.get("type") in ("slay", "reach", "recover"):
        mission = dict(raw_mission)
        if not mission.get("targetNodeId") and goal:
            mission["targetNodeId"] = str(goal.get("id"))
        mission.setdefault("title", "Complete the main quest")
        mission.setdefault("target", goal.get("name") if goal else "Final objective")
        return mission

    if goal:
        boss = next(
            (
                elem
                for elem in (goal.get("content") or {}).get("elements") or []
                if elem.get("type") in ("boss", "monster")
            ),
            None,
        )
        if boss:
            return {
                "type": "slay",
                "title": f"Slay {boss.get('name', 'the guardian')}",
                "target": boss.get("name") or "the guardian",
                "targetNodeId": str(goal.get("id")),
            }

        key_item = next(
            (
                elem
                for elem in (goal.get("content") or {}).get("elements") or []
                if elem.get("type") in ("key_item", "reward", "item")
            ),
            None,
        )
        if key_item:
            return {
                "type": "recover",
                "title": f"Recover {key_item.get('name', 'the artifact')}",
                "target": key_item.get("name") or "the artifact",
                "targetNodeId": str(goal.get("id")),
            }

        return {
            "type": "reach",
            "title": f"Reach {goal.get('name', 'the destination')}",
            "target": goal.get("name") or "the destination",
            "targetNodeId": str(goal.get("id")),
        }

    return {
        "type": "reach",
        "title": "Complete the adventure",
        "target": "Final destination",
        "targetNodeId": None,
    }
