"use client";

import { useMemo } from "react";

import { useConsole } from "../layout/ConsoleShell";
import { byteEncode, formatNumber, renderPrompt } from "../../lib/format";

const TRANSFORMER_BLOCK_STEPS = [
  "LayerNorm before attention",
  "Masked multi-head self-attention",
  "Residual add",
  "LayerNorm before feed-forward",
  "Linear -> GELU -> Linear",
  "Residual add"
];

const ATTENTION_STEPS = [
  "Project x into queries, keys, and values",
  "Split embedding channels across heads",
  "Score query-key pairs and apply causal mask",
  "Softmax scaled scores into attention weights",
  "Mix values, merge heads, project output"
];

/**
 * Stage 02. Reads the live model registry so the shape numbers are the
 * server's, not hard-coded copies that can drift.
 */
export default function ForwardPassPanel() {
  const { models, modelId } = useConsole();
  const model = models.find((item) => item.model_id === modelId) ?? models[0] ?? null;

  const sampleIds = useMemo(() => byteEncode(renderPrompt("Every effort", "chat")).slice(0, 8), []);

  const seqLen = sampleIds.length;
  // Vocabulary size follows from the tokenizer, so it can be stated rather than guessed.
  const vocab = model?.tokenizer === "byte" ? 257 : model?.tokenizer === "gpt2" ? 50257 : null;

  return (
    <>
      <p>
        Push a real prompt through the shape of the model. The numbers below come from{" "}
        <code>GET /models</code>, so they match whatever is loaded right now.
      </p>

      {model ? (
        <div className="lx-metrics">
          <Metric label="Model" value={model.model_id} />
          <Metric label="Parameters" value={formatNumber(model.parameters)} />
          <Metric label="Context length" value={formatNumber(model.context_length)} />
          <Metric label="Tokenizer" value={model.tokenizer} />
        </div>
      ) : (
        <p className="lx-note">
          No model information available. Start the API, or check the URL in the top bar.
        </p>
      )}

      <p style={{ marginTop: "16px" }}>
        <strong>Shapes for a {seqLen}-token input</strong>
      </p>
      <table className="lx-table">
        <thead>
          <tr>
            <th>After</th>
            <th>Shape</th>
            <th>What it holds</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>in_idx</code>
            </td>
            <td>
              <code>[1, {seqLen}]</code>
            </td>
            <td>Integer token ids from Stage 01</td>
          </tr>
          <tr>
            <td>
              <code>tok_emb + pos_emb</code>
            </td>
            <td>
              <code>[1, {seqLen}, emb_dim]</code>
            </td>
            <td>One vector per position — what it is, plus where it is</td>
          </tr>
          <tr>
            <td>
              <code>trf_blocks</code>
            </td>
            <td>
              <code>unchanged</code>
            </td>
            <td>Blocks mix information without changing the shape</td>
          </tr>
          <tr>
            <td>
              <code>out_head</code>
            </td>
            <td>
              <code>
                [1, {seqLen}, {vocab ?? "vocab_size"}]
              </code>
            </td>
            <td>One raw score per vocabulary entry, at every position</td>
          </tr>
        </tbody>
      </table>

      <p className="lx-note">
        Only the last position is used when generating. The other {seqLen - 1} predictions are
        what makes training in Stage 04 efficient — one forward pass scores every position at
        once.
      </p>

      <details className="lx-advanced">
        <summary>Inside one TransformerBlock, and inside attention</summary>
        <div className="lx-steps" style={{ marginTop: "12px" }}>
          <div className="lx-step">
            <b>Block order (pre-norm, two residual paths)</b>
            <ol style={{ paddingLeft: "18px", marginTop: "6px" }}>
              {/* "Residual add" appears twice, so the index is the stable key here. */}
              {TRANSFORMER_BLOCK_STEPS.map((step, index) => (
                <li key={`${index}-${step}`}>{step}</li>
              ))}
            </ol>
          </div>
          <div className="lx-step">
            <b>Attention order</b>
            <ol style={{ paddingLeft: "18px", marginTop: "6px" }}>
              {ATTENTION_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="lx-metric">
      <span>{label}</span>
      <b style={{ fontSize: typeof value === "string" && value.length > 12 ? "14px" : "19px" }}>
        {value}
      </b>
    </div>
  );
}
