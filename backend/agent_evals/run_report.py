"""Print a human-readable offline agent evaluation report (no LLM calls)."""

import json
from pathlib import Path

from agent_evals.schemas import (
    validate_adventure_critic,
    validate_dm_action,
    validate_world_architect,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"

CASES = [
    ("World Architect", "world_architect_good.json", validate_world_architect, True),
    ("World Architect (bad sample)", "world_architect_bad.json", validate_world_architect, False),
    ("Dungeon Master action", "dm_action_good.json", validate_dm_action, True),
    ("Adventure Critic", "critic_good.json", validate_adventure_critic, True),
]


def main() -> int:
    print("=== Agent Evaluation Report (offline fixtures) ===\n")
    failed = 0

    for label, filename, validator, should_pass in CASES:
        data = json.loads((FIXTURES / filename).read_text(encoding="utf-8"))
        errors = validator(data)
        passed = len(errors) == 0
        ok = passed == should_pass
        status = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        detail = "no issues" if not errors else "; ".join(errors)
        print(f"[{status}] {label} ({filename})")
        print(f"       expected valid={should_pass}, errors: {detail}\n")

    if failed:
        print(f"Result: {failed} case(s) unexpected.")
        return 1

    print("Result: all evaluation cases behaved as expected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
