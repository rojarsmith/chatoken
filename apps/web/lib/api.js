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

export const api = {
  health: (baseUrl) => request(baseUrl, "/health"),
  models: (baseUrl) => request(baseUrl, "/models"),
  chat: (baseUrl, body) =>
    request(baseUrl, "/chat", { method: "POST", body: JSON.stringify(body) }),
  promptPreview: (baseUrl, body) =>
    request(baseUrl, "/chat/prompt-preview", { method: "POST", body: JSON.stringify(body) })
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
