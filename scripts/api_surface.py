"""Dump the API surface as a stable, comparable snapshot.

Phase 5 of the restructure splits main.py into routers. The contract for that
work is that no endpoint path, method, or request/response schema changes, so
this script captures the surface before and after and the two dumps must match.

    python scripts/api_surface.py > before.json
    ... refactor ...
    python scripts/api_surface.py > after.json
    python -c "import sys;a=open('before.json').read();b=open('after.json').read();sys.exit(a!=b)"
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "packages" / "llm_core"))

from apps.api.main import app  # noqa: E402


def main() -> None:
    spec = app.openapi()

    surface = {}
    for path, operations in sorted(spec["paths"].items()):
        for method, operation in sorted(operations.items()):
            key = f"{method.upper()} {path}"
            surface[key] = {
                "parameters": sorted(
                    (p["name"], p["in"], p.get("required", False))
                    for p in operation.get("parameters", [])
                ),
                "requestBody": _ref_of(operation.get("requestBody")),
                "responses": {
                    code: _ref_of(body)
                    for code, body in sorted(operation.get("responses", {}).items())
                },
            }

    schemas = {
        name: _normalise_schema(schema)
        for name, schema in sorted(spec.get("components", {}).get("schemas", {}).items())
    }

    print(json.dumps({"endpoints": surface, "schemas": schemas}, indent=2, sort_keys=True))


def _ref_of(node) -> object:
    """Reduce a request/response node to the schema it points at."""
    if not node:
        return None
    content = node.get("content") or {}
    for media_type, media in sorted(content.items()):
        schema = media.get("schema") or {}
        return {"media_type": media_type, "schema": schema}
    return {"description": node.get("description")}


def _normalise_schema(schema: dict) -> dict:
    """Keep the parts a client depends on: field names, types, and requirements."""
    return {
        "type": schema.get("type"),
        "required": sorted(schema.get("required", [])),
        "properties": {
            name: {
                "type": prop.get("type"),
                "default": prop.get("default"),
                "anyOf": prop.get("anyOf"),
                "enum": prop.get("enum"),
                "maximum": prop.get("maximum"),
                "minimum": prop.get("minimum"),
                "exclusiveMinimum": prop.get("exclusiveMinimum"),
                "maxLength": prop.get("maxLength"),
                "minLength": prop.get("minLength"),
            }
            for name, prop in sorted(schema.get("properties", {}).items())
        },
    }


if __name__ == "__main__":
    main()
