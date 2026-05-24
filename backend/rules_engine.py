import random
import re
import copy
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


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def roll_2d4_plus_2() -> int:
    return sum(random.randint(1, 4) for _ in range(2)) + 2


CONSUME_VERBS = re.compile(
    r"\b(drink|consume|use|quaff|swig|gulp|imbibe|down)\b", re.IGNORECASE
)
PICKUP_VERBS = re.compile(
    r"\b(take|pick up|pickup|grab|collect|loot|pocket|stow)\b", re.IGNORECASE
)
DROP_VERBS = re.compile(
    r"\b(drop|discard|throw away|leave behind|toss)\b", re.IGNORECASE
)
DEBUFF_KEYWORDS = {
    "burning",
    "poisoned",
    "bleeding",
    "stunned",
    "frightened",
    "cursed",
    "paralyzed",
    "blinded",
}


def _empty_state_changes() -> dict:
    return {
        "hp_delta": 0,
        "inventory_add": [],
        "inventory_remove": [],
        "status_effects_add": [],
        "status_effects_remove": [],
        "flags_set": {},
        "flags_unset": [],
        "node_complete": False,
    }


def _coerce_state_changes(dm_changes: Optional[dict]) -> dict:
    changes = _empty_state_changes()
    if not dm_changes:
        return changes
    for key in changes:
        if key in dm_changes and dm_changes[key] is not None:
            changes[key] = dm_changes[key]
    return changes


def _find_inventory_item(inventory: list, *needles: str) -> Optional[dict]:
    for item in inventory:
        name = (item.get("name") or "").lower()
        item_id = (item.get("id") or "").lower()
        for needle in needles:
            n = needle.lower()
            if n in name or n in item_id or name in n:
                return _normalize_inventory_item(item)
    return None


def _remove_list_includes(removes: list, item: dict) -> bool:
    for raw in removes:
        token = (
            raw.get("name", raw.get("id", "")).lower()
            if isinstance(raw, dict)
            else str(raw).lower()
        )
        if token == item["name"].lower() or token == item["id"]:
            return True
        if token in item["name"].lower() or _slugify(token) == item["id"]:
            return True
    return False


def _collect_remove_tokens(removes: list) -> set:
    tokens = set()
    for raw in removes or []:
        if isinstance(raw, dict):
            if raw.get("id"):
                tokens.add(_slugify(str(raw["id"])))
                tokens.add(str(raw["id"]).lower())
            if raw.get("name"):
                tokens.add(str(raw["name"]).lower())
                tokens.add(_slugify(str(raw["name"])))
        else:
            tokens.add(str(raw).lower())
            tokens.add(_slugify(str(raw)))
    return tokens


def _item_should_be_removed(item: dict, remove_tokens: set) -> bool:
    item_id = item["id"]
    item_name = item["name"].lower()
    for token in remove_tokens:
        if token == item_id or token == item_name:
            return True
        if token in item_name or item_name in token:
            return True
        if _slugify(token) == item_id:
            return True
    return False


def reconcile_state_changes(
    action: str,
    game_state: dict,
    dm_changes: Optional[dict],
) -> dict:
    """Rules Engine: merge DM proposals with deterministic item/effect logic."""
    changes = _coerce_state_changes(dm_changes)
    action_lower = action.lower()
    inventory = [_normalize_inventory_item(item) for item in (game_state.get("inventory") or [])]

    if CONSUME_VERBS.search(action) and "potion" in action_lower:
        potion = _find_inventory_item(inventory, "healing potion", "healing-potion", "potion")
        if potion:
            removes = list(changes.get("inventory_remove") or [])
            if not _remove_list_includes(removes, potion):
                removes.append(potion["name"])
            changes["inventory_remove"] = removes
            if (changes.get("hp_delta") or 0) <= 0:
                changes["hp_delta"] = roll_2d4_plus_2()

    if DROP_VERBS.search(action):
        for item in inventory:
            item_name = item["name"].lower()
            if item_name in action_lower or item["id"].replace("-", " ") in action_lower:
                removes = list(changes.get("inventory_remove") or [])
                if not _remove_list_includes(removes, item):
                    removes.append(item["name"])
                changes["inventory_remove"] = removes
                break

    if PICKUP_VERBS.search(action) and changes.get("inventory_add"):
        pass

    return changes


