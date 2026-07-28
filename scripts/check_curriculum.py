"""Verify that curriculum.json, the documentation, and the web console agree.

curriculum.json is the single source of truth for the course (decision D4 in
docs/restructure-plan.md). This script fails loudly when the three surfaces
drift apart, which is the failure mode the restructure exists to prevent.

Run from the project root:

    python scripts/check_curriculum.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CURRICULUM = ROOT / "curriculum.json"
STAGE_DOCS = ROOT / "docs" / "stages"
CONTENT_INDEX = ROOT / "apps" / "web" / "content" / "stages" / "index.js"


def main() -> int:
    problems: list[str] = []
    data = json.loads(CURRICULUM.read_text(encoding="utf-8"))

    stages = data["stages"]
    parts = data["parts"]
    stage_ids = [stage["id"] for stage in stages]
    stage_by_id = {stage["id"]: stage for stage in stages}

    # 1. Stage ids are unique and numbered in order, starting at 1.
    if len(set(stage_ids)) != len(stage_ids):
        problems.append("duplicate stage ids in curriculum.json")
    for index, stage in enumerate(stages, start=1):
        if stage["number"] != index:
            problems.append(
                f"{stage['id']}: number is {stage['number']}, expected {index}"
            )
        if not stage["id"].startswith(f"{index:02d}-"):
            problems.append(f"{stage['id']}: id should start with {index:02d}-")

    # 2. Parts and stages point at each other consistently.
    listed_in_parts: list[str] = []
    for part in parts:
        for stage_id in part["stages"]:
            listed_in_parts.append(stage_id)
            stage = stage_by_id.get(stage_id)
            if stage is None:
                problems.append(f"part {part['id']}: unknown stage {stage_id}")
            elif stage["part"] != part["id"]:
                problems.append(
                    f"{stage_id}: part is {stage['part']}, but listed under {part['id']}"
                )
    if listed_in_parts != stage_ids:
        problems.append("part stage lists do not cover every stage in order")

    # 3. Prerequisites exist and never point forward.
    for stage in stages:
        for required in stage["requires"]:
            if required not in stage_by_id:
                problems.append(f"{stage['id']}: unknown prerequisite {required}")
            elif stage_by_id[required]["number"] >= stage["number"]:
                problems.append(f"{stage['id']}: prerequisite {required} is not earlier")

    # 4. Both language documents exist for every stage, track, and reference entry.
    for entry in stages + data["tracks"] + data["reference"]:
        for key in ("doc", "docZh"):
            path = ROOT / entry[key]
            if not path.exists():
                problems.append(f"{entry['id']}: missing {entry[key]}")

    # 5. No orphan stage documents.
    expected_docs = {stage["doc"] for stage in stages} | {stage["docZh"] for stage in stages}
    for path in sorted(STAGE_DOCS.glob("*.md")):
        relative = path.relative_to(ROOT).as_posix()
        if relative not in expected_docs:
            problems.append(f"orphan document not in curriculum.json: {relative}")

    # 6. Every stage marked implemented is wired into the web console.
    index_source = CONTENT_INDEX.read_text(encoding="utf-8")
    wired = set(re.findall(r'"([\w-]+)":\s*s\d+', index_source))
    for stage in stages:
        if stage["implemented"] and stage["id"] not in wired:
            problems.append(f"{stage['id']}: implemented but not in content/stages/index.js")
        if not stage["implemented"] and stage["id"] in wired:
            problems.append(f"{stage['id']}: wired into the console but marked not implemented")

    # 7. The legacy console is gone, so every stage must be wired into the ladder.
    for stage in stages:
        if not stage["implemented"]:
            problems.append(
                f"{stage['id']}: not implemented, and there is no legacy console to fall back to"
            )

    if problems:
        print(f"curriculum check FAILED with {len(problems)} problem(s):\n")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    implemented = sum(1 for stage in stages if stage["implemented"])
    print(
        f"curriculum check OK: {len(stages)} stages in {len(parts)} parts, "
        f"{implemented} wired into the console, "
        f"{2 * (len(stages) + len(data['tracks']) + len(data['reference']))} documents present"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
