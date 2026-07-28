"""Deciding whether two training runs may be compared at all — Stage 14.

Extracted from training_service.py in Phase 5. These functions are pure: they
take two experiment records and return the sameness summary, the metric deltas,
and the notes explaining what any mismatch invalidates.
"""

from __future__ import annotations


def _compare_experiments(left: dict, right: dict) -> dict:
    same = {
        "prompt": (
            (left.get("comparison_prompt") or left.get("sample_prompt"))
            == (right.get("comparison_prompt") or right.get("sample_prompt"))
        ),
        "dataset": left.get("dataset_id") == right.get("dataset_id"),
        "base_model": left.get("base_model_id") == right.get("base_model_id"),
        "objective": left.get("training_objective")
        == right.get("training_objective"),
        "tuning": (left.get("tuning_method") or "full")
        == (right.get("tuning_method") or "full"),
    }
    deltas = {
        "final_loss": _metric_delta(left, right, "final_loss", prefer="lower"),
        "tokens_seen": _metric_delta(left, right, "tokens_seen"),
        "max_steps": _metric_delta(left, right, "max_steps"),
        "dataset_tokens": _metric_delta(left, right, "dataset_tokens"),
        "trainable_percent": _metric_delta(left, right, "trainable_percent"),
        "examples_used_for_training": _metric_delta(
            left,
            right,
            "examples_used_for_training",
        ),
    }
    return {
        "left_id": left.get("experiment_id"),
        "right_id": right.get("experiment_id"),
        "left_version": _experiment_version(left),
        "right_version": _experiment_version(right),
        "same": same,
        "deltas": deltas,
        "notes": _comparison_notes(same, deltas),
    }


def _experiment_version(experiment: dict) -> dict:
    return {
        "model_id": experiment.get("output_model_id"),
        "checkpoint_id": experiment.get("checkpoint_id"),
        "version_id": experiment.get("model_version_id"),
        "version_label": experiment.get("model_version_label"),
        "lineage": experiment.get("lineage"),
    }


def _metric_delta(
    left: dict,
    right: dict,
    key: str,
    *,
    prefer: str | None = None,
) -> dict:
    left_value = _as_number(left.get(key))
    right_value = _as_number(right.get(key))
    if left_value is None or right_value is None:
        return {
            "left": left.get(key),
            "right": right.get(key),
            "delta": None,
            "status": "unknown",
        }

    delta = right_value - left_value
    status = "same"
    if delta != 0:
        status = "changed"
        if prefer == "lower":
            status = "better" if delta < 0 else "worse"
        elif prefer == "higher":
            status = "better" if delta > 0 else "worse"

    return {
        "left": left_value,
        "right": right_value,
        "delta": delta,
        "status": status,
    }


def _comparison_notes(same: dict, deltas: dict) -> list[str]:
    notes = []
    notes.append(
        "The comparison prompt matches."
        if same["prompt"]
        else "The comparison prompts differ; output comparison is less controlled."
    )
    if not same["dataset"]:
        notes.append("The two runs used different datasets.")
    if not same["base_model"]:
        notes.append("The two runs started from different base models.")
    if not same["tuning"]:
        notes.append("The two runs used different tuning methods.")

    loss_status = deltas["final_loss"]["status"]
    if loss_status == "better":
        notes.append("The right experiment has lower final loss.")
    elif loss_status == "worse":
        notes.append("The right experiment has higher final loss.")
    return notes


def _as_number(value: object) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except ValueError:
        return None