def _normalize_inventory_item(item) -> dict:
    if isinstance(item, str):
        return {
            "id": _slugify(item),
            "name": item,
            "description": "",
            "icon": "package",
        }
    item_id = item.get("id") or _slugify(item.get("name", "item"))
    return {
        "id": item_id,
        "name": item.get("name", item_id),
        "description": item.get("description", ""),
        "icon": item.get("icon", "package"),
    }


def _normalize_status_effect(effect) -> dict:
    if isinstance(effect, str):
        effect_id = _slugify(effect)
        effect_type = "debuff" if effect_id in DEBUFF_KEYWORDS or effect.lower() in DEBUFF_KEYWORDS else "buff"
        return {
            "id": effect_id,
            "name": effect,
            "description": "",
            "type": effect_type,
        }
    effect_id = effect.get("id") or _slugify(effect.get("name", "effect"))
    effect_type = effect.get("type")
    if not effect_type:
        effect_type = "debuff" if effect_id in DEBUFF_KEYWORDS else "buff"
    return {
        "id": effect_id,
        "name": effect.get("name", effect_id),
        "description": effect.get("description", ""),
        "type": effect_type,
    }


def create_initial_game_state(character: dict) -> dict:
    con_mod = get_ability_modifier(character, "CON")
    dex_mod = get_ability_modifier(character, "DEX")
    level = 5
    max_hp = max(1, 10 + (level - 1) * (6 + con_mod) + con_mod)
    ac = 10 + dex_mod + 2

    race = (character.get("race") or "").lower()
    status_effects = []
    if "elf" in race or "drow" in race or "dwarf" in race:
        status_effects.append(
            {
                "id": "darkvision",
                "name": "Darkvision",
                "description": "You can see in dim light within 60 feet.",
                "type": "buff",
            }
        )

    return {
        "hp": max_hp,
        "max_hp": max_hp,
        "ac": ac,
        "level": level,
        "inventory": [
            {
                "id": "travelers-blade",
                "name": "Traveler's Blade",
                "description": "A worn but reliable sword.",
                "icon": "sword",
            },
            {
                "id": "healing-potion",
                "name": "Healing Potion",
                "description": "Restores 2d4+2 HP when consumed.",
                "icon": "heart",
            },
        ],
        "status_effects": status_effects,
        "flags": {},
    }


def apply_state_changes(changes: Optional[dict], game_state: dict) -> dict:
    if not changes:
        return copy.deepcopy(game_state)

    state = copy.deepcopy(game_state)

    hp_delta = int(changes.get("hp_delta") or 0)
    if hp_delta != 0:
        max_hp = int(state.get("max_hp") or 1)
        state["hp"] = max(0, min(max_hp, int(state.get("hp") or 0) + hp_delta))

    inventory = [_normalize_inventory_item(item) for item in (state.get("inventory") or [])]
    existing_ids = {item["id"] for item in inventory}
    existing_names = {item["name"].lower() for item in inventory}

    for raw_item in changes.get("inventory_add") or []:
        item = _normalize_inventory_item(raw_item)
        if item["id"] in existing_ids or item["name"].lower() in existing_names:
            continue
        inventory.append(item)
        existing_ids.add(item["id"])
        existing_names.add(item["name"].lower())

    remove_tokens = _collect_remove_tokens(changes.get("inventory_remove"))
    inventory = [
        item
        for item in inventory
        if not _item_should_be_removed(item, remove_tokens)
    ]
    state["inventory"] = inventory

    effects = [_normalize_status_effect(effect) for effect in (state.get("status_effects") or [])]
    effect_ids = {effect["id"] for effect in effects}
    effect_names = {effect["name"].lower() for effect in effects}

    for raw_effect in changes.get("status_effects_add") or []:
        effect = _normalize_status_effect(raw_effect)
        if effect["id"] in effect_ids or effect["name"].lower() in effect_names:
            continue
        effects.append(effect)
        effect_ids.add(effect["id"])
        effect_names.add(effect["name"].lower())

    remove_effect_tokens = _collect_remove_tokens(changes.get("status_effects_remove"))
    effects = [
        effect
        for effect in effects
        if not _item_should_be_removed(
            {"id": effect["id"], "name": effect["name"]},
            remove_effect_tokens,
        )
    ]
    state["status_effects"] = effects

    flags = dict(state.get("flags") or {})
    flags.update(changes.get("flags_set") or {})
    for key in changes.get("flags_unset") or []:
        flags.pop(key, None)
    state["flags"] = flags

    return state
