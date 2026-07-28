export function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US");
}

export function formatRuntimeLabel(runtime) {
  if (!runtime) return "Runtime unknown";
  if (runtime.cuda_available) return runtime.device_name || "CUDA device";
  return "CPU only";
}

export function formatRuntimeTitle(runtime) {
  if (!runtime) return "";
  const parts = [`torch ${runtime.torch_version}`, `device ${runtime.device}`];
  if (runtime.cuda_version) parts.push(`cuda ${runtime.cuda_version}`);
  return parts.join(" · ");
}

/**
 * Mirrors llm_core.tokenizer.ByteTokenizer: one UTF-8 byte per token,
 * with id 256 reserved for end-of-sequence.
 */
export const BYTE_EOS_ID = 256;
export const BYTE_VOCAB_SIZE = 257;

export function byteEncode(text) {
  return Array.from(new TextEncoder().encode(text));
}

export function byteDecode(ids) {
  const bytes = Uint8Array.from(ids.filter((id) => id >= 0 && id <= 255));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Matches Python's errors="backslashreplace" closely enough to teach the point:
    // invalid UTF-8 comes back visible instead of throwing.
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Mirrors llm_core.generation.prepare_chat_prompt for the built-in styles. */
export function renderPrompt(message, style = "chat") {
  if (style === "raw") return message;
  if (style === "instruction") {
    return (
      "Below is an instruction that describes a task. " +
      "Write a response that appropriately completes the request." +
      `\n\n### Instruction:\n${message}` +
      "\n\n### Response:"
    );
  }
  return `User: ${message}\nAssistant:`;
}

// Control characters, excluding \n (0x0a) which renders fine inside <pre>.
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F]/g;

/**
 * Makes invisible control characters visible without touching anything else.
 *
 * The API already decoded invalid UTF-8 with errors="backslashreplace", so the
 * reply arrives containing literal "\xNN" text. Escaping the string again (for
 * example with JSON.stringify) would double every backslash and misreport what
 * the tokenizer actually produced.
 */
export function escapeForDisplay(text) {
  if (typeof text !== "string") return "";
  return text.replace(CONTROL_CHARS, (char) => {
    if (char === "\t") return "\\t";
    if (char === "\r") return "\\r";
    return `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}
