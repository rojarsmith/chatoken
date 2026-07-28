"""Check the documentation against the code it describes.

The restructure's failure mode is drift: a doc that names a dataset the registry
no longer has, a curl example whose settings no longer match the recommended
ones, or a link to a file that moved. This script catches all three.

Run from the project root:

    python scripts/check_docs.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "packages" / "llm_core"))

from apps.api.services.dataset_registry import build_dataset_registry  # noqa: E402
from llm_core.configs import MODEL_CONFIGS  # noqa: E402
from llm_core.gpt2 import GPT2_MODEL_SPECS  # noqa: E402


# Deliberate deviations from a dataset's recommended settings, with the reason.
# Anything not listed here is treated as drift.
INTENTIONAL_OVERRIDES = {
    ("16-streaming-cancel", "the-verdict"): (
        "Stage 16 starts a deliberately long job in order to cancel it, so it "
        "overrides max_steps and uses a throwaway output_model_id."
    ),
}

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
JOB_RE = re.compile(r'\\"dataset_id\\":\\"([a-z0-9\-]+)\\"(.{0,400})', re.S)


def main() -> int:
    problems: list[str] = []
    specs = build_dataset_registry(ROOT)
    known_models = (
        set(MODEL_CONFIGS)
        | {spec.model_id for spec in GPT2_MODEL_SPECS.values()}
        | {spec.output_model_id for spec in specs.values()}
    )

    docs = sorted(list(ROOT.glob("*.md")) + list((ROOT / "docs").rglob("*.md")))

    for doc in docs:
        text = doc.read_text(encoding="utf-8")
        stem = doc.name.replace(".zh-TW.md", "").replace(".md", "")

        # 1. Relative links resolve.
        for target in LINK_RE.findall(text):
            if target.startswith(("http://", "https://", "#")):
                continue
            path_part = target.split("#")[0]
            if path_part and not (doc.parent / path_part).resolve().exists():
                problems.append(f"{doc.relative_to(ROOT)}: broken link -> {target}")

        # 2. Training examples name real datasets, base models, and outputs.
        for match in JOB_RE.finditer(text):
            dataset_id, rest = match.group(1), match.group(2)
            spec = specs.get(dataset_id)
            if spec is None:
                problems.append(f"{doc.name}: unknown dataset_id {dataset_id!r}")
                continue

            override = INTENTIONAL_OVERRIDES.get((stem, dataset_id))

            base = re.search(r'\\"base_model_id\\":\\"([\w\-]+)\\"', rest)
            if base and base.group(1) not in known_models:
                problems.append(f"{doc.name}: unknown base_model_id {base.group(1)!r}")

            if override:
                continue

            for field, expected in (
                ("max_steps", spec.recommended_steps),
                ("batch_size", spec.recommended_batch_size),
                ("block_size", spec.recommended_block_size),
                ("learning_rate", spec.recommended_learning_rate),
            ):
                found = re.search(rf'\\"{field}\\":([0-9.e\-]+)', rest)
                if found and abs(float(found.group(1)) - expected) > 1e-9:
                    problems.append(
                        f"{doc.name}: {dataset_id} {field}={found.group(1)} "
                        f"but the registry recommends {expected:g}"
                    )

            out = re.search(r'\\"output_model_id\\":\\"([\w\-]+)\\"', rest)
            if out and out.group(1) != spec.output_model_id:
                problems.append(
                    f"{doc.name}: {dataset_id} output_model_id={out.group(1)!r} "
                    f"but the registry says {spec.output_model_id!r}"
                )

    # 3. Every stage document has both languages and the switch line.
    for doc in sorted((ROOT / "docs" / "stages").glob("*.md")):
        if doc.name.endswith(".zh-TW.md"):
            continue
        partner = doc.with_name(doc.name.replace(".md", ".zh-TW.md"))
        if not partner.exists():
            problems.append(f"{doc.name}: missing 繁體中文 version")
        head = doc.read_text(encoding="utf-8").split("\n", 4)
        if not any("[English](" in line and "[繁體中文](" in line for line in head):
            problems.append(f"{doc.name}: missing the language switch line")

    if problems:
        print(f"docs check FAILED with {len(problems)} problem(s):\n")
        for problem in sorted(set(problems)):
            print(f"  - {problem}")
        return 1

    print(
        f"docs check OK: {len(docs)} documents, links resolve, "
        f"training examples match the registry for {len(specs)} datasets"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
