"""Process-wide singletons shared by every router.

All state here lives in memory on purpose: loaded models, conversations, and job
records vanish when the API restarts. Only checkpoints, downloads, datasets, and
the experiment log are on disk. That is a teaching decision, documented in
docs/stages/15-conversation-memory.md, not an oversight.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from apps.api.services import device_service
from apps.api.jobs.registry import JobRegistry
from apps.api.services.chat_service import ChatService
from apps.api.services.conversation_service import ConversationService
from apps.api.services.deployment_service import DeploymentService
from apps.api.services.external_model_service import ExternalModelService
from apps.api.services.pretrained_service import PretrainedService
from apps.api.services.training_service import TrainingService


chat_service = ChatService()
training_service = TrainingService(chat_service)
pretrained_service = PretrainedService(chat_service)
external_model_service = ExternalModelService()
deployment_service = DeploymentService(chat_service)
conversation_service = ConversationService(chat_service)

# One worker, deliberately: training and download progress stays observable
# while learning, and the resource estimate in Stage 17 can assume it.
executor = ThreadPoolExecutor(max_workers=1)

chat_jobs = JobRegistry("Chat", executor, tracks_progress=False)
training_jobs = JobRegistry("Training", executor)
pretrained_jobs = JobRegistry("Pretrained", executor)


def runtime_info() -> dict:
    """Runtime shape for /health and the deployment profile.

    Delegates to device_service so the reported device is the one work will
    actually run on, including a forced CPU or CUDA preference.
    """
    described = device_service.describe()
    return {
        "torch_version": described["torch_version"],
        "device": described["device"],
        "cuda_available": described["cuda_available"],
        "cuda_version": described["cuda_version"],
        "device_count": described["device_count"],
        "device_name": described["device_name"],
        "device_preference": described["preference"],
    }
