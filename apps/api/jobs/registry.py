"""One job lifecycle, shared by chat, training, and pretrained work.

Before Phase 5 there were three near-identical implementations of this file's
contents inside main.py — three dataclasses, three runners, three updaters,
three cancellers and three locks — differing only in the noun in their error
messages. They are one thing, so they are now one thing.

Cancellation is cooperative by design (see Stage 16): the registry records the
request, and the worker stops at its next safe checkpoint.
"""

from __future__ import annotations

from concurrent.futures import CancelledError, Executor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Callable, Literal
from uuid import uuid4


JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class JobRecord:
    job_id: str
    status: JobStatus
    created_at: str
    updated_at: str
    request: dict
    progress: list[dict] = field(default_factory=list)
    result: dict | None = None
    error: str | None = None
    cancel_requested: bool = False


class JobRegistry:
    """Tracks jobs of one kind and runs them on a shared executor.

    `tracks_progress` exists because chat jobs never reported a `progress` list
    and clients rely on the payload shape staying exactly as it was.
    """

    def __init__(self, name: str, executor: Executor, *, tracks_progress: bool = True) -> None:
        self._name = name
        self._executor = executor
        self._tracks_progress = tracks_progress
        self._jobs: dict[str, JobRecord] = {}
        self._lock = Lock()

    @property
    def not_found_detail(self) -> str:
        return f"{self._name} job not found"

    def submit(self, request: Any, work: Callable[[str, Any], dict]) -> dict:
        """Create a queued job and hand `work` to the executor.

        `work` receives (job_id, request) and returns the result payload. Raising
        CancelledError marks the job cancelled; any other exception marks it failed.
        """
        job_id = str(uuid4())
        now = utc_now()
        record = JobRecord(
            job_id=job_id,
            status="queued",
            created_at=now,
            updated_at=now,
            request=request.model_dump() if hasattr(request, "model_dump") else dict(request),
        )
        with self._lock:
            self._jobs[job_id] = record

        self._executor.submit(self._run, job_id, request, work)
        return self.to_dict(record)

    def _run(self, job_id: str, request: Any, work: Callable[[str, Any], dict]) -> None:
        if self.cancel_requested(job_id):
            self.update(job_id, status="cancelled", error="Cancelled by user.")
            return

        self.update(job_id, status="running")
        try:
            result = work(job_id, request)
            if self.cancel_requested(job_id):
                raise CancelledError(f"{self._name} job cancelled.")
            self.update(job_id, status="succeeded", result=result)
        except CancelledError:
            self.update(job_id, status="cancelled", error="Cancelled by user.")
        except Exception as exc:  # noqa: BLE001 - surfaced to the client as job.error
            self.update(job_id, status="failed", error=str(exc))

    def update(
        self,
        job_id: str,
        status: JobStatus,
        result: dict | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            record = self._jobs[job_id]
            record.status = status
            record.updated_at = utc_now()
            record.result = result
            record.error = error

    def append_progress(self, job_id: str, event: dict) -> None:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None:
                return
            record.progress.append(event)
            record.updated_at = utc_now()

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            record = self._jobs.get(job_id)
            return self.to_dict(record) if record else None

    def cancel(self, job_id: str) -> dict | None:
        with self._lock:
            record = self._jobs.get(job_id)
            if record is None:
                return None
            record.cancel_requested = True
            record.updated_at = utc_now()
            # A queued job never started, so it can stop immediately. A running
            # one has to reach its next checkpoint.
            if record.status == "queued":
                record.status = "cancelled"
                record.error = "Cancelled by user."
            return self.to_dict(record)

    def cancel_requested(self, job_id: str) -> bool:
        with self._lock:
            record = self._jobs.get(job_id)
            return bool(record and record.cancel_requested)

    def to_dict(self, record: JobRecord) -> dict:
        payload = asdict(record)
        if not self._tracks_progress:
            payload.pop("progress")
        return payload
