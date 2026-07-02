"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Database,
  Download,
  GitCompareArrows,
  History,
  Layers3,
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
  Send,
  Server,
  SlidersHorizontal,
  XCircle
} from "lucide-react";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const DEFAULT_CHAT_MESSAGE = "Every effort moves you";
const GPT2_INSTRUCTION_MESSAGE =
  "Explain what a model checkpoint is in one sentence.";

const FALLBACK_MODELS = [
  {
    model_id: "random-tiny-byte",
    description: "Random tiny byte-level GPT.",
    state: "random-untrained",
    parameters: 0,
    context_length: 64,
    tokenizer: "byte"
  }
];

const TABS = [
  { id: "chat", label: "Chat", icon: Send },
  { id: "pretrained", label: "Pretrained", icon: Download },
  { id: "training", label: "Training", icon: Activity },
  { id: "experiments", label: "Experiments", icon: History },
  { id: "checkpoints", label: "Checkpoints", icon: Save }
];

export default function Home() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [apiStatus, setApiStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("Checking API");
  const [activeTab, setActiveTab] = useState("chat");
  const [models, setModels] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [pretrainedModels, setPretrainedModels] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [message, setMessage] = useState(DEFAULT_CHAT_MESSAGE);
  const [chatModelId, setChatModelId] = useState("random-tiny-byte");
  const [maxNewTokens, setMaxNewTokens] = useState(24);
  const [temperature, setTemperature] = useState(0);
  const [chatResult, setChatResult] = useState(null);
  const [chatError, setChatError] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const [leftModelId, setLeftModelId] = useState("random-tiny-byte");
  const [rightModelId, setRightModelId] = useState("trained-tiny-byte");
  const [compareResults, setCompareResults] = useState(null);
  const [isComparing, setIsComparing] = useState(false);

  const [datasetId, setDatasetId] = useState("every-effort");
  const [baseModelId, setBaseModelId] = useState("random-tiny-byte");
  const [outputModelId, setOutputModelId] = useState("trained-tiny-byte");
  const [trainingSteps, setTrainingSteps] = useState(80);
  const [batchSize, setBatchSize] = useState(4);
  const [blockSize, setBlockSize] = useState(32);
  const [learningRate, setLearningRate] = useState(0.003);
  const [evalEvery, setEvalEvery] = useState(10);
  const [loadWhenComplete, setLoadWhenComplete] = useState(true);
  const [trainingJob, setTrainingJob] = useState(null);
  const [trainingError, setTrainingError] = useState("");
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const [pretrainedJob, setPretrainedJob] = useState(null);
  const [pretrainedError, setPretrainedError] = useState("");
  const [isStartingPretrained, setIsStartingPretrained] = useState(false);

  const [loadingCheckpointId, setLoadingCheckpointId] = useState("");
  const [checkpointError, setCheckpointError] = useState("");
  const [experimentLeftId, setExperimentLeftId] = useState("");
  const [experimentRightId, setExperimentRightId] = useState("");
  const [loadingExperimentId, setLoadingExperimentId] = useState("");
  const [experimentError, setExperimentError] = useState("");

  const normalizedApiBaseUrl = useMemo(
    () => apiBaseUrl.replace(/\/+$/, ""),
    [apiBaseUrl]
  );

  const modelOptions = useMemo(() => {
    const base = models.length > 0 ? models : FALLBACK_MODELS;
    const byId = new Map(base.map((model) => [model.model_id, model]));
    [chatModelId, leftModelId, rightModelId, baseModelId].forEach((modelId) => {
      if (modelId && !byId.has(modelId)) {
        byId.set(modelId, {
          model_id: modelId,
          description: "Not loaded yet.",
          state: "not-loaded",
          parameters: 0,
          context_length: 0,
          tokenizer: "byte"
        });
      }
    });
    return Array.from(byId.values());
  }, [baseModelId, chatModelId, leftModelId, models, rightModelId]);

  const lastProgress = trainingJob?.progress?.at(-1);
  const progressPercent = lastProgress
    ? Math.min(100, Math.round((lastProgress.step / lastProgress.max_steps) * 100))
    : 0;
  const trainingIsActive =
    trainingJob?.status === "queued" || trainingJob?.status === "running";
  const pretrainedIsActive =
    pretrainedJob?.status === "queued" || pretrainedJob?.status === "running";
  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.dataset_id === datasetId),
    [datasetId, datasets]
  );
  const experimentsById = useMemo(
    () =>
      new Map(
        experiments.map((experiment) => [experiment.experiment_id, experiment])
      ),
    [experiments]
  );
  const experimentPair = {
    left: experimentsById.get(experimentLeftId),
    right: experimentsById.get(experimentRightId)
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("llm-abc-api-base-url");
    if (stored) {
      setApiBaseUrl(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("llm-abc-api-base-url", apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedApiBaseUrl]);

  useEffect(() => {
    if (!trainingIsActive || !trainingJob?.job_id) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const job = await requestJson(`/training/jobs/${trainingJob.job_id}`);
        setTrainingJob(job);
        if (job.status === "succeeded") {
          await refreshAll();
          if (job.result?.loaded_model?.model_id) {
            setChatModelId(job.result.loaded_model.model_id);
            setRightModelId(job.result.loaded_model.model_id);
            setBaseModelId(job.result.loaded_model.model_id);
          }
        }
      } catch (error) {
        setTrainingError(error.message);
      }
    }, 1000);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingIsActive, trainingJob?.job_id, trainingJob?.updated_at]);

  useEffect(() => {
    if (!pretrainedIsActive || !pretrainedJob?.job_id) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const job = await requestJson(`/pretrained/jobs/${pretrainedJob.job_id}`);
        setPretrainedJob(job);
        if (job.status === "succeeded") {
          await refreshAll();
          if (job.result?.model_id) {
            setChatModelId(job.result.model_id);
            setRightModelId(job.result.model_id);
            setBaseModelId(job.result.model_id);
            setMessage(GPT2_INSTRUCTION_MESSAGE);
          }
        }
      } catch (error) {
        setPretrainedError(error.message);
      }
    }, 1200);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pretrainedIsActive, pretrainedJob?.job_id, pretrainedJob?.updated_at]);

  async function requestJson(path, options = {}) {
    const response = await fetch(`${normalizedApiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(data?.detail || response.statusText);
    }
    return data;
  }

  async function refreshAll() {
    setIsRefreshing(true);
    setStatusMessage("Checking API");

    try {
      await requestJson("/health");
      setApiStatus("online");
      setStatusMessage("API online");
    } catch (error) {
      setApiStatus("offline");
      setStatusMessage(error.message);
      setIsRefreshing(false);
      return;
    }

    const [
      modelsResult,
      pretrainedResult,
      datasetsResult,
      experimentsResult,
      checkpointsResult
    ] =
      await Promise.allSettled([
        requestJson("/models"),
        requestJson("/pretrained/models"),
        requestJson("/training/datasets"),
        requestJson("/training/experiments"),
        requestJson("/checkpoints")
      ]);

    if (modelsResult.status === "fulfilled") {
      setModels(modelsResult.value);
    }
    if (pretrainedResult.status === "fulfilled") {
      setPretrainedModels(pretrainedResult.value);
    }
    if (datasetsResult.status === "fulfilled") {
      setDatasets(datasetsResult.value);
      if (datasetsResult.value[0]?.dataset_id) {
        setDatasetId((current) => current || datasetsResult.value[0].dataset_id);
      }
    }
    if (experimentsResult.status === "fulfilled") {
      const nextExperiments = experimentsResult.value;
      setExperiments(nextExperiments);
      setExperimentRightId((current) =>
        current || nextExperiments[0]?.experiment_id || ""
      );
      setExperimentLeftId((current) =>
        current ||
        nextExperiments[1]?.experiment_id ||
        nextExperiments[0]?.experiment_id ||
        ""
      );
    }
    if (checkpointsResult.status === "fulfilled") {
      setCheckpoints(checkpointsResult.value);
    }

    setIsRefreshing(false);
  }

  async function sendChat() {
    setIsChatting(true);
    setChatError("");
    setChatResult(null);

    try {
      const result = await requestJson("/chat", {
        method: "POST",
        body: JSON.stringify({
          model_id: chatModelId,
          message,
          max_new_tokens: Number(maxNewTokens),
          temperature: Number(temperature),
          include_prompt: false
        })
      });
      setChatResult(result);
    } catch (error) {
      setChatError(error.message);
    } finally {
      setIsChatting(false);
    }
  }

  async function compareModels() {
    setIsComparing(true);
    setCompareResults(null);

    const payload = {
      message,
      max_new_tokens: Number(maxNewTokens),
      temperature: Number(temperature),
      include_prompt: false
    };

    const [left, right] = await Promise.allSettled([
      requestJson("/chat", {
        method: "POST",
        body: JSON.stringify({ ...payload, model_id: leftModelId })
      }),
      requestJson("/chat", {
        method: "POST",
        body: JSON.stringify({ ...payload, model_id: rightModelId })
      })
    ]);

    setCompareResults({
      left: resultFromSettled(left),
      right: resultFromSettled(right)
    });
    setIsComparing(false);
  }

  async function startTraining() {
    setIsStartingTraining(true);
    setTrainingError("");
    setTrainingJob(null);
    setActiveTab("training");

    try {
      const job = await requestJson("/training/jobs", {
        method: "POST",
        body: JSON.stringify({
          dataset_id: datasetId,
          base_model_id: baseModelId,
          output_model_id: outputModelId,
          max_steps: Number(trainingSteps),
          eval_every: Number(evalEvery),
          batch_size: Number(batchSize),
          block_size: Number(blockSize),
          learning_rate: Number(learningRate),
          sample_prompt: selectedDataset?.comparison_prompt || message,
          load_when_complete: loadWhenComplete
        })
      });
      setTrainingJob(job);
    } catch (error) {
      setTrainingError(error.message);
    } finally {
      setIsStartingTraining(false);
    }
  }

  async function startPretrainedDownload(model) {
    setIsStartingPretrained(true);
    setPretrainedError("");
    setPretrainedJob(null);
    setActiveTab("pretrained");

    try {
      const job = await requestJson("/pretrained/jobs", {
        method: "POST",
        body: JSON.stringify({
          model_size: model.model_size,
          model_id: model.model_id
        })
      });
      setPretrainedJob(job);
    } catch (error) {
      setPretrainedError(error.message);
    } finally {
      setIsStartingPretrained(false);
    }
  }

  function selectDataset(nextDatasetId) {
    setDatasetId(nextDatasetId);
    const dataset = datasets.find((item) => item.dataset_id === nextDatasetId);
    if (!dataset) {
      return;
    }
    setTrainingSteps(dataset.recommended_steps || trainingSteps);
    setBatchSize(dataset.recommended_batch_size || batchSize);
    setBlockSize(dataset.recommended_block_size || blockSize);
    setLearningRate(dataset.recommended_learning_rate || learningRate);
    setBaseModelId(dataset.recommended_base_model_id || baseModelId);
    setOutputModelId(dataset.output_model_id || outputModelId);
    setMessage(dataset.comparison_prompt || dataset.sample_prompt || message);
  }

  async function loadCheckpoint(checkpoint) {
    setLoadingCheckpointId(checkpoint.checkpoint_id);
    setCheckpointError("");

    try {
      const loaded = await requestJson("/models/load", {
        method: "POST",
        body: JSON.stringify({
          checkpoint_id: checkpoint.checkpoint_id,
          model_id: checkpoint.model_id
        })
      });
      await refreshAll();
      setChatModelId(loaded.model_id);
      setRightModelId(loaded.model_id);
      setBaseModelId(loaded.model_id);
      setActiveTab("chat");
    } catch (error) {
      setCheckpointError(error.message);
    } finally {
      setLoadingCheckpointId("");
    }
  }

  async function loadExperimentModel(experiment) {
    setLoadingExperimentId(experiment.experiment_id);
    setExperimentError("");

    try {
      const loaded = await requestJson("/models/load", {
        method: "POST",
        body: JSON.stringify({
          checkpoint_id: experiment.checkpoint_id,
          model_id: experiment.output_model_id
        })
      });
      await refreshAll();
      setChatModelId(loaded.model_id);
      setRightModelId(loaded.model_id);
      setBaseModelId(loaded.model_id);
      setMessage(experiment.comparison_prompt || experiment.sample_prompt || message);
      setActiveTab("chat");
    } catch (error) {
      setExperimentError(error.message);
    } finally {
      setLoadingExperimentId("");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BrainCircuit aria-hidden="true" />
          <div>
            <h1>LLM ABC Console</h1>
            <p>Minimal Web UI learning console</p>
          </div>
        </div>

        <div className="connection-bar">
          <label className="api-field">
            <span>API</span>
            <input
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              aria-label="API base URL"
            />
          </label>
          <span className={`status-pill ${apiStatus}`}>
            {apiStatus === "online" ? (
              <CheckCircle2 aria-hidden="true" />
            ) : apiStatus === "offline" ? (
              <XCircle aria-hidden="true" />
            ) : (
              <LoaderCircle aria-hidden="true" className="spin" />
            )}
            {statusMessage}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={refreshAll}
            disabled={isRefreshing}
            title="Refresh API data"
            aria-label="Refresh API data"
          >
            <RefreshCw aria-hidden="true" className={isRefreshing ? "spin" : ""} />
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Console views">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="workspace">
        <section className="main-surface">
          {activeTab === "chat" && (
            <ChatView
              chatError={chatError}
              chatModelId={chatModelId}
              chatResult={chatResult}
              compareModels={compareModels}
              compareResults={compareResults}
              isChatting={isChatting}
              isComparing={isComparing}
              leftModelId={leftModelId}
              maxNewTokens={maxNewTokens}
              message={message}
              modelOptions={modelOptions}
              rightModelId={rightModelId}
              sendChat={sendChat}
              setChatModelId={setChatModelId}
              setLeftModelId={setLeftModelId}
              setMaxNewTokens={setMaxNewTokens}
              setMessage={setMessage}
              setRightModelId={setRightModelId}
              setTemperature={setTemperature}
              temperature={temperature}
            />
          )}

          {activeTab === "pretrained" && (
            <PretrainedView
              isStartingPretrained={isStartingPretrained}
              pretrainedError={pretrainedError}
              pretrainedJob={pretrainedJob}
              pretrainedModels={pretrainedModels}
              refreshAll={refreshAll}
              startPretrainedDownload={startPretrainedDownload}
            />
          )}

          {activeTab === "training" && (
            <TrainingView
              batchSize={batchSize}
              baseModelId={baseModelId}
              blockSize={blockSize}
              datasetId={datasetId}
              datasets={datasets}
              evalEvery={evalEvery}
              isStartingTraining={isStartingTraining}
              lastProgress={lastProgress}
              learningRate={learningRate}
              loadWhenComplete={loadWhenComplete}
              modelOptions={modelOptions}
              outputModelId={outputModelId}
              progressPercent={progressPercent}
              selectedDataset={selectedDataset}
              selectDataset={selectDataset}
              setEvalEvery={setEvalEvery}
              setBaseModelId={setBaseModelId}
              setBatchSize={setBatchSize}
              setBlockSize={setBlockSize}
              setLearningRate={setLearningRate}
              setLoadWhenComplete={setLoadWhenComplete}
              setOutputModelId={setOutputModelId}
              setTrainingSteps={setTrainingSteps}
              startTraining={startTraining}
              trainingError={trainingError}
              trainingJob={trainingJob}
              trainingSteps={trainingSteps}
            />
          )}

          {activeTab === "experiments" && (
            <ExperimentsView
              experimentError={experimentError}
              experimentLeftId={experimentLeftId}
              experimentPair={experimentPair}
              experimentRightId={experimentRightId}
              experiments={experiments}
              loadExperimentModel={loadExperimentModel}
              loadingExperimentId={loadingExperimentId}
              refreshAll={refreshAll}
              setExperimentLeftId={setExperimentLeftId}
              setExperimentRightId={setExperimentRightId}
            />
          )}

          {activeTab === "checkpoints" && (
            <CheckpointView
              checkpointError={checkpointError}
              checkpoints={checkpoints}
              loadCheckpoint={loadCheckpoint}
              loadingCheckpointId={loadingCheckpointId}
              refreshAll={refreshAll}
            />
          )}
        </section>

        <aside className="model-rail">
          <section className="rail-section">
            <div className="section-title">
              <Server aria-hidden="true" />
              <h2>Models</h2>
            </div>
            <div className="stack">
              {modelOptions.map((model) => (
                <ModelRow key={model.model_id} model={model} />
              ))}
            </div>
          </section>

          <section className="rail-section">
            <div className="section-title">
              <Database aria-hidden="true" />
              <h2>Datasets</h2>
            </div>
            <div className="stack">
              {(datasets.length ? datasets : [{ dataset_id: "every-effort", exists: false }]).map(
                (dataset) => (
                  <div className="data-row" key={dataset.dataset_id}>
                    <div>
                      <strong>{dataset.dataset_id}</strong>
                      <span>{dataset.tier || "tiny"} / {dataset.byte_tokens || 0} tokens</span>
                    </div>
                    <span className={dataset.exists ? "state good" : "state muted"}>
                      {dataset.exists ? "ready" : "missing"}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ChatView({
  chatError,
  chatModelId,
  chatResult,
  compareModels,
  compareResults,
  isChatting,
  isComparing,
  leftModelId,
  maxNewTokens,
  message,
  modelOptions,
  rightModelId,
  sendChat,
  setChatModelId,
  setLeftModelId,
  setMaxNewTokens,
  setMessage,
  setRightModelId,
  setTemperature,
  temperature
}) {
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Chat</h2>
            <p>Prompt the selected model.</p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={sendChat}
            disabled={isChatting || !message.trim()}
          >
            {isChatting ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
            Send
          </button>
        </div>

        <div className="form-grid">
          <label className="field wide">
            <span>Prompt</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
            />
          </label>

          <label className="field">
            <span>Model</span>
            <select
              value={chatModelId}
              onChange={(event) => setChatModelId(event.target.value)}
            >
              {modelOptions.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Max tokens</span>
            <input
              type="number"
              min="1"
              max="200"
              value={maxNewTokens}
              onChange={(event) => setMaxNewTokens(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Temperature</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
            />
            <strong>{Number(temperature).toFixed(1)}</strong>
          </label>
        </div>

        {chatError && <div className="error-line">{chatError}</div>}

        {chatResult && (
          <div className="output-box">
            <div className="metrics">
              <span>prompt tokens {chatResult.prompt_tokens}</span>
              <span>generated {chatResult.tokens_generated}</span>
            </div>
            <pre>{formatText(chatResult.reply)}</pre>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Compare</h2>
            <p>Run the same prompt against two models.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={compareModels}
            disabled={isComparing || !message.trim()}
          >
            {isComparing ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : (
              <GitCompareArrows aria-hidden="true" />
            )}
            Compare
          </button>
        </div>

        <div className="compare-controls">
          <label className="field">
            <span>Left model</span>
            <select
              value={leftModelId}
              onChange={(event) => setLeftModelId(event.target.value)}
            >
              {modelOptions.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Right model</span>
            <select
              value={rightModelId}
              onChange={(event) => setRightModelId(event.target.value)}
            >
              {modelOptions.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </label>
        </div>

        {compareResults && (
          <div className="comparison-grid">
            <ComparisonColumn title={leftModelId} result={compareResults.left} />
            <ComparisonColumn title={rightModelId} result={compareResults.right} />
          </div>
        )}
      </section>
    </div>
  );
}

function PretrainedView({
  isStartingPretrained,
  pretrainedError,
  pretrainedJob,
  pretrainedModels,
  refreshAll,
  startPretrainedDownload
}) {
  const latestProgress = pretrainedJob?.progress?.at(-1);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Pretrained</h2>
          <p>Download GPT-2 weights and load them as chat models.</p>
        </div>
        <button className="secondary-button" type="button" onClick={refreshAll}>
          <RefreshCw aria-hidden="true" />
          Refresh
        </button>
      </div>

      {pretrainedError && <div className="error-line">{pretrainedError}</div>}

      <div className="checkpoint-list">
        {pretrainedModels.length === 0 && (
          <div className="empty-state">
            <Download aria-hidden="true" />
            <span>No pretrained model metadata yet</span>
          </div>
        )}

        {pretrainedModels.map((model) => (
          <article className="checkpoint-row" key={model.model_size}>
            <div>
              <h3>{model.label}</h3>
              <p>{model.hf_repo}</p>
              <div className="metrics">
                <span>{model.model_size}</span>
                <span>{formatNumber(model.parameters)} params</span>
                <span>{model.downloaded ? "cached" : "not downloaded"}</span>
                {model.recommended && <span>recommended</span>}
              </div>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => startPretrainedDownload(model)}
              disabled={isStartingPretrained || pretrainedJob?.status === "running"}
            >
              {isStartingPretrained || pretrainedJob?.status === "running" ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <Download aria-hidden="true" />
              )}
              {model.downloaded ? "Load" : "Download"}
            </button>
          </article>
        ))}
      </div>

      {pretrainedJob && (
        <div className="training-status">
          <div className="job-header">
            <span className={`state ${stateClass(pretrainedJob.status)}`}>
              {pretrainedJob.status}
            </span>
            <span>{pretrainedJob.job_id}</span>
          </div>

          {latestProgress && (
            <div className="metrics">
              <span>{latestProgress.stage || "working"}</span>
              {latestProgress.file && <span>{latestProgress.file}</span>}
              {latestProgress.total_bytes && (
                <span>
                  {formatBytes(latestProgress.downloaded_bytes)} /{" "}
                  {formatBytes(latestProgress.total_bytes)}
                </span>
              )}
              {latestProgress.message && <span>{latestProgress.message}</span>}
            </div>
          )}

          {pretrainedJob.result && (
            <div className="output-box">
              <h3>Loaded model</h3>
              <div className="metrics">
                <span>{pretrainedJob.result.model_id}</span>
                <span>{pretrainedJob.result.tokenizer}</span>
                <span>{pretrainedJob.result.prompt_style}</span>
                <span>{pretrainedJob.result.context_length} ctx</span>
                <span>{pretrainedJob.result.device}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TrainingView({
  batchSize,
  baseModelId,
  blockSize,
  datasetId,
  datasets,
  evalEvery,
  isStartingTraining,
  lastProgress,
  learningRate,
  loadWhenComplete,
  modelOptions,
  outputModelId,
  progressPercent,
  selectedDataset,
  selectDataset,
  setBaseModelId,
  setBatchSize,
  setBlockSize,
  setEvalEvery,
  setLearningRate,
  setLoadWhenComplete,
  setOutputModelId,
  setTrainingSteps,
  startTraining,
  trainingError,
  trainingJob,
  trainingSteps
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Training</h2>
          <p>Run the selected dataset objective and save a checkpoint.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={startTraining}
          disabled={isStartingTraining || trainingJob?.status === "running"}
        >
          {isStartingTraining ? (
            <LoaderCircle aria-hidden="true" className="spin" />
          ) : (
            <Play aria-hidden="true" />
          )}
          Start
        </button>
      </div>

      <DatasetLadder
        datasetId={datasetId}
        datasets={datasets}
        selectDataset={selectDataset}
      />

      <div className="form-grid">
        <label className="field">
          <span>Dataset</span>
          <select value={datasetId} onChange={(event) => selectDataset(event.target.value)}>
            {(datasets.length ? datasets : [{ dataset_id: "every-effort" }]).map(
              (dataset) => (
                <option key={dataset.dataset_id} value={dataset.dataset_id}>
                  {dataset.dataset_id}
                </option>
              )
            )}
          </select>
        </label>

        <label className="field">
          <span>Base model</span>
          <select
            value={baseModelId}
            onChange={(event) => setBaseModelId(event.target.value)}
          >
            {modelOptions.map((model) => (
              <option key={model.model_id} value={model.model_id}>
                {model.model_id}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Output model</span>
          <input
            value={outputModelId}
            onChange={(event) => setOutputModelId(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Steps</span>
          <input
            type="number"
            min="1"
            max="2000"
            value={trainingSteps}
            onChange={(event) => setTrainingSteps(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Batch size</span>
          <input
            type="number"
            min="1"
            max="64"
            value={batchSize}
            onChange={(event) => setBatchSize(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Block size</span>
          <input
            type="number"
            min="2"
            max="1024"
            value={blockSize}
            onChange={(event) => setBlockSize(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Learning rate</span>
          <input
            type="number"
            min="0.000001"
            max="1"
            step="0.00001"
            value={learningRate}
            onChange={(event) => setLearningRate(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Eval every</span>
          <input
            type="number"
            min="1"
            max="500"
            value={evalEvery}
            onChange={(event) => setEvalEvery(event.target.value)}
          />
        </label>

        <label className="toggle-row wide">
          <input
            type="checkbox"
            checked={loadWhenComplete}
            onChange={(event) => setLoadWhenComplete(event.target.checked)}
          />
          <span>Load checkpoint when complete</span>
        </label>
      </div>

      {selectedDataset && (
        <div className="dataset-summary">
          <div className="metrics">
            <span>tier {selectedDataset.tier}</span>
            <span>{selectedDataset.training_objective || "text"}</span>
            <span>base {selectedDataset.recommended_base_model_id || "-"}</span>
            <span>{selectedDataset.byte_tokens} byte tokens</span>
            <span>recommended {selectedDataset.recommended_steps} steps</span>
            <span>batch {selectedDataset.recommended_batch_size}</span>
            <span>block {selectedDataset.recommended_block_size}</span>
            <span>lr {selectedDataset.recommended_learning_rate}</span>
          </div>
          <div className="prompt-pair">
            <div>
              <span>Comparison prompt</span>
              <strong>{selectedDataset.comparison_prompt || selectedDataset.sample_prompt}</strong>
            </div>
            <div>
              <span>Dataset probe prompt</span>
              <strong>{selectedDataset.dataset_probe_prompt || "-"}</strong>
            </div>
          </div>
          <p>{selectedDataset.preview}</p>
        </div>
      )}

      {trainingError && <div className="error-line">{trainingError}</div>}

      {trainingJob && (
        <div className="training-status">
          <div className="job-header">
            <span className={`state ${stateClass(trainingJob.status)}`}>
              {trainingJob.status}
            </span>
            <span>{trainingJob.job_id}</span>
          </div>

          <div className="progress-track" aria-label="Training progress">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="metrics">
            <span>base {trainingJob.request?.base_model_id || "-"}</span>
            <span>step {lastProgress?.step || 0}</span>
            <span>loss {lastProgress?.loss ?? "-"}</span>
            <span>tokens {lastProgress?.tokens_seen || 0}</span>
          </div>

          {trainingJob.progress?.length > 0 && (
            <div className="progress-list">
              {trainingJob.progress.map((event) => (
                <div key={`${event.step}-${event.tokens_seen}`} className="progress-row">
                  <span>step {event.step}</span>
                  <span>loss {event.loss}</span>
                  <span>{event.tokens_seen} tokens</span>
                </div>
              ))}
            </div>
          )}

          {trainingJob.result?.training_summary && (
            <div className="comparison-grid">
              <OutputColumn
                title="Before (base)"
                text={trainingJob.result.training_summary.before_sample}
              />
              <OutputColumn
                title="After"
                text={trainingJob.result.training_summary.sample_text}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DatasetLadder({ datasetId, datasets, selectDataset }) {
  const source = datasets.length
    ? datasets
    : [
        {
          dataset_id: "every-effort",
          tier: "tiny",
          label: "Tiny repeated phrase",
          description: "The shortest repeated dataset.",
          byte_tokens: 0,
          recommended_steps: 80
        }
      ];

  return (
    <div className="dataset-ladder">
      {source.map((dataset) => (
        <button
          type="button"
          key={dataset.dataset_id}
          className={
            dataset.dataset_id === datasetId ? "dataset-card active" : "dataset-card"
          }
          onClick={() => selectDataset(dataset.dataset_id)}
        >
          <div className="dataset-card-heading">
            <span className="tier-label">{dataset.tier || "tiny"}</span>
            <strong>{dataset.label || dataset.dataset_id}</strong>
          </div>
          <p>{dataset.description}</p>
          <div className="dataset-meta">
            <span>{dataset.byte_tokens || 0} tokens</span>
            <span>{dataset.recommended_steps || 0} steps</span>
            <span>{dataset.training_objective || "text"}</span>
            <span>probe {dataset.dataset_probe_prompt || "-"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function ExperimentsView({
  experimentError,
  experimentLeftId,
  experimentPair,
  experimentRightId,
  experiments,
  loadExperimentModel,
  loadingExperimentId,
  refreshAll,
  setExperimentLeftId,
  setExperimentRightId
}) {
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Experiments</h2>
            <p>Compare training runs with the same prompt.</p>
          </div>
          <button className="secondary-button" type="button" onClick={refreshAll}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
        </div>

        {experimentError && <div className="error-line">{experimentError}</div>}

        {experiments.length === 0 ? (
          <div className="empty-state">
            <History aria-hidden="true" />
            <span>No training experiments yet</span>
          </div>
        ) : (
          <>
            <div className="experiment-controls">
              <label className="field">
                <span>Left experiment</span>
                <select
                  value={experimentLeftId}
                  onChange={(event) => setExperimentLeftId(event.target.value)}
                >
                  {experiments.map((experiment) => (
                    <option
                      key={experiment.experiment_id}
                      value={experiment.experiment_id}
                    >
                      {experimentLabel(experiment)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Right experiment</span>
                <select
                  value={experimentRightId}
                  onChange={(event) => setExperimentRightId(event.target.value)}
                >
                  {experiments.map((experiment) => (
                    <option
                      key={experiment.experiment_id}
                      value={experiment.experiment_id}
                    >
                      {experimentLabel(experiment)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="comparison-grid">
              <ExperimentColumn
                experiment={experimentPair.left}
                loadExperimentModel={loadExperimentModel}
                loadingExperimentId={loadingExperimentId}
              />
              <ExperimentColumn
                experiment={experimentPair.right}
                loadExperimentModel={loadExperimentModel}
                loadingExperimentId={loadingExperimentId}
              />
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>History</h2>
            <p>Most recent training runs.</p>
          </div>
        </div>

        <div className="experiment-list">
          {experiments.map((experiment) => (
            <article className="experiment-row" key={experiment.experiment_id}>
              <div>
                <div className="experiment-title">
                  <span className="tier-label">{experiment.dataset_tier}</span>
                  <strong>{experiment.output_model_id}</strong>
                </div>
                <p>{experiment.checkpoint_id}</p>
                <div className="metrics">
                  <span>{experiment.dataset_id}</span>
                  <span>{experiment.training_objective || "text"}</span>
                  <span>loss {formatMaybeNumber(experiment.final_loss)}</span>
                  <span>{experiment.tokens_seen || 0} tokens seen</span>
                  <span>{experiment.max_steps || 0} steps</span>
                </div>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => loadExperimentModel(experiment)}
                disabled={loadingExperimentId === experiment.experiment_id}
              >
                {loadingExperimentId === experiment.experiment_id ? (
                  <LoaderCircle aria-hidden="true" className="spin" />
                ) : (
                  <Layers3 aria-hidden="true" />
                )}
                Load
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ExperimentColumn({ experiment, loadExperimentModel, loadingExperimentId }) {
  if (!experiment) {
    return (
      <div className="output-box">
        <h3>No experiment selected</h3>
      </div>
    );
  }

  return (
    <div className="experiment-card">
      <div className="experiment-card-heading">
        <div>
          <span className="tier-label">{experiment.dataset_tier}</span>
          <h3>{experiment.output_model_id}</h3>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => loadExperimentModel(experiment)}
          disabled={loadingExperimentId === experiment.experiment_id}
        >
          {loadingExperimentId === experiment.experiment_id ? (
            <LoaderCircle aria-hidden="true" className="spin" />
          ) : (
            <Layers3 aria-hidden="true" />
          )}
          Load
        </button>
      </div>

      <div className="metric-grid">
        <Metric label="Dataset" value={experiment.dataset_id} />
        <Metric label="Objective" value={experiment.training_objective || "text"} />
        <Metric label="Final loss" value={formatMaybeNumber(experiment.final_loss)} />
        <Metric label="Dataset tokens" value={experiment.dataset_tokens || 0} />
        <Metric label="Tokens seen" value={experiment.tokens_seen || 0} />
        <Metric label="Steps" value={experiment.max_steps || 0} />
        <Metric label="Learning rate" value={experiment.learning_rate} />
        <Metric
          label="Comparison prompt"
          value={experiment.comparison_prompt || experiment.sample_prompt || "-"}
        />
        <Metric
          label="Probe prompt"
          value={experiment.dataset_probe_prompt || "-"}
        />
      </div>

      <SampleBlock title="Before" text={experiment.before_sample} />
      <SampleBlock title="After" text={experiment.after_sample} />
    </div>
  );
}

function SampleBlock({ title, text }) {
  return (
    <div className="sample-block">
      <h3>{title}</h3>
      <pre>{formatText(text)}</pre>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CheckpointView({
  checkpointError,
  checkpoints,
  loadCheckpoint,
  loadingCheckpointId,
  refreshAll
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Checkpoints</h2>
          <p>Load saved full model snapshots.</p>
        </div>
        <button className="secondary-button" type="button" onClick={refreshAll}>
          <RefreshCw aria-hidden="true" />
          Refresh
        </button>
      </div>

      {checkpointError && <div className="error-line">{checkpointError}</div>}

      <div className="checkpoint-list">
        {checkpoints.length === 0 && (
          <div className="empty-state">
            <Save aria-hidden="true" />
            <span>No checkpoints yet</span>
          </div>
        )}

        {checkpoints.map((checkpoint) => (
          <article className="checkpoint-row" key={checkpoint.checkpoint_id}>
            <div>
              <h3>{checkpoint.model_id}</h3>
              <p>{checkpoint.checkpoint_id}</p>
              <div className="metrics">
                <span>base {checkpoint.base_model_id}</span>
                <span>loss {checkpoint.training_summary?.final_loss ?? "-"}</span>
                <span>tokens {checkpoint.training_summary?.tokens_seen ?? "-"}</span>
              </div>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => loadCheckpoint(checkpoint)}
              disabled={loadingCheckpointId === checkpoint.checkpoint_id}
            >
              {loadingCheckpointId === checkpoint.checkpoint_id ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <SlidersHorizontal aria-hidden="true" />
              )}
              Load
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ModelRow({ model }) {
  return (
    <div className="model-row">
      <div>
        <strong>{model.model_id}</strong>
        <span>{model.state}</span>
      </div>
      <div className="metrics compact">
        <span>{formatNumber(model.parameters)} params</span>
        <span>{model.context_length || "-"} ctx</span>
      </div>
    </div>
  );
}

function ComparisonColumn({ title, result }) {
  if (result.error) {
    return (
      <div className="output-box">
        <h3>{title}</h3>
        <div className="error-line">{result.error}</div>
      </div>
    );
  }

  return (
    <div className="output-box">
      <h3>{title}</h3>
      <div className="metrics">
        <span>prompt tokens {result.data.prompt_tokens}</span>
        <span>generated {result.data.tokens_generated}</span>
      </div>
      <pre>{formatText(result.data.reply)}</pre>
    </div>
  );
}

function OutputColumn({ title, text }) {
  return (
    <div className="output-box">
      <h3>{title}</h3>
      <pre>{formatText(text)}</pre>
    </div>
  );
}

function resultFromSettled(result) {
  if (result.status === "fulfilled") {
    return { data: result.value };
  }
  return { error: result.reason.message };
}

function experimentLabel(experiment) {
  const loss = formatMaybeNumber(experiment.final_loss);
  return `${experiment.dataset_tier}/${experiment.output_model_id} loss ${loss}`;
}

function formatText(value) {
  return JSON.stringify(value ?? "");
}

function formatMaybeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : value.toFixed(4);
  }
  return value;
}

function formatNumber(value) {
  if (!value) {
    return "-";
  }
  return new Intl.NumberFormat("en-US").format(value);
}

function formatBytes(value) {
  if (!value) {
    return "-";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(value);
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function stateClass(status) {
  if (status === "succeeded") {
    return "good";
  }
  if (status === "failed") {
    return "bad";
  }
  return "active-state";
}
