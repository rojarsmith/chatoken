export const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export function normalizeBaseUrl(baseUrl) {
  return (baseUrl || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        detail = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
      }
    } catch {
      // Response had no JSON body; keep the status text.
    }
    throw new ApiError(detail, response.status);
  }

  return response.json();
}

const post = (baseUrl, path, body) =>
  request(baseUrl, path, { method: "POST", body: JSON.stringify(body ?? {}) });

export const api = {
  health: (baseUrl) => request(baseUrl, "/health"),
  models: (baseUrl) => request(baseUrl, "/models"),
  device: (baseUrl) => request(baseUrl, "/runtime/device"),
  setDevice: (baseUrl, preference) => post(baseUrl, "/runtime/device", { preference }),
  chat: (baseUrl, body) => post(baseUrl, "/chat", body),
  promptPreview: (baseUrl, body) => post(baseUrl, "/chat/prompt-preview", body),

  // Stage 04 · 05 · 06 — training
  datasets: (baseUrl) => request(baseUrl, "/training/datasets"),
  prepareDataset: (baseUrl, datasetId) =>
    post(baseUrl, `/training/datasets/${datasetId}/prepare`),
  createTrainingJob: (baseUrl, body) => post(baseUrl, "/training/jobs", body),
  trainingJob: (baseUrl, jobId) => request(baseUrl, `/training/jobs/${jobId}`),
  cancelTrainingJob: (baseUrl, jobId) => post(baseUrl, `/training/jobs/${jobId}/cancel`),

  // Stage 07 — checkpoints
  checkpoints: (baseUrl) => request(baseUrl, "/checkpoints"),
  loadModel: (baseUrl, body) => post(baseUrl, "/models/load", body),

  // Stage 08 — pretrained GPT-2
  pretrainedModels: (baseUrl) => request(baseUrl, "/pretrained/models"),
  createPretrainedJob: (baseUrl, body) => post(baseUrl, "/pretrained/jobs", body),
  pretrainedJob: (baseUrl, jobId) => request(baseUrl, `/pretrained/jobs/${jobId}`),
  cancelPretrainedJob: (baseUrl, jobId) => post(baseUrl, `/pretrained/jobs/${jobId}/cancel`),

  // Stage 13 — dataset builder
  datasetBuilder: (baseUrl) => request(baseUrl, "/training/dataset-builder"),
  seedDatasetBuilder: (baseUrl) => post(baseUrl, "/training/dataset-builder/seed"),
  addBuilderExample: (baseUrl, body) =>
    post(baseUrl, "/training/dataset-builder/examples", body),
  updateBuilderExample: (baseUrl, exampleId, body) =>
    request(baseUrl, `/training/dataset-builder/examples/${exampleId}`, {
      method: "PUT",
      body: JSON.stringify(body)
    }),
  deleteBuilderExample: (baseUrl, exampleId) =>
    request(baseUrl, `/training/dataset-builder/examples/${exampleId}`, { method: "DELETE" }),

  // Stage 14 — experiments
  experiments: (baseUrl) => request(baseUrl, "/training/experiments"),
  compareExperiments: (baseUrl, leftId, rightId) =>
    request(
      baseUrl,
      `/training/experiments/compare?left_id=${encodeURIComponent(leftId)}&right_id=${encodeURIComponent(rightId)}`
    ),

  // Stage 15 — conversations
  conversations: (baseUrl) => request(baseUrl, "/conversations"),
  createConversation: (baseUrl, body) => post(baseUrl, "/conversations", body),
  conversation: (baseUrl, id) => request(baseUrl, `/conversations/${id}`),
  deleteConversation: (baseUrl, id) =>
    request(baseUrl, `/conversations/${id}`, { method: "DELETE" }),
  previewConversationContext: (baseUrl, id, body) =>
    post(baseUrl, `/conversations/${id}/context-preview`, body),
  sendConversationMessage: (baseUrl, id, body) =>
    post(baseUrl, `/conversations/${id}/messages`, body),

  // Stage 16 — cancellation
  cancelChatJob: (baseUrl, jobId) => post(baseUrl, `/chat/jobs/${jobId}/cancel`),
  createChatJob: (baseUrl, body) => post(baseUrl, "/chat/jobs", body),
  chatJob: (baseUrl, jobId) => request(baseUrl, `/chat/jobs/${jobId}`),

  // Stage 17 — deployment
  deploymentProfile: (baseUrl) => request(baseUrl, "/deployment/profile"),
  deploymentEstimate: (baseUrl, body) => post(baseUrl, "/deployment/estimate", body),

  // Track T1 — external providers
  externalModels: (baseUrl) => request(baseUrl, "/external/models"),
  externalPromptPreview: (baseUrl, body) => post(baseUrl, "/external/prompt-preview", body),
  externalChat: (baseUrl, body) => post(baseUrl, "/external/chat", body)
};

export const JOB_ENDPOINTS = {
  training: {
    create: api.createTrainingJob,
    get: api.trainingJob,
    cancel: api.cancelTrainingJob
  },
  pretrained: {
    create: api.createPretrainedJob,
    get: api.pretrainedJob,
    cancel: api.cancelPretrainedJob
  }
};

/**
 * Reads the newline-delimited JSON event stream from POST /chat/stream.
 * Calls onEvent for every parsed event; returns the final "done" result.
 */
export async function streamChat(baseUrl, body, { onEvent, signal } = {}) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok || !response.body) {
    throw new ApiError(`Stream failed: ${response.status} ${response.statusText}`, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      onEvent?.(event);
      if (event.event === "done") result = event.result ?? null;
    }
  }

  return result;
}
