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

    # 3. Code maps point at files that still define the symbols they name.
    problems.extend(_check_code_maps(docs))

    # 4. Every stage document has both languages and the switch line.
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


CODE_MAP_RE = re.compile(r"^## Code map\n(.*?)(?=\n## |\Z)", re.S | re.M)
PY_FILE_RE = re.compile(r"`?([\w\-]+\.py)`?")
SYMBOL_RE = re.compile(r"`([A-Za-z_]\w*)`")


def _symbol_index() -> dict[str, set[str]]:
    """Every top-level definition, constant, field, and attribute, by repo path.

    Keyed by path rather than bare filename: `routers/chat.py` and
    `schemas/chat.py` both end in chat.py, and conflating them would let a wrong
    code-map row pass.
    """
    index: dict[str, set[str]] = {}
    sources = [
        p
        for p in list((ROOT / "apps").rglob("*.py")) + list((ROOT / "packages").rglob("*.py"))
        if "__pycache__" not in str(p)
    ]
    patterns = (
        r"^(?:def|class)\s+(\w+)",           # functions and classes
        r"^(\w+)(?::\s*[^=]+)?\s*=",         # module constants
        r"^\s{4}(\w+):\s*[\w\[\]|\. ]+",     # dataclass fields
        r"self\.(\w+)\s*=",                  # instance attributes
    )
    for path in sources:
        text = path.read_text(encoding="utf-8")
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.M):
                index.setdefault(match.group(1), set()).add(
                    path.relative_to(ROOT).as_posix()
                )
    return index


def _check_code_maps(docs: list[Path]) -> list[str]:
    """A stage's Code map is its reader's route into the source. If the code moves
    and the map does not, the stage quietly stops being followable — which is what
    happened to fifteen of these when Phase 5 split main.py."""
    index = _symbol_index()
    problems: list[str] = []

    for doc in docs:
        match = CODE_MAP_RE.search(doc.read_text(encoding="utf-8"))
        if not match:
            continue
        for line in match.group(1).split("\n"):
            if not line.startswith("|") or "---" in line:
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) < 2 or cells[0] in ("What", "內容"):
                continue

            where = cells[-1]

            # Prefer the link target: it is an exact path, unlike a bare filename.
            targets = set()
            for target in re.findall(r"\]\(([^)]+\.py)\)", where):
                resolved = (doc.parent / target).resolve()
                if resolved.exists():
                    targets.add(resolved.relative_to(ROOT).as_posix())
            if not targets:
                # No link — fall back to matching on filename alone.
                names = set(PY_FILE_RE.findall(where))
                if not names:
                    continue
                targets = {p for paths in index.values() for p in paths
                           if p.split("/")[-1] in names}
                if not targets:
                    continue

            for symbol in SYMBOL_RE.findall(where):
                if symbol not in index:
                    continue
                if not (index[symbol] & targets):
                    problems.append(
                        f"{doc.name}: code map says `{symbol}` is in "
                        f"{sorted(targets)}, but it is defined in {sorted(index[symbol])}"
                    )
    return problems


if __name__ == "__main__":
    sys.exit(main())
