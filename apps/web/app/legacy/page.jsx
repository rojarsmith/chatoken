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
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  Server,
  SlidersHorizontal,
  Trash2,
  XCircle
} from "lucide-react";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const DEFAULT_CHAT_MESSAGE = "Every effort moves you";
const GPT2_INSTRUCTION_MESSAGE =
  "Explain what a model checkpoint is in one sentence.";
const PROMPT_PLAYGROUND_TEMPLATE =
  "System: You answer in one concise paragraph.\nUser: {message}\nAssistant:";
const EMPTY_BUILDER_DRAFT = {
  example_id: "",
  split: "train",
  instruction: "",
  input: "",
  output: ""
};

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

const FALLBACK_EXTERNAL_MODELS = [
  {
    model_id: "openai-compatible",
    provider: "openai-compatible",
    provider_model_name: "model unset",
    label: "OpenAI-compatible chat",
    description: "Calls a chat/completions compatible HTTP endpoint from the API server.",
    state: "missing-config",
    requires_api_key: true,
    base_url: "https://api.openai.com/v1"
  }
];

const LEARNING_STAGES = {
  "from-scratch": {
    id: "from-scratch",
    label: "From Scratch",
    title: "From Scratch",
    description: "Train the tiny model from random weights on small datasets.",
    datasetIds: ["every-effort", "every-effort-expanded", "learning-dialogues"],
    fallbackDataset: {
      dataset_id: "every-effort",
      tier: "tiny",
      label: "Tiny repeated phrase",
      description: "The shortest repeated dataset.",
      recommended_steps: 80,
      recommended_batch_size: 4,
      recommended_block_size: 32,
      recommended_learning_rate: 0.003,
      recommended_base_model_id: "random-tiny-byte",
      comparison_prompt: DEFAULT_CHAT_MESSAGE,
      dataset_probe_prompt: DEFAULT_CHAT_MESSAGE,
      output_model_id: "trained-tiny-byte",
      training_objective: "text",
      learning_stage: "from-scratch"
    }
  },
  "raw-text": {
    id: "raw-text",
    label: "Raw Text",
    title: "Raw Text Pretraining",
    description: "Use The Verdict as larger raw text for continuation training.",
    datasetIds: ["the-verdict"],
    fallbackDataset: {
      dataset_id: "the-verdict",
      tier: "larger",
      label: "The Verdict",
      description: "A larger raw-text dataset.",
      recommended_steps: 320,
      recommended_batch_size: 4,
      recommended_block_size: 64,
      recommended_learning_rate: 0.003,
      recommended_base_model_id: "random-tiny-byte",
      comparison_prompt: "I had always thought Jack Gisburn",
      dataset_probe_prompt: "I had always thought Jack Gisburn",
      output_model_id: "trained-verdict-byte",
      training_objective: "raw-text",
      learning_stage: "raw-text"
    }
  },
  instruction: {
    id: "instruction",
    label: "Instruction",
    title: "Instruction SFT",
    description: "Fine-tune downloaded GPT-2 on instruction/response pairs.",
    datasetIds: ["instruction-following"],
    fallbackDataset: {
      dataset_id: "instruction-following",
      tier: "instruction",
      label: "Instruction following",
      description: "Instruction/response examples.",
      recommended_steps: 20,
      recommended_batch_size: 1,
      recommended_block_size: 256,
      recommended_learning_rate: 0.00005,
      recommended_base_model_id: "gpt2-124M",
      comparison_prompt: GPT2_INSTRUCTION_MESSAGE,
      dataset_probe_prompt:
        "Convert the active sentence to passive: The chef cooks the meal every day.",
      output_model_id: "gpt2-instruct-finetuned",
      training_objective: "instruction-sft",
      learning_stage: "instruction"
    }
  },
  lora: {
    id: "lora",
    label: "LoRA",
    title: "LoRA / PEFT",
    description: "Freeze GPT-2 and train low-rank attention adapters.",
    datasetIds: ["instruction-lora"],
    fallbackDataset: {
      dataset_id: "instruction-lora",
      tier: "peft",
      label: "LoRA instruction tuning",
      description: "Instruction/response examples with trainable LoRA adapters.",
      recommended_steps: 20,
      recommended_batch_size: 1,
      recommended_block_size: 256,
      recommended_learning_rate: 0.0003,
      recommended_base_model_id: "gpt2-124M",
      comparison_prompt: GPT2_INSTRUCTION_MESSAGE,
      dataset_probe_prompt:
        "Convert the active sentence to passive: The chef cooks the meal every day.",
      output_model_id: "gpt2-instruct-lora",
      training_objective: "instruction-lora",
      learning_stage: "lora"
    }
  },
  "chat-sft": {
    id: "chat-sft",
    label: "Chat SFT",
    title: "Minimal Chat Model",
    description:
      "Fine-tune downloaded GPT-2 with LoRA on multi-turn chat transcripts.",
    datasetIds: ["chat-sft-lora"],
    fallbackDataset: {
      dataset_id: "chat-sft-lora",
      tier: "chat",
      label: "Minimal chat SFT",
      description: "Small multi-turn chat transcripts.",
      recommended_steps: 240,
      recommended_batch_size: 1,
      recommended_block_size: 384,
      recommended_learning_rate: 0.0003,
      recommended_base_model_id: "gpt2-124M",
      comparison_prompt: "who are you?",
      dataset_probe_prompt: "What is my name?",
      output_model_id: "gpt2-chat-lora",
      training_objective: "chat-lora",
      learning_stage: "chat-sft"
    }
  },
  "dataset-builder": {
    id: "dataset-builder",
    label: "Dataset Builder",
    title: "Custom Instruction Training",
    description: "Build train/eval examples, then fine-tune GPT-2 from that dataset.",
    datasetIds: ["instruction-builder"],
    fallbackDataset: {
      dataset_id: "instruction-builder",
      tier: "custom",
      label: "Dataset builder",
      description: "Editable instruction examples.",
      recommended_steps: 20,
      recommended_batch_size: 1,
      recommended_block_size: 256,
      recommended_learning_rate: 0.00005,
      recommended_base_model_id: "gpt2-124M",
      comparison_prompt: GPT2_INSTRUCTION_MESSAGE,
      dataset_probe_prompt:
        "Summarize why splitting data into train and eval examples is useful.",
      output_model_id: "gpt2-builder-finetuned",
      training_objective: "instruction-sft",
      learning_stage: "dataset-builder",
      train_examples: 0,
      eval_examples: 0
    }
  }
};

const TABS = [
  { id: "architecture", label: "GPT Model", icon: BrainCircuit },
  { id: "training-knobs", label: "Training Config", icon: SlidersHorizontal },
  { id: "chat", label: "Chat", icon: Send },
  { id: "conversation", label: "Conversation", icon: History },
  { id: "prompt-playground", label: "Prompt Lab", icon: Pencil },
  { id: "external", label: "External", icon: Server },
  { id: "deployment", label: "Deploy", icon: Server },
  { id: "from-scratch", label: "From Scratch", icon: Activity },
  { id: "raw-text", label: "Raw Text", icon: Database },
  { id: "pretrained", label: "GPT-2", icon: Download },
  { id: "instruction", label: "Instruction", icon: SlidersHorizontal },
  { id: "lora", label: "LoRA", icon: Layers3 },
  { id: "chat-sft", label: "Chat SFT", icon: History },
  { id: "dataset-builder", label: "Dataset Builder", icon: Database },
  { id: "experiments", label: "Experiments", icon: History },
  { id: "checkpoints", label: "Checkpoints", icon: Save }
];

const PROMPT_STYLE_OPTIONS = [
  {
    value: "model-default",
    label: "Model default",
    detail: "Use the prompt style saved with the selected model."
  },
  {
    value: "raw",
    label: "Raw text",
    detail: "Send only the message text."
  },
  {
    value: "chat",
    label: "Chat",
    detail: "Wrap as User/Assistant turns."
  },
  {
    value: "instruction",
    label: "Instruction",
    detail: "Wrap as instruction and response sections."
  },
  {
    value: "custom",
    label: "Custom template",
    detail: "Render your template with {message}."
  }
];

const CONVERSATION_CONTEXT_FORMAT_OPTIONS = [
  {
    value: "chat-transcript",
    label: "Chat transcript",
    detail: "Send System/User/Assistant turns directly to the model."
  },
  {
    value: "instruction-request",
    label: "Instruction request",
    detail: "Wrap the session as one instruction asking the model to answer the latest user message."
  }
];

const INFERENCE_MODE_OPTIONS = [
  {
    value: "manual",
    label: "Manual",
    detail: "Use the temperature and top-k fields below."
  },
  {
    value: "greedy",
    label: "Greedy",
    detail: "temperature 0, deterministic next-token choice."
  },
  {
    value: "focused",
    label: "Focused",
    detail: "temperature 0.4 and top-k 20."
  },
  {
    value: "creative",
    label: "Creative",
    detail: "temperature 1.0 and top-k 80."
  }
];

const MODEL_BUILD_STEPS = [
  {
    label: "1. Token ids",
    code: "in_idx",
    detail:
      "Text has already been tokenized. The model receives integer ids, not raw strings."
  },
  {
    label: "2. Token embedding",
    code: "tok_emb",
    detail:
      "Each token id becomes a learned vector. This is where discrete text enters continuous math."
  },
  {
    label: "3. Position embedding",
    code: "pos_emb",
    detail:
      "The same token can mean different things at different positions, so position vectors are added."
  },
  {
    label: "4. Transformer blocks",
    code: "trf_blocks",
    detail:
      "Repeated attention and feed-forward layers mix token information while preserving sequence shape."
  },
  {
    label: "5. Final norm",
    code: "final_norm",
    detail:
      "LayerNorm stabilizes the hidden states before the vocabulary prediction head."
  },
  {
    label: "6. Output head",
    code: "out_head",
    detail:
      "A linear layer maps each hidden vector to logits over the vocabulary."
  }
];

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

const MODEL_CONFIG_ROWS = [
  {
    name: "vocab_size",
    value: "257",
    effect: "Controls output classes. Byte tokenizer uses 256 byte values plus EOS."
  },
  {
    name: "context_length",
    value: "64",
    effect: "Maximum tokens the model can look at in one forward pass."
  },
  {
    name: "emb_dim",
    value: "64",
    effect: "Width of each token vector. Wider models can store richer features."
  },
  {
    name: "n_heads",
    value: "4",
    effect: "Parallel attention views. emb_dim must divide evenly by n_heads."
  },
  {
    name: "n_layers",
    value: "2",
    effect: "Depth of repeated TransformerBlocks. More layers usually mean more capacity."
  },
  {
    name: "drop_rate",
    value: "0.1",
    effect: "Dropout regularization used during training."
  }
];

const TRAINING_KNOBS = [
  {
    name: "max_steps",
    valueLabel: "Steps",
    detail:
      "Number of optimizer updates. More steps means the model sees more batches and can fit the data more strongly.",
    risk: "Too few steps underfit; too many steps can overfit tiny data."
  },
  {
    name: "batch_size",
    valueLabel: "Batch size",
    detail:
      "How many training windows are averaged into one update. Larger batches smooth loss but use more memory.",
    risk: "On small GPUs, batch size is usually the first knob to reduce."
  },
  {
    name: "block_size",
    valueLabel: "Block size",
    detail:
      "Length of each training window. It must fit within model context_length.",
    risk: "Larger blocks teach longer dependencies but increase compute and memory."
  },
  {
    name: "learning_rate",
    valueLabel: "Learning rate",
    detail:
      "How large each optimizer update is. It controls how aggressively weights move.",
    risk: "Too high can make loss unstable; too low can look like no learning."
  },
  {
    name: "eval_every",
    valueLabel: "Eval every",
    detail:
      "How often progress is logged. It does not change learning, only observation frequency.",
    risk: "Very frequent logging adds noise to the learning story."
  },
  {
    name: "sample_prompt",
    valueLabel: "Sample prompt",
    detail:
      "The fixed prompt used to compare the model before and after training.",
    risk: "Changing prompts can hide whether a training run actually improved the same behavior."
  },
  {
    name: "prompt_style",
    valueLabel: "Prompt style",
    detail:
      "The wrapper around the plain message: chat, raw text, or instruction format.",
    risk: "Prompt formatting can change output even when weights stay the same."
  },
  {
    name: "stride",
    valueLabel: "Stride",
    detail:
      "How far the text window moves when building TokenDataset examples.",
    risk: "Smaller stride creates more overlapping examples; larger stride is faster but sees fewer windows."
  },
  {
    name: "sample_tokens",
    valueLabel: "Sample tokens",
    detail:
      "How many tokens are generated for before/after comparison after training.",
    risk: "This changes what you inspect, not the learned weights."
  },
  {
    name: "seed",
    valueLabel: "Seed",
    detail:
      "Controls random initialization and shuffle order for repeatable experiments.",
    risk: "Changing seed can change early results even with the same config."
  }
];

export default function Home() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [apiStatus, setApiStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("Checking API");
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("architecture");
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
  const [chatAbortController, setChatAbortController] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationTitle, setConversationTitle] = useState(
    "Learning conversation"
  );
  const [conversationModelId, setConversationModelId] =
    useState("random-tiny-byte");
  const [conversationSystemPrompt, setConversationSystemPrompt] = useState(
    "You are a concise assistant."
  );
  const [conversationMessage, setConversationMessage] = useState(
    "My name is Rojar. Please remember it."
  );
  const [conversationMaxHistoryMessages, setConversationMaxHistoryMessages] =
    useState(8);
  const [conversationContextBudget, setConversationContextBudget] = useState(256);
  const [conversationContextFormat, setConversationContextFormat] =
    useState("chat-transcript");
  const [conversationMaxNewTokens, setConversationMaxNewTokens] = useState(32);
  const [conversationTemperature, setConversationTemperature] = useState(0);
  const [conversationTopK, setConversationTopK] = useState("");
  const [conversationInferenceMode, setConversationInferenceMode] =
    useState("manual");
  const [conversationPreview, setConversationPreview] = useState(null);
  const [conversationError, setConversationError] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isPreviewingConversation, setIsPreviewingConversation] = useState(false);
  const [isSendingConversation, setIsSendingConversation] = useState(false);

  const [playgroundMessage, setPlaygroundMessage] = useState(DEFAULT_CHAT_MESSAGE);
  const [playgroundModelId, setPlaygroundModelId] = useState("random-tiny-byte");
  const [playgroundPromptStyle, setPlaygroundPromptStyle] =
    useState("model-default");
  const [playgroundTemplate, setPlaygroundTemplate] = useState(
    PROMPT_PLAYGROUND_TEMPLATE
  );
  const [playgroundInferenceMode, setPlaygroundInferenceMode] =
    useState("manual");
  const [playgroundMaxNewTokens, setPlaygroundMaxNewTokens] = useState(32);
  const [playgroundTemperature, setPlaygroundTemperature] = useState(0);
  const [playgroundTopK, setPlaygroundTopK] = useState("");
  const [promptPreview, setPromptPreview] = useState(null);
  const [promptPlaygroundResult, setPromptPlaygroundResult] = useState(null);
  const [promptPlaygroundError, setPromptPlaygroundError] = useState("");
  const [isPreviewingPrompt, setIsPreviewingPrompt] = useState(false);
  const [isRunningPromptPlayground, setIsRunningPromptPlayground] =
    useState(false);

  const [externalModels, setExternalModels] = useState([]);
  const [externalModelId, setExternalModelId] = useState("openai-compatible");
  const [externalLocalModelId, setExternalLocalModelId] =
    useState("random-tiny-byte");
  const [externalMessage, setExternalMessage] = useState(GPT2_INSTRUCTION_MESSAGE);
  const [externalSystemPrompt, setExternalSystemPrompt] = useState(
    "You are a concise assistant."
  );
  const [externalPromptStyle, setExternalPromptStyle] = useState("chat");
  const [externalTemplate, setExternalTemplate] = useState(
    PROMPT_PLAYGROUND_TEMPLATE
  );
  const [externalInferenceMode, setExternalInferenceMode] = useState("manual");
  const [externalMaxNewTokens, setExternalMaxNewTokens] = useState(96);
  const [externalTemperature, setExternalTemperature] = useState(0);
  const [externalTopK, setExternalTopK] = useState("");
  const [externalPreview, setExternalPreview] = useState(null);
  const [externalCompareResults, setExternalCompareResults] = useState(null);
  const [externalError, setExternalError] = useState("");
  const [isPreviewingExternal, setIsPreviewingExternal] = useState(false);
  const [isComparingExternal, setIsComparingExternal] = useState(false);

  const [deploymentProfile, setDeploymentProfile] = useState(null);
  const [deploymentModelId, setDeploymentModelId] = useState("random-tiny-byte");
  const [deploymentPromptTokens, setDeploymentPromptTokens] = useState(32);
  const [deploymentMaxNewTokens, setDeploymentMaxNewTokens] = useState(64);
  const [deploymentConcurrentRequests, setDeploymentConcurrentRequests] =
    useState(1);
  const [deploymentPrecision, setDeploymentPrecision] = useState("fp32");
  const [deploymentIncludeTraining, setDeploymentIncludeTraining] =
    useState(false);
  const [deploymentBatchSize, setDeploymentBatchSize] = useState(4);
  const [deploymentBlockSize, setDeploymentBlockSize] = useState(32);
  const [deploymentEstimate, setDeploymentEstimate] = useState(null);
  const [deploymentError, setDeploymentError] = useState("");
  const [isEstimatingDeployment, setIsEstimatingDeployment] = useState(false);

  const [leftModelId, setLeftModelId] = useState("random-tiny-byte");
  const [rightModelId, setRightModelId] = useState("random-tiny-byte");
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
  const [datasetPrepareError, setDatasetPrepareError] = useState("");
  const [isPreparingDataset, setIsPreparingDataset] = useState(false);
  const [pretrainedJob, setPretrainedJob] = useState(null);
  const [pretrainedError, setPretrainedError] = useState("");
  const [isStartingPretrained, setIsStartingPretrained] = useState(false);
  const [builderDataset, setBuilderDataset] = useState(null);
  const [builderDraft, setBuilderDraft] = useState(EMPTY_BUILDER_DRAFT);
  const [builderError, setBuilderError] = useState("");
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);
  const [isSeedingBuilder, setIsSeedingBuilder] = useState(false);
  const [deletingBuilderExampleId, setDeletingBuilderExampleId] = useState("");

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
    [
      chatModelId,
      conversationModelId,
      playgroundModelId,
      externalLocalModelId,
      deploymentModelId,
      leftModelId,
      rightModelId,
      baseModelId
    ].forEach((modelId) => {
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
  }, [
    baseModelId,
    chatModelId,
    conversationModelId,
    deploymentModelId,
    externalLocalModelId,
    leftModelId,
    models,
    playgroundModelId,
    rightModelId
  ]);
  const chatModelOptions = useMemo(() => {
    const options = modelOptions.filter((model) => model.state !== "not-loaded");
    return options.length > 0 ? options : FALLBACK_MODELS;
  }, [modelOptions]);
  const externalModelOptions = useMemo(
    () => (externalModels.length > 0 ? externalModels : FALLBACK_EXTERNAL_MODELS),
    [externalModels]
  );
  const selectedExternalModel = useMemo(
    () =>
      externalModelOptions.find((model) => model.model_id === externalModelId) ||
      externalModelOptions[0],
    [externalModelId, externalModelOptions]
  );

  const lastProgress = trainingJob?.progress?.at(-1);
  const progressPercent = lastProgress
    ? Math.min(100, Math.round((lastProgress.step / lastProgress.max_steps) * 100))
    : 0;
  const trainingIsActive =
    trainingJob?.status === "queued" || trainingJob?.status === "running";
  const pretrainedIsActive =
    pretrainedJob?.status === "queued" || pretrainedJob?.status === "running";
  const selectedDataset = useMemo(
    () =>
      datasets.find((dataset) => dataset.dataset_id === datasetId) ||
      Object.values(LEARNING_STAGES)
        .map((stage) => stage.fallbackDataset)
        .find((dataset) => dataset.dataset_id === datasetId),
    [datasetId, datasets]
  );
  const datasetsByStage = useMemo(() => {
    const byStage = {};
    for (const stage of Object.values(LEARNING_STAGES)) {
      const matchingDatasets = datasets.filter(
        (dataset) =>
          dataset.learning_stage === stage.id ||
          stage.datasetIds.includes(dataset.dataset_id)
      );
      byStage[stage.id] =
        matchingDatasets.length > 0 ? matchingDatasets : [stage.fallbackDataset];
    }
    return byStage;
  }, [datasets]);
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
  const experimentComparison = useMemo(
    () => buildExperimentComparison(experimentPair.left, experimentPair.right),
    [experimentPair.left, experimentPair.right]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("chatoken-api-base-url");
    if (stored) {
      setApiBaseUrl(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("chatoken-api-base-url", apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    const availableIds = new Set(chatModelOptions.map((model) => model.model_id));
    const fallbackId = chatModelOptions[0]?.model_id || "random-tiny-byte";
    if (!availableIds.has(chatModelId)) {
      setChatModelId(fallbackId);
    }
    if (!availableIds.has(conversationModelId)) {
      setConversationModelId(fallbackId);
    }
    if (!availableIds.has(playgroundModelId)) {
      setPlaygroundModelId(fallbackId);
    }
    if (!availableIds.has(externalLocalModelId)) {
      setExternalLocalModelId(fallbackId);
    }
    if (!availableIds.has(deploymentModelId)) {
      setDeploymentModelId(fallbackId);
    }
    if (!availableIds.has(leftModelId)) {
      setLeftModelId(fallbackId);
    }
    if (!availableIds.has(rightModelId)) {
      setRightModelId(fallbackId);
    }
  }, [
    chatModelId,
    chatModelOptions,
    conversationModelId,
    deploymentModelId,
    externalLocalModelId,
    leftModelId,
    playgroundModelId,
    rightModelId
  ]);

  useEffect(() => {
    const availableIds = new Set(externalModelOptions.map((model) => model.model_id));
    const fallbackId = externalModelOptions[0]?.model_id || "openai-compatible";
    if (!availableIds.has(externalModelId)) {
      setExternalModelId(fallbackId);
    }
  }, [externalModelId, externalModelOptions]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedApiBaseUrl]);

  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversation(null);
      return;
    }
    loadConversation(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, normalizedApiBaseUrl]);

  useEffect(() => {
    if (!trainingIsActive || !trainingJob?.job_id) {
      return undefined;
    }

    const jobId = trainingJob.job_id;
    let stopped = false;
    const pollJob = async () => {
      try {
        const job = await requestJson(`/training/jobs/${jobId}`);
        if (stopped) {
          return;
        }
        setTrainingJob(job);
        if (job.status === "succeeded") {
          await refreshAll();
          if (job.result?.loaded_model?.model_id) {
            setChatModelId(job.result.loaded_model.model_id);
            setConversationModelId(job.result.loaded_model.model_id);
            setPlaygroundModelId(job.result.loaded_model.model_id);
            setExternalLocalModelId(job.result.loaded_model.model_id);
            setRightModelId(job.result.loaded_model.model_id);
            setBaseModelId(job.result.loaded_model.model_id);
          }
        }
      } catch (error) {
        setTrainingError(error.message);
      }
    };
    pollJob();
    const intervalId = window.setInterval(pollJob, 1000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingIsActive, trainingJob?.job_id]);

  useEffect(() => {
    if (!pretrainedIsActive || !pretrainedJob?.job_id) {
      return undefined;
    }

    const jobId = pretrainedJob.job_id;
    let stopped = false;
    const pollJob = async () => {
      try {
        const job = await requestJson(`/pretrained/jobs/${jobId}`);
        if (stopped) {
          return;
        }
        setPretrainedJob(job);
        if (job.status === "succeeded") {
          await refreshAll();
          if (job.result?.model_id) {
            setChatModelId(job.result.model_id);
            setConversationModelId(job.result.model_id);
            setPlaygroundModelId(job.result.model_id);
            setExternalLocalModelId(job.result.model_id);
            setRightModelId(job.result.model_id);
            setBaseModelId(job.result.model_id);
            setMessage(GPT2_INSTRUCTION_MESSAGE);
            setConversationMessage(GPT2_INSTRUCTION_MESSAGE);
            setPlaygroundMessage(GPT2_INSTRUCTION_MESSAGE);
            setExternalMessage(GPT2_INSTRUCTION_MESSAGE);
          }
        }
      } catch (error) {
        setPretrainedError(error.message);
      }
    };
    pollJob();
    const intervalId = window.setInterval(pollJob, 1200);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pretrainedIsActive, pretrainedJob?.job_id]);

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
      const health = await requestJson("/health");
      setRuntimeInfo(health);
      setApiStatus("online");
      setStatusMessage("API online");
    } catch (error) {
      setApiStatus("offline");
      setRuntimeInfo(null);
      setStatusMessage(error.message);
      setIsRefreshing(false);
      return;
    }

    const [
      modelsResult,
      pretrainedResult,
      externalModelsResult,
      deploymentProfileResult,
      conversationsResult,
      datasetsResult,
      experimentsResult,
      checkpointsResult,
      builderResult
    ] =
      await Promise.allSettled([
        requestJson("/models"),
        requestJson("/pretrained/models"),
        requestJson("/external/models"),
        requestJson("/deployment/profile"),
        requestJson("/conversations"),
        requestJson("/training/datasets"),
        requestJson("/training/experiments"),
        requestJson("/checkpoints"),
        requestJson("/training/dataset-builder")
      ]);

    if (modelsResult.status === "fulfilled") {
      setModels(modelsResult.value);
    }
    if (pretrainedResult.status === "fulfilled") {
      setPretrainedModels(pretrainedResult.value);
    }
    if (externalModelsResult.status === "fulfilled") {
      setExternalModels(externalModelsResult.value);
    }
    if (deploymentProfileResult.status === "fulfilled") {
      setDeploymentProfile(deploymentProfileResult.value);
    }
    if (conversationsResult.status === "fulfilled") {
      setConversations(conversationsResult.value);
      setActiveConversationId((current) =>
        current || conversationsResult.value[0]?.conversation_id || ""
      );
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
    if (builderResult.status === "fulfilled") {
      setBuilderDataset(builderResult.value);
    }

    setIsRefreshing(false);
  }

  async function sendChat() {
    setIsChatting(true);
    setChatError("");
    const controller = new AbortController();
    setChatAbortController(controller);
    setChatResult({
      model_id: chatModelId,
      prompt: "",
      reply: "",
      full_text: "",
      prompt_tokens: 0,
      tokens_generated: 0,
      streaming: true
    });

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/chat/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model_id: chatModelId,
          message,
          max_new_tokens: Number(maxNewTokens),
          temperature: Number(temperature),
          include_prompt: false
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || response.statusText);
      }

      await readNdjsonStream(response, (event) => {
        if (event.event === "start") {
          setChatResult((current) => ({
            ...(current || {}),
            model_id: event.model_id,
            prompt: event.prompt,
            prompt_tokens: event.prompt_tokens,
            tokens_generated: 0,
            streaming: true,
            cancelled: false
          }));
        } else if (event.event === "token") {
          setChatResult((current) => ({
            ...(current || {}),
            model_id: event.model_id,
            reply: event.reply,
            full_text: event.full_text,
            tokens_generated: event.tokens_generated,
            streaming: true
          }));
        } else if (event.event === "done") {
          setChatResult({ ...event.result, streaming: false, cancelled: false });
        } else if (event.event === "error") {
          throw new Error(event.error || "Streaming chat failed.");
        }
      });
    } catch (error) {
      if (error.name === "AbortError") {
        setChatResult((current) =>
          current ? { ...current, streaming: false, cancelled: true } : current
        );
      } else {
        setChatError(error.message);
      }
    } finally {
      setIsChatting(false);
      setChatAbortController(null);
    }
  }

  function cancelChatStream() {
    chatAbortController?.abort();
    setChatResult((current) =>
      current ? { ...current, streaming: false, cancelled: true } : current
    );
    setIsChatting(false);
  }

  function applyConversationSettings(settings = {}) {
    setConversationModelId(settings.model_id || conversationModelId);
    setConversationSystemPrompt(settings.system_prompt || conversationSystemPrompt);
    setConversationMaxHistoryMessages(
      settings.max_history_messages ?? conversationMaxHistoryMessages
    );
    setConversationContextBudget(
      settings.context_token_budget ?? conversationContextBudget
    );
    setConversationContextFormat(settings.context_format || conversationContextFormat);
    setConversationMaxNewTokens(settings.max_new_tokens ?? conversationMaxNewTokens);
    setConversationTemperature(settings.temperature ?? conversationTemperature);
    setConversationTopK(
      settings.top_k === null || settings.top_k === undefined ? "" : settings.top_k
    );
    setConversationInferenceMode(settings.inference_mode || conversationInferenceMode);
  }

  function conversationPayload(message = conversationMessage) {
    const topK = `${conversationTopK}`.trim();
    return {
      message,
      model_id: conversationModelId,
      system_prompt: conversationSystemPrompt,
      max_history_messages: Number(conversationMaxHistoryMessages),
      context_token_budget: Number(conversationContextBudget),
      context_format: conversationContextFormat,
      max_new_tokens: Number(conversationMaxNewTokens),
      temperature: Number(conversationTemperature),
      top_k: topK ? Number(topK) : null,
      inference_mode: conversationInferenceMode,
      update_settings: true
    };
  }

  async function loadConversation(conversationId) {
    setConversationError("");
    try {
      const conversation = await requestJson(`/conversations/${conversationId}`);
      setActiveConversation(conversation);
      setConversationTitle(conversation.title || "Learning conversation");
      applyConversationSettings(conversation.settings);
    } catch (error) {
      setConversationError(error.message);
    }
  }

  async function createConversation() {
    setIsCreatingConversation(true);
    setConversationError("");

    try {
      const conversation = await requestJson("/conversations", {
        method: "POST",
        body: JSON.stringify({
          title: conversationTitle,
          model_id: conversationModelId,
          system_prompt: conversationSystemPrompt,
          max_history_messages: Number(conversationMaxHistoryMessages),
          context_token_budget: Number(conversationContextBudget),
          context_format: conversationContextFormat,
          max_new_tokens: Number(conversationMaxNewTokens),
          temperature: Number(conversationTemperature),
          top_k: `${conversationTopK}`.trim() ? Number(conversationTopK) : null,
          inference_mode: conversationInferenceMode
        })
      });
      setActiveConversationId(conversation.conversation_id);
      setActiveConversation(conversation);
      setConversationPreview(null);
      await refreshAll();
    } catch (error) {
      setConversationError(error.message);
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function deleteConversation() {
    if (!activeConversationId) {
      return;
    }
    setConversationError("");
    try {
      await requestJson(`/conversations/${activeConversationId}`, {
        method: "DELETE"
      });
      setActiveConversationId("");
      setActiveConversation(null);
      setConversationPreview(null);
      await refreshAll();
    } catch (error) {
      setConversationError(error.message);
    }
  }

  async function previewConversationContext() {
    if (!activeConversationId) {
      await createConversation();
      return;
    }
    setIsPreviewingConversation(true);
    setConversationError("");

    try {
      const preview = await requestJson(
        `/conversations/${activeConversationId}/context-preview`,
        {
          method: "POST",
          body: JSON.stringify(conversationPayload())
        }
      );
      setConversationPreview(preview);
    } catch (error) {
      setConversationError(error.message);
    } finally {
      setIsPreviewingConversation(false);
    }
  }

  async function sendConversationMessage() {
    setIsSendingConversation(true);
    setConversationError("");

    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const conversation = await requestJson("/conversations", {
          method: "POST",
          body: JSON.stringify({
            title: conversationTitle,
            model_id: conversationModelId,
            system_prompt: conversationSystemPrompt,
            max_history_messages: Number(conversationMaxHistoryMessages),
            context_token_budget: Number(conversationContextBudget),
            context_format: conversationContextFormat,
            max_new_tokens: Number(conversationMaxNewTokens),
            temperature: Number(conversationTemperature),
            top_k: `${conversationTopK}`.trim() ? Number(conversationTopK) : null,
            inference_mode: conversationInferenceMode
          })
        });
        conversationId = conversation.conversation_id;
        setActiveConversationId(conversationId);
      }

      const turn = await requestJson(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(conversationPayload())
      });
      setActiveConversation(turn.conversation);
      setConversationPreview(turn.context);
      setConversationMessage("");
      await refreshAll();
    } catch (error) {
      setConversationError(error.message);
    } finally {
      setIsSendingConversation(false);
    }
  }

  function promptPlaygroundPayload() {
    const topK = `${playgroundTopK}`.trim();
    return {
      model_id: playgroundModelId,
      message: playgroundMessage,
      max_new_tokens: Number(playgroundMaxNewTokens),
      temperature: Number(playgroundTemperature),
      top_k: topK ? Number(topK) : null,
      include_prompt: false,
      prompt_style: playgroundPromptStyle,
      prompt_template:
        playgroundPromptStyle === "custom" ? playgroundTemplate : null,
      inference_mode: playgroundInferenceMode
    };
  }

  async function previewPromptPlayground() {
    setIsPreviewingPrompt(true);
    setPromptPlaygroundError("");

    try {
      const preview = await requestJson("/chat/prompt-preview", {
        method: "POST",
        body: JSON.stringify(promptPlaygroundPayload())
      });
      setPromptPreview(preview);
    } catch (error) {
      setPromptPlaygroundError(error.message);
    } finally {
      setIsPreviewingPrompt(false);
    }
  }

  async function runPromptPlayground() {
    setIsRunningPromptPlayground(true);
    setPromptPlaygroundError("");
    setPromptPlaygroundResult(null);

    try {
      const payload = promptPlaygroundPayload();
      const preview = await requestJson("/chat/prompt-preview", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setPromptPreview(preview);
      const result = await requestJson("/chat", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setPromptPlaygroundResult(result);
    } catch (error) {
      setPromptPlaygroundError(error.message);
    } finally {
      setIsRunningPromptPlayground(false);
    }
  }

  function externalPayload() {
    const topK = `${externalTopK}`.trim();
    return {
      provider: selectedExternalModel?.provider || "openai-compatible",
      model_id: selectedExternalModel?.model_id || "openai-compatible",
      message: externalMessage,
      system_prompt: externalSystemPrompt,
      max_new_tokens: Number(externalMaxNewTokens),
      temperature: Number(externalTemperature),
      top_k: topK ? Number(topK) : null,
      prompt_style: externalPromptStyle,
      prompt_template: externalPromptStyle === "custom" ? externalTemplate : null,
      inference_mode: externalInferenceMode
    };
  }

  function localPayloadForExternalCompare() {
    const topK = `${externalTopK}`.trim();
    return {
      model_id: externalLocalModelId,
      message: externalMessage,
      max_new_tokens: Number(externalMaxNewTokens),
      temperature: Number(externalTemperature),
      top_k: topK ? Number(topK) : null,
      include_prompt: false,
      prompt_style: externalPromptStyle,
      prompt_template: externalPromptStyle === "custom" ? externalTemplate : null,
      inference_mode: externalInferenceMode
    };
  }

  async function previewExternalModel() {
    setIsPreviewingExternal(true);
    setExternalError("");

    try {
      const preview = await requestJson("/external/prompt-preview", {
        method: "POST",
        body: JSON.stringify(externalPayload())
      });
      setExternalPreview(preview);
    } catch (error) {
      setExternalError(error.message);
    } finally {
      setIsPreviewingExternal(false);
    }
  }

  async function compareExternalModel() {
    setIsComparingExternal(true);
    setExternalError("");
    setExternalCompareResults(null);

    const [local, external] = await Promise.allSettled([
      requestJson("/chat", {
        method: "POST",
        body: JSON.stringify(localPayloadForExternalCompare())
      }),
      requestJson("/external/chat", {
        method: "POST",
        body: JSON.stringify(externalPayload())
      })
    ]);

    setExternalCompareResults({
      local: resultFromSettled(local),
      external: resultFromSettled(external)
    });
    setIsComparingExternal(false);
  }

  async function estimateDeploymentResources() {
    setIsEstimatingDeployment(true);
    setDeploymentError("");

    try {
      const estimate = await requestJson("/deployment/estimate", {
        method: "POST",
        body: JSON.stringify({
          model_id: deploymentModelId,
          prompt_tokens: Number(deploymentPromptTokens),
          max_new_tokens: Number(deploymentMaxNewTokens),
          concurrent_requests: Number(deploymentConcurrentRequests),
          precision: deploymentPrecision,
          include_training: deploymentIncludeTraining,
          batch_size: Number(deploymentBatchSize),
          block_size: Number(deploymentBlockSize)
        })
      });
      setDeploymentEstimate(estimate);
    } catch (error) {
      setDeploymentError(error.message);
    } finally {
      setIsEstimatingDeployment(false);
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

  async function cancelTrainingJob() {
    if (!trainingJob?.job_id) {
      return;
    }
    setTrainingError("");
    try {
      const job = await requestJson(`/training/jobs/${trainingJob.job_id}/cancel`, {
        method: "POST"
      });
      setTrainingJob(job);
    } catch (error) {
      setTrainingError(error.message);
    }
  }

  async function startPretrainedDownload(model, nextTab = "pretrained") {
    setIsStartingPretrained(true);
    setPretrainedError("");
    setPretrainedJob(null);
    if (nextTab) {
      setActiveTab(nextTab);
    }

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

  async function cancelPretrainedJob() {
    if (!pretrainedJob?.job_id) {
      return;
    }
    setPretrainedError("");
    try {
      const job = await requestJson(`/pretrained/jobs/${pretrainedJob.job_id}/cancel`, {
        method: "POST"
      });
      setPretrainedJob(job);
    } catch (error) {
      setPretrainedError(error.message);
    }
  }

  async function prepareDataset(dataset) {
    if (!dataset?.dataset_id) {
      return;
    }
    setIsPreparingDataset(true);
    setDatasetPrepareError("");

    try {
      const preparedDataset = await requestJson(`/training/datasets/${dataset.dataset_id}/prepare`, {
        method: "POST"
      });
      await refreshAll();
      applyDataset(preparedDataset);
    } catch (error) {
      setDatasetPrepareError(error.message);
    } finally {
      setIsPreparingDataset(false);
    }
  }

  function updateBuilderDraft(field, value) {
    setBuilderDraft((current) => ({ ...current, [field]: value }));
  }

  function editBuilderExample(example) {
    setBuilderError("");
    setBuilderDraft({
      example_id: example.example_id,
      split: example.split || "train",
      instruction: example.instruction || "",
      input: example.input || "",
      output: example.output || ""
    });
  }

  function clearBuilderDraft() {
    setBuilderError("");
    setBuilderDraft({ ...EMPTY_BUILDER_DRAFT });
  }

  async function saveBuilderExample(event) {
    event.preventDefault();
    setIsSavingBuilder(true);
    setBuilderError("");

    const isEditing = Boolean(builderDraft.example_id);
    const path = isEditing
      ? `/training/dataset-builder/examples/${builderDraft.example_id}`
      : "/training/dataset-builder/examples";

    try {
      const updatedBuilder = await requestJson(path, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          instruction: builderDraft.instruction,
          input: builderDraft.input,
          output: builderDraft.output,
          split: builderDraft.split
        })
      });
      setBuilderDataset(updatedBuilder);
      setBuilderDraft({ ...EMPTY_BUILDER_DRAFT });
      await refreshAll();
    } catch (error) {
      setBuilderError(error.message);
    } finally {
      setIsSavingBuilder(false);
    }
  }

  async function seedBuilderDataset() {
    setIsSeedingBuilder(true);
    setBuilderError("");

    try {
      const updatedBuilder = await requestJson("/training/dataset-builder/seed", {
        method: "POST"
      });
      setBuilderDataset(updatedBuilder);
      await refreshAll();
    } catch (error) {
      setBuilderError(error.message);
    } finally {
      setIsSeedingBuilder(false);
    }
  }

  async function deleteBuilderExample(example) {
    setDeletingBuilderExampleId(example.example_id);
    setBuilderError("");

    try {
      const updatedBuilder = await requestJson(
        `/training/dataset-builder/examples/${example.example_id}`,
        { method: "DELETE" }
      );
      setBuilderDataset(updatedBuilder);
      if (builderDraft.example_id === example.example_id) {
        setBuilderDraft({ ...EMPTY_BUILDER_DRAFT });
      }
      await refreshAll();
    } catch (error) {
      setBuilderError(error.message);
    } finally {
      setDeletingBuilderExampleId("");
    }
  }

  function openTab(nextTab) {
    setActiveTab(nextTab);
    const stage = LEARNING_STAGES[nextTab];
    if (!stage) {
      return;
    }

    const stageDatasets = datasetsByStage[stage.id] || [stage.fallbackDataset];
    const currentBelongsToStage = stageDatasets.some(
      (dataset) => dataset.dataset_id === datasetId
    );
    if (!currentBelongsToStage && stageDatasets[0]) {
      applyDataset(stageDatasets[0]);
    }
  }

  function selectDataset(nextDatasetId) {
    const fallbackDatasets = Object.values(LEARNING_STAGES).map(
      (stage) => stage.fallbackDataset
    );
    const dataset =
      datasets.find((item) => item.dataset_id === nextDatasetId) ||
      fallbackDatasets.find((item) => item.dataset_id === nextDatasetId);
    if (!dataset) {
      return;
    }
    applyDataset(dataset);
  }

  function applyDataset(dataset) {
    setDatasetId(dataset.dataset_id);
    setTrainingSteps(dataset.recommended_steps || trainingSteps);
    setBatchSize(dataset.recommended_batch_size || batchSize);
    setBlockSize(dataset.recommended_block_size || blockSize);
    setLearningRate(dataset.recommended_learning_rate || learningRate);
    setBaseModelId(dataset.recommended_base_model_id || baseModelId);
    setOutputModelId(dataset.output_model_id || outputModelId);
    setMessage(dataset.comparison_prompt || dataset.sample_prompt || message);
    setConversationMessage(
      dataset.comparison_prompt || dataset.sample_prompt || conversationMessage
    );
    setPlaygroundMessage(
      dataset.comparison_prompt || dataset.sample_prompt || playgroundMessage
    );
    setExternalMessage(
      dataset.comparison_prompt || dataset.sample_prompt || externalMessage
    );
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
      setConversationModelId(loaded.model_id);
      setPlaygroundModelId(loaded.model_id);
      setExternalLocalModelId(loaded.model_id);
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
      setConversationModelId(loaded.model_id);
      setPlaygroundModelId(loaded.model_id);
      setExternalLocalModelId(loaded.model_id);
      setRightModelId(loaded.model_id);
      setBaseModelId(loaded.model_id);
      setMessage(experiment.comparison_prompt || experiment.sample_prompt || message);
      setConversationMessage(
        experiment.comparison_prompt || experiment.sample_prompt || conversationMessage
      );
      setPlaygroundMessage(
        experiment.comparison_prompt || experiment.sample_prompt || playgroundMessage
      );
      setExternalMessage(
        experiment.comparison_prompt || experiment.sample_prompt || externalMessage
      );
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
            <h1>Chatoken Console</h1>
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
          <RuntimePill apiStatus={apiStatus} runtimeInfo={runtimeInfo} />
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
              onClick={() => openTab(tab.id)}
            >
              <Icon aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="workspace">
        <section className="main-surface">
          {activeTab === "architecture" && <ArchitectureView />}

          {activeTab === "training-knobs" && (
            <TrainingKnobsView
              batchSize={batchSize}
              blockSize={blockSize}
              evalEvery={evalEvery}
              learningRate={learningRate}
              openTraining={() => openTab("from-scratch")}
              selectedDataset={selectedDataset}
              setBatchSize={setBatchSize}
              setBlockSize={setBlockSize}
              setEvalEvery={setEvalEvery}
              setLearningRate={setLearningRate}
              setTrainingSteps={setTrainingSteps}
              trainingSteps={trainingSteps}
            />
          )}

          {activeTab === "conversation" && (
            <ConversationView
              activeConversation={activeConversation}
              activeConversationId={activeConversationId}
              conversationContextBudget={conversationContextBudget}
              conversationContextFormat={conversationContextFormat}
              conversationError={conversationError}
              conversationInferenceMode={conversationInferenceMode}
              conversationMaxHistoryMessages={conversationMaxHistoryMessages}
              conversationMaxNewTokens={conversationMaxNewTokens}
              conversationMessage={conversationMessage}
              conversationModelId={conversationModelId}
              conversationPreview={conversationPreview}
              conversationSystemPrompt={conversationSystemPrompt}
              conversationTemperature={conversationTemperature}
              conversationTitle={conversationTitle}
              conversationTopK={conversationTopK}
              conversations={conversations}
              contextFormatOptions={CONVERSATION_CONTEXT_FORMAT_OPTIONS}
              createConversation={createConversation}
              deleteConversation={deleteConversation}
              inferenceModeOptions={INFERENCE_MODE_OPTIONS}
              isCreatingConversation={isCreatingConversation}
              isPreviewingConversation={isPreviewingConversation}
              isSendingConversation={isSendingConversation}
              modelOptions={chatModelOptions}
              previewConversationContext={previewConversationContext}
              sendConversationMessage={sendConversationMessage}
              setActiveConversationId={setActiveConversationId}
              setConversationContextBudget={setConversationContextBudget}
              setConversationContextFormat={setConversationContextFormat}
              setConversationInferenceMode={setConversationInferenceMode}
              setConversationMaxHistoryMessages={setConversationMaxHistoryMessages}
              setConversationMaxNewTokens={setConversationMaxNewTokens}
              setConversationMessage={setConversationMessage}
              setConversationModelId={setConversationModelId}
              setConversationSystemPrompt={setConversationSystemPrompt}
              setConversationTemperature={setConversationTemperature}
              setConversationTitle={setConversationTitle}
              setConversationTopK={setConversationTopK}
            />
          )}

          {activeTab === "chat" && (
            <ChatView
              chatError={chatError}
              chatModelId={chatModelId}
              chatResult={chatResult}
              cancelChatStream={cancelChatStream}
              compareModels={compareModels}
              compareResults={compareResults}
              isChatting={isChatting}
              isComparing={isComparing}
              leftModelId={leftModelId}
              maxNewTokens={maxNewTokens}
              message={message}
              modelOptions={chatModelOptions}
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

          {activeTab === "prompt-playground" && (
            <PromptPlaygroundView
              inferenceModeOptions={INFERENCE_MODE_OPTIONS}
              isPreviewingPrompt={isPreviewingPrompt}
              isRunningPromptPlayground={isRunningPromptPlayground}
              modelOptions={chatModelOptions}
              playgroundInferenceMode={playgroundInferenceMode}
              playgroundMaxNewTokens={playgroundMaxNewTokens}
              playgroundMessage={playgroundMessage}
              playgroundModelId={playgroundModelId}
              playgroundPromptStyle={playgroundPromptStyle}
              playgroundTemplate={playgroundTemplate}
              playgroundTemperature={playgroundTemperature}
              playgroundTopK={playgroundTopK}
              promptPlaygroundError={promptPlaygroundError}
              promptPlaygroundResult={promptPlaygroundResult}
              promptPreview={promptPreview}
              promptStyleOptions={PROMPT_STYLE_OPTIONS}
              previewPromptPlayground={previewPromptPlayground}
              runPromptPlayground={runPromptPlayground}
              setPlaygroundInferenceMode={setPlaygroundInferenceMode}
              setPlaygroundMaxNewTokens={setPlaygroundMaxNewTokens}
              setPlaygroundMessage={setPlaygroundMessage}
              setPlaygroundModelId={setPlaygroundModelId}
              setPlaygroundPromptStyle={setPlaygroundPromptStyle}
              setPlaygroundTemplate={setPlaygroundTemplate}
              setPlaygroundTemperature={setPlaygroundTemperature}
              setPlaygroundTopK={setPlaygroundTopK}
            />
          )}

          {activeTab === "external" && (
            <ExternalModelView
              compareExternalModel={compareExternalModel}
              externalCompareResults={externalCompareResults}
              externalError={externalError}
              externalInferenceMode={externalInferenceMode}
              externalLocalModelId={externalLocalModelId}
              externalMaxNewTokens={externalMaxNewTokens}
              externalMessage={externalMessage}
              externalModelId={externalModelId}
              externalModelOptions={externalModelOptions}
              externalPreview={externalPreview}
              externalPromptStyle={externalPromptStyle}
              externalSystemPrompt={externalSystemPrompt}
              externalTemplate={externalTemplate}
              externalTemperature={externalTemperature}
              externalTopK={externalTopK}
              inferenceModeOptions={INFERENCE_MODE_OPTIONS}
              isComparingExternal={isComparingExternal}
              isPreviewingExternal={isPreviewingExternal}
              localModelOptions={chatModelOptions}
              previewExternalModel={previewExternalModel}
              promptStyleOptions={PROMPT_STYLE_OPTIONS}
              selectedExternalModel={selectedExternalModel}
              setExternalInferenceMode={setExternalInferenceMode}
              setExternalLocalModelId={setExternalLocalModelId}
              setExternalMaxNewTokens={setExternalMaxNewTokens}
              setExternalMessage={setExternalMessage}
              setExternalModelId={setExternalModelId}
              setExternalPromptStyle={setExternalPromptStyle}
              setExternalSystemPrompt={setExternalSystemPrompt}
              setExternalTemplate={setExternalTemplate}
              setExternalTemperature={setExternalTemperature}
              setExternalTopK={setExternalTopK}
            />
          )}

          {activeTab === "deployment" && (
            <DeploymentView
              deploymentBatchSize={deploymentBatchSize}
              deploymentBlockSize={deploymentBlockSize}
              deploymentConcurrentRequests={deploymentConcurrentRequests}
              deploymentError={deploymentError}
              deploymentEstimate={deploymentEstimate}
              deploymentIncludeTraining={deploymentIncludeTraining}
              deploymentMaxNewTokens={deploymentMaxNewTokens}
              deploymentModelId={deploymentModelId}
              deploymentPrecision={deploymentPrecision}
              deploymentProfile={deploymentProfile}
              deploymentPromptTokens={deploymentPromptTokens}
              estimateDeploymentResources={estimateDeploymentResources}
              isEstimatingDeployment={isEstimatingDeployment}
              modelOptions={chatModelOptions}
              runtimeInfo={runtimeInfo}
              setDeploymentBatchSize={setDeploymentBatchSize}
              setDeploymentBlockSize={setDeploymentBlockSize}
              setDeploymentConcurrentRequests={setDeploymentConcurrentRequests}
              setDeploymentIncludeTraining={setDeploymentIncludeTraining}
              setDeploymentMaxNewTokens={setDeploymentMaxNewTokens}
              setDeploymentModelId={setDeploymentModelId}
              setDeploymentPrecision={setDeploymentPrecision}
              setDeploymentPromptTokens={setDeploymentPromptTokens}
            />
          )}

          {activeTab === "pretrained" && (
            <PretrainedView
              isStartingPretrained={isStartingPretrained}
              cancelPretrainedJob={cancelPretrainedJob}
              pretrainedError={pretrainedError}
              pretrainedJob={pretrainedJob}
              pretrainedModels={pretrainedModels}
              refreshAll={refreshAll}
              startPretrainedDownload={startPretrainedDownload}
            />
          )}

          {activeTab === "dataset-builder" && (
            <DatasetBuilderView
              builderDataset={builderDataset}
              builderDraft={builderDraft}
              builderError={builderError}
              clearBuilderDraft={clearBuilderDraft}
              deleteBuilderExample={deleteBuilderExample}
              deletingBuilderExampleId={deletingBuilderExampleId}
              editBuilderExample={editBuilderExample}
              isSavingBuilder={isSavingBuilder}
              isSeedingBuilder={isSeedingBuilder}
              refreshAll={refreshAll}
              saveBuilderExample={saveBuilderExample}
              seedBuilderDataset={seedBuilderDataset}
              updateBuilderDraft={updateBuilderDraft}
            />
          )}

          {LEARNING_STAGES[activeTab] && (
            <TrainingView
              batchSize={batchSize}
              baseModelId={baseModelId}
              blockSize={blockSize}
              datasetPrepareError={datasetPrepareError}
              datasetId={datasetId}
              datasets={datasetsByStage[activeTab] || []}
              evalEvery={evalEvery}
              isPreparingDataset={isPreparingDataset}
              isStartingTraining={isStartingTraining}
              isStartingPretrained={isStartingPretrained}
              cancelPretrainedJob={cancelPretrainedJob}
              cancelTrainingJob={cancelTrainingJob}
              lastProgress={lastProgress}
              learningRate={learningRate}
              loadWhenComplete={loadWhenComplete}
              modelOptions={modelOptions}
              outputModelId={outputModelId}
              prepareDataset={prepareDataset}
              pretrainedJob={pretrainedJob}
              pretrainedModels={pretrainedModels}
              progressPercent={progressPercent}
              runtimeInfo={runtimeInfo}
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
              stage={LEARNING_STAGES[activeTab]}
              startPretrainedDownload={startPretrainedDownload}
              startTraining={startTraining}
              trainingError={trainingError}
              trainingJob={trainingJob}
              trainingSteps={trainingSteps}
            />
          )}

          {activeTab === "experiments" && (
            <ExperimentsView
              experimentError={experimentError}
              experimentComparison={experimentComparison}
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
              {Object.values(LEARNING_STAGES).map((stage) => (
                <div className="rail-stage" key={stage.id}>
                  <h3>{stage.label}</h3>
                  {(datasetsByStage[stage.id] || [stage.fallbackDataset]).map(
                    (dataset) => (
                      <div className="data-row" key={dataset.dataset_id}>
                        <div>
                          <strong>{dataset.dataset_id}</strong>
                          <span>
                            {dataset.tier || "tiny"} / {dataset.byte_tokens || 0} tokens
                          </span>
                        </div>
                        <span className={dataset.exists ? "state good" : "state muted"}>
                          {dataset.exists ? "ready" : "missing"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ArchitectureView() {
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>GPTModel From Scratch</h2>
            <p>Local implementation path: token ids to embeddings to TransformerBlocks to logits.</p>
          </div>
          <span className="state good">model.py</span>
        </div>

        <div className="foundation-flow">
          {MODEL_BUILD_STEPS.map((step) => (
            <article className="foundation-card" key={step.code}>
              <span className="tier-label">{step.code}</span>
              <h3>{step.label}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>

        <div className="code-strip">
          <code>tok_emb(in_idx) + pos_emb(position_ids)</code>
          <code>trf_blocks(x)</code>
          <code>final_norm(x)</code>
          <code>{"out_head(x) -> logits"}</code>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>TransformerBlock Anatomy</h2>
            <p>The block is built from explicit modules, not a black-box GPT library call.</p>
          </div>
        </div>

        <div className="concept-columns">
          <div className="concept-section">
            <h3>Block order</h3>
            <ol className="concept-list">
              {TRANSFORMER_BLOCK_STEPS.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ol>
          </div>

          <div className="concept-section">
            <h3>Attention order</h3>
            <ol className="concept-list">
              {ATTENTION_STEPS.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tiny Config</h2>
            <p>The first model is deliberately small so every part can be inspected.</p>
          </div>
          <span className="state muted">136,704 params</span>
        </div>

        <div className="metric-grid">
          {MODEL_CONFIG_ROWS.map((row) => (
            <Metric key={row.name} label={row.name} value={`${row.value} - ${row.effect}`} />
          ))}
        </div>

        <div className="implementation-map">
          <div>
            <span>Reference learning path</span>
            <strong>{"Chapter 3 attention -> Chapter 4 GPTModel -> Chapter 5 training loop"}</strong>
          </div>
          <div>
            <span>Local model file</span>
            <strong>packages/llm_core/llm_core/model.py</strong>
          </div>
          <div>
            <span>Local training file</span>
            <strong>packages/llm_core/llm_core/training.py</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function TrainingKnobsView({
  batchSize,
  blockSize,
  evalEvery,
  learningRate,
  openTraining,
  selectedDataset,
  setBatchSize,
  setBlockSize,
  setEvalEvery,
  setLearningRate,
  setTrainingSteps,
  trainingSteps
}) {
  const steps = Number(trainingSteps) || 0;
  const batch = Number(batchSize) || 0;
  const block = Number(blockSize) || 0;
  const evalFrequency = Math.max(1, Number(evalEvery) || 1);
  const lr = Number(learningRate) || 0;
  const datasetTokens = selectedDataset?.byte_tokens || 292;
  const tokensPerStep = batch * block;
  const estimatedTokens = steps * tokensPerStep;
  const textWindows = estimateTextWindows(datasetTokens, block, 1);
  const lossSnapshots = steps > 0 ? Math.floor(steps / evalFrequency) + 1 : 0;
  const lrStatus = learningRateStatus(lr);
  const sampleTokens = selectedDataset?.prompt_style === "instruction" ? 80 : 24;

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>TrainingConfig Playground</h2>
            <p>Change the knobs that feed the same TrainingConfig used by the backend loop.</p>
          </div>
          <button className="primary-button" type="button" onClick={openTraining}>
            <Play aria-hidden="true" />
            Train
          </button>
        </div>

        <div className="knob-grid">
          <KnobControl
            label="max_steps"
            min="1"
            max="400"
            step="1"
            value={trainingSteps}
            onChange={setTrainingSteps}
          />
          <KnobControl
            label="batch_size"
            min="1"
            max="16"
            step="1"
            value={batchSize}
            onChange={setBatchSize}
          />
          <KnobControl
            label="block_size"
            min="8"
            max="128"
            step="1"
            value={blockSize}
            onChange={setBlockSize}
          />
          <KnobControl
            label="learning_rate"
            min="0.00001"
            max="0.02"
            step="0.00001"
            value={learningRate}
            onChange={setLearningRate}
          />
          <KnobControl
            label="eval_every"
            min="1"
            max="100"
            step="1"
            value={evalEvery}
            onChange={setEvalEvery}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>What Changes When You Move a Knob</h2>
            <p>These estimates make the training loop concrete before running it.</p>
          </div>
          <span className={`state ${lrStatus.className}`}>{lrStatus.label}</span>
        </div>

        <div className="metric-grid">
          <Metric label="Tokens per step" value={formatNumber(tokensPerStep)} />
          <Metric label="Estimated tokens seen" value={formatNumber(estimatedTokens)} />
          <Metric label="Text windows at stride 1" value={formatNumber(textWindows)} />
          <Metric label="Loss snapshots" value={formatNumber(lossSnapshots)} />
          <Metric label="Dataset tokens" value={formatNumber(datasetTokens)} />
          <Metric label="Sample tokens" value={sampleTokens} />
        </div>

        <div className="implementation-map">
          <div>
            <span>Optimizer update</span>
            <strong>{"zero_grad -> forward -> cross_entropy -> backward -> AdamW step"}</strong>
          </div>
          <div>
            <span>Data shape</span>
            <strong>batch_size x block_size token ids become logits for next-token prediction</strong>
          </div>
          <div>
            <span>Loss meaning</span>
            <strong>Lower loss means the model is assigning higher probability to target next tokens.</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>TrainingConfig Reference</h2>
            <p>Every parameter below maps to `packages/llm_core/llm_core/training.py`.</p>
          </div>
        </div>

        <div className="foundation-flow">
          {TRAINING_KNOBS.map((knob) => (
            <article className="foundation-card" key={knob.name}>
              <span className="tier-label">{knob.name}</span>
              <h3>{knob.valueLabel}</h3>
              <p>{knob.detail}</p>
              <strong>{configValueForKnob(knob.name, {
                batchSize,
                blockSize,
                evalEvery,
                learningRate,
                sampleTokens,
                trainingSteps
              })}</strong>
              <p>{knob.risk}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function KnobControl({ label, min, max, onChange, step, value }) {
  return (
    <label className="knob-control">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ConversationView({
  activeConversation,
  activeConversationId,
  conversationContextBudget,
  conversationContextFormat,
  conversationError,
  conversationInferenceMode,
  conversationMaxHistoryMessages,
  conversationMaxNewTokens,
  conversationMessage,
  conversationModelId,
  conversationPreview,
  conversationSystemPrompt,
  conversationTemperature,
  conversationTitle,
  conversationTopK,
  conversations,
  contextFormatOptions,
  createConversation,
  deleteConversation,
  inferenceModeOptions,
  isCreatingConversation,
  isPreviewingConversation,
  isSendingConversation,
  modelOptions,
  previewConversationContext,
  sendConversationMessage,
  setActiveConversationId,
  setConversationContextBudget,
  setConversationContextFormat,
  setConversationInferenceMode,
  setConversationMaxHistoryMessages,
  setConversationMaxNewTokens,
  setConversationMessage,
  setConversationModelId,
  setConversationSystemPrompt,
  setConversationTemperature,
  setConversationTitle,
  setConversationTopK
}) {
  const messages = activeConversation?.messages || [];
  const manualMode = conversationInferenceMode === "manual";
  const selectedModel = modelOptions.find(
    (model) => model.model_id === conversationModelId
  );
  const selectedContextFormat = contextFormatOptions.find(
    (format) => format.value === conversationContextFormat
  );
  const conversationModelWarnings = [];
  if (selectedModel?.state === "loaded-random" || selectedModel?.state === "random-untrained") {
    conversationModelWarnings.push(
      "This is a random baseline model. Byte-like repeated output is expected before training."
    );
  }
  if (
    selectedModel?.state === "loaded-pretrained" &&
    selectedModel?.model_id?.startsWith("gpt2-")
  ) {
    conversationModelWarnings.push(
      "Downloaded GPT-2 is a base next-token model, not a ChatGPT-style instruction model."
    );
  }

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Conversation</h2>
            <p>Keep a multi-turn session and control how much history enters context.</p>
          </div>
          <div className="button-row">
            {activeConversationId && (
              <button
                className="secondary-button danger"
                type="button"
                onClick={deleteConversation}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </button>
            )}
            <button
              className="primary-button"
              type="button"
              onClick={createConversation}
              disabled={isCreatingConversation}
            >
              {isCreatingConversation ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              New session
            </button>
          </div>
        </div>

        {conversations.length > 0 && (
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <button
                className={
                  activeConversationId === conversation.conversation_id
                    ? "conversation-chip active"
                    : "conversation-chip"
                }
                key={conversation.conversation_id}
                type="button"
                onClick={() => setActiveConversationId(conversation.conversation_id)}
              >
                <strong>{conversation.title}</strong>
                <span>{conversation.message_count} messages</span>
              </button>
            ))}
          </div>
        )}

        <div className="form-grid">
          <label className="field">
            <span>Title</span>
            <input
              value={conversationTitle}
              onChange={(event) => setConversationTitle(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Model</span>
            <select
              value={conversationModelId}
              onChange={(event) => setConversationModelId(event.target.value)}
            >
              {modelOptions.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Inference mode</span>
            <select
              value={conversationInferenceMode}
              onChange={(event) => setConversationInferenceMode(event.target.value)}
            >
              {inferenceModeOptions.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Context format</span>
            <select
              value={conversationContextFormat}
              onChange={(event) => setConversationContextFormat(event.target.value)}
            >
              {contextFormatOptions.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Max new tokens</span>
            <input
              type="number"
              min="1"
              max="200"
              value={conversationMaxNewTokens}
              onChange={(event) => setConversationMaxNewTokens(event.target.value)}
            />
          </label>

          <label className="field wide">
            <span>System prompt</span>
            <textarea
              rows={2}
              value={conversationSystemPrompt}
              onChange={(event) => setConversationSystemPrompt(event.target.value)}
            />
          </label>

          <label className="field">
            <span>History messages</span>
            <input
              type="number"
              min="1"
              max="40"
              value={conversationMaxHistoryMessages}
              onChange={(event) => setConversationMaxHistoryMessages(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Context token budget</span>
            <input
              type="number"
              min="1"
              max="8192"
              value={conversationContextBudget}
              onChange={(event) => setConversationContextBudget(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Temperature</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={conversationTemperature}
              onChange={(event) => setConversationTemperature(event.target.value)}
              disabled={!manualMode}
            />
            <strong>{Number(conversationTemperature).toFixed(1)}</strong>
          </label>

          <label className="field">
            <span>Top-k</span>
            <input
              type="number"
              min="1"
              max="200"
              value={conversationTopK}
              onChange={(event) => setConversationTopK(event.target.value)}
              placeholder="none"
              disabled={!manualMode}
            />
          </label>
        </div>

        {selectedContextFormat && (
          <div className="inline-note">{selectedContextFormat.detail}</div>
        )}

        {conversationModelWarnings.length > 0 && (
          <div className="warning-list">
            {conversationModelWarnings.map((warning) => (
              <div className="warning-line" key={warning}>
                {warning}
              </div>
            ))}
          </div>
        )}

        {conversationError && <div className="error-line">{conversationError}</div>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Session Messages</h2>
            <p>User and assistant turns stored in the current API session.</p>
          </div>
          {activeConversation && (
            <div className="metrics">
              <span>{activeConversation.message_count} messages</span>
              <span>{activeConversation.settings?.model_id}</span>
            </div>
          )}
        </div>

        {messages.length > 0 ? (
          <div className="conversation-thread">
            {messages.map((message) => (
              <article className={`message-row ${message.role}`} key={message.message_id}>
                <div className="message-meta">
                  <span>{message.role}</span>
                  {message.model_id && <span>{message.model_id}</span>}
                  {message.context_format && <span>{message.context_format}</span>}
                  {message.tokens_generated !== null &&
                    message.tokens_generated !== undefined && (
                      <span>{message.tokens_generated} tokens</span>
                    )}
                </div>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <History aria-hidden="true" />
            <span>No messages yet</span>
          </div>
        )}

        <div className="conversation-composer">
          <label className="field wide">
            <span>Next message</span>
            <textarea
              rows={3}
              value={conversationMessage}
              onChange={(event) => setConversationMessage(event.target.value)}
            />
          </label>
          <div className="button-row">
            <button
              className="secondary-button"
              type="button"
              onClick={previewConversationContext}
              disabled={isPreviewingConversation || !conversationMessage.trim()}
            >
              {isPreviewingConversation ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <Pencil aria-hidden="true" />
              )}
              Preview context
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={sendConversationMessage}
              disabled={isSendingConversation || !conversationMessage.trim()}
            >
              {isSendingConversation ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <Send aria-hidden="true" />
              )}
              Send
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Context Preview</h2>
            <p>The exact transcript rendered before generation.</p>
          </div>
          {conversationPreview && (
            <div className="metrics">
              <span>prompt {conversationPreview.prompt_tokens}</span>
              <span>budget {conversationPreview.context_token_budget}</span>
              <span>model ctx {conversationPreview.model_context_length}</span>
              <span>included {conversationPreview.included_messages.length}</span>
            </div>
          )}
        </div>

        {conversationPreview ? (
          <div className="template-box">
            <div className="metric-grid">
              <Metric label="Prompt tokens" value={conversationPreview.prompt_tokens} />
              <Metric
                label="Model context"
                value={conversationPreview.model_context_length}
              />
              <Metric
                label="Remaining"
                value={conversationPreview.remaining_context_tokens}
              />
              <Metric
                label="Omitted by history"
                value={conversationPreview.omitted_by_history}
              />
              <Metric
                label="Omitted by tokens"
                value={conversationPreview.omitted_by_token_budget}
              />
              <Metric
                label="Max answer"
                value={conversationPreview.settings.max_new_tokens}
              />
              <Metric
                label="Mode"
                value={conversationPreview.settings.inference_mode}
              />
              <Metric
                label="Format"
                value={conversationPreview.settings.context_format}
              />
            </div>

            {conversationPreview.warnings.length > 0 && (
              <div className="warning-list">
                {conversationPreview.warnings.map((warning) => (
                  <div className="warning-line" key={warning}>
                    {warning}
                  </div>
                ))}
              </div>
            )}

            <pre>{conversationPreview.prompt}</pre>
          </div>
        ) : (
          <div className="empty-state">
            <Pencil aria-hidden="true" />
            <span>No context preview yet</span>
          </div>
        )}
      </section>
    </div>
  );
}

function ChatView({
  chatError,
  chatModelId,
  chatResult,
  cancelChatStream,
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
          <div className="button-row">
            {isChatting && (
              <button
                className="secondary-button danger"
                type="button"
                onClick={cancelChatStream}
              >
                <XCircle aria-hidden="true" />
                Cancel
              </button>
            )}
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
              {chatResult.streaming && <span>streaming</span>}
              {chatResult.cancelled && <span>cancelled</span>}
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

function PromptPlaygroundView({
  inferenceModeOptions,
  isPreviewingPrompt,
  isRunningPromptPlayground,
  modelOptions,
  playgroundInferenceMode,
  playgroundMaxNewTokens,
  playgroundMessage,
  playgroundModelId,
  playgroundPromptStyle,
  playgroundTemplate,
  playgroundTemperature,
  playgroundTopK,
  promptPlaygroundError,
  promptPlaygroundResult,
  promptPreview,
  promptStyleOptions,
  previewPromptPlayground,
  runPromptPlayground,
  setPlaygroundInferenceMode,
  setPlaygroundMaxNewTokens,
  setPlaygroundMessage,
  setPlaygroundModelId,
  setPlaygroundPromptStyle,
  setPlaygroundTemplate,
  setPlaygroundTemperature,
  setPlaygroundTopK
}) {
  const selectedInferenceMode = inferenceModeOptions.find(
    (mode) => mode.value === playgroundInferenceMode
  );
  const selectedPromptStyle = promptStyleOptions.find(
    (style) => style.value === playgroundPromptStyle
  );
  const manualMode = playgroundInferenceMode === "manual";

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Prompt Template Playground</h2>
            <p>Compare prompt wrapping and decoding settings before generation.</p>
          </div>
          <div className="button-row">
            <button
              className="secondary-button"
              type="button"
              onClick={previewPromptPlayground}
              disabled={isPreviewingPrompt || !playgroundMessage.trim()}
            >
              {isPreviewingPrompt ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <Pencil aria-hidden="true" />
              )}
              Preview
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={runPromptPlayground}
              disabled={isRunningPromptPlayground || !playgroundMessage.trim()}
            >
              {isRunningPromptPlayground ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <Play aria-hidden="true" />
              )}
              Generate
            </button>
          </div>
        </div>

        <div className="form-grid">
          <label className="field wide">
            <span>Message</span>
            <textarea
              value={playgroundMessage}
              onChange={(event) => setPlaygroundMessage(event.target.value)}
              rows={4}
            />
          </label>

          <label className="field">
            <span>Model</span>
            <select
              value={playgroundModelId}
              onChange={(event) => setPlaygroundModelId(event.target.value)}
            >
              {modelOptions.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Prompt style</span>
            <select
              value={playgroundPromptStyle}
              onChange={(event) => setPlaygroundPromptStyle(event.target.value)}
            >
              {promptStyleOptions.map((style) => (
                <option key={style.value} value={style.value}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Inference mode</span>
            <select
              value={playgroundInferenceMode}
              onChange={(event) => setPlaygroundInferenceMode(event.target.value)}
            >
              {inferenceModeOptions.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
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
              value={playgroundMaxNewTokens}
              onChange={(event) => setPlaygroundMaxNewTokens(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Temperature</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={playgroundTemperature}
              onChange={(event) => setPlaygroundTemperature(event.target.value)}
              disabled={!manualMode}
            />
            <strong>{Number(playgroundTemperature).toFixed(1)}</strong>
          </label>

          <label className="field">
            <span>Top-k</span>
            <input
              type="number"
              min="1"
              max="200"
              value={playgroundTopK}
              onChange={(event) => setPlaygroundTopK(event.target.value)}
              placeholder="none"
              disabled={!manualMode}
            />
          </label>
        </div>

        <div className="playground-notes">
          {selectedPromptStyle && <span>{selectedPromptStyle.detail}</span>}
          {selectedInferenceMode && <span>{selectedInferenceMode.detail}</span>}
        </div>

        {playgroundPromptStyle === "custom" && (
          <label className="field template-editor">
            <span>Custom template</span>
            <textarea
              value={playgroundTemplate}
              onChange={(event) => setPlaygroundTemplate(event.target.value)}
              rows={5}
            />
          </label>
        )}

        {promptPlaygroundError && (
          <div className="error-line">{promptPlaygroundError}</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Rendered Prompt</h2>
            <p>The exact text encoded into token ids.</p>
          </div>
          {promptPreview && (
            <div className="metrics">
              <span>{promptPreview.effective_prompt_style}</span>
              <span>{promptPreview.inference_mode}</span>
              <span>temp {formatMaybeNumber(promptPreview.temperature)}</span>
              <span>top-k {formatMaybeNumber(promptPreview.top_k)}</span>
            </div>
          )}
        </div>

        {promptPreview ? (
          <div className="template-box">
            <div className="metric-grid">
              <div className="metric-cell">
                <span>Prompt tokens</span>
                <strong>{promptPreview.prompt_tokens}</strong>
              </div>
              <div className="metric-cell">
                <span>Context length</span>
                <strong>{promptPreview.context_length}</strong>
              </div>
              <div className="metric-cell">
                <span>Remaining context</span>
                <strong>{promptPreview.remaining_context_tokens}</strong>
              </div>
            </div>

            {promptPreview.warnings?.length > 0 && (
              <div className="warning-list">
                {promptPreview.warnings.map((warning) => (
                  <div className="warning-line" key={warning}>
                    {warning}
                  </div>
                ))}
              </div>
            )}

            <pre>{promptPreview.prompt}</pre>
          </div>
        ) : (
          <div className="empty-state">
            <Pencil aria-hidden="true" />
            <span>No prompt preview yet</span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Generated Reply</h2>
            <p>Same model, same message, different prompt and decoding choices.</p>
          </div>
          {promptPlaygroundResult && (
            <div className="metrics">
              <span>prompt tokens {promptPlaygroundResult.prompt_tokens}</span>
              <span>generated {promptPlaygroundResult.tokens_generated}</span>
            </div>
          )}
        </div>

        {promptPlaygroundResult ? (
          <div className="output-box">
            <div className="metrics">
              <span>{promptPlaygroundResult.prompt_style}</span>
              <span>{promptPlaygroundResult.inference_mode}</span>
              <span>temp {formatMaybeNumber(promptPlaygroundResult.temperature)}</span>
              <span>top-k {formatMaybeNumber(promptPlaygroundResult.top_k)}</span>
            </div>
            <pre>{formatText(promptPlaygroundResult.reply)}</pre>
          </div>
        ) : (
          <div className="empty-state">
            <Play aria-hidden="true" />
            <span>No generated reply yet</span>
          </div>
        )}
      </section>
    </div>
  );
}

function ExternalModelView({
  compareExternalModel,
  externalCompareResults,
  externalError,
  externalInferenceMode,
  externalLocalModelId,
  externalMaxNewTokens,
  externalMessage,
  externalModelId,
  externalModelOptions,
  externalPreview,
  externalPromptStyle,
  externalSystemPrompt,
  externalTemplate,
  externalTemperature,
  externalTopK,
  inferenceModeOptions,
  isComparingExternal,
  isPreviewingExternal,
  localModelOptions,
  previewExternalModel,
  promptStyleOptions,
  selectedExternalModel,
  setExternalInferenceMode,
  setExternalLocalModelId,
  setExternalMaxNewTokens,
  setExternalMessage,
  setExternalModelId,
  setExternalPromptStyle,
  setExternalSystemPrompt,
  setExternalTemplate,
  setExternalTemperature,
  setExternalTopK
}) {
  const manualMode = externalInferenceMode === "manual";
  const selectedInferenceMode = inferenceModeOptions.find(
    (mode) => mode.value === externalInferenceMode
  );
  const selectedPromptStyle = promptStyleOptions.find(
    (style) => style.value === externalPromptStyle
  );

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>External Model Integration</h2>
            <p>Compare a local checkpoint with a provider-backed model.</p>
          </div>
          <div className="button-row">
            <button
              className="secondary-button"
              type="button"
              onClick={previewExternalModel}
              disabled={isPreviewingExternal || !externalMessage.trim()}
            >
              {isPreviewingExternal ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <Pencil aria-hidden="true" />
              )}
              Preview
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={compareExternalModel}
              disabled={isComparingExternal || !externalMessage.trim()}
            >
              {isComparingExternal ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <GitCompareArrows aria-hidden="true" />
              )}
              Compare
            </button>
          </div>
        </div>

        <div className="foundation-flow">
          {externalModelOptions.map((model) => (
            <button
              className={
                externalModelId === model.model_id
                  ? "dataset-card active"
                  : "dataset-card"
              }
              key={`${model.provider}-${model.model_id}`}
              type="button"
              onClick={() => setExternalModelId(model.model_id)}
            >
              <div className="dataset-card-heading">
                <span className={`state ${stateClass(model.state)}`}>
                  {model.state}
                </span>
                <h3>{model.label}</h3>
              </div>
              <p>{model.description}</p>
              <div className="dataset-meta">
                <span>{model.provider}</span>
                <span>{model.provider_model_name || "model unset"}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label className="field wide">
            <span>Message</span>
            <textarea
              value={externalMessage}
              onChange={(event) => setExternalMessage(event.target.value)}
              rows={4}
            />
          </label>

          <label className="field wide">
            <span>System prompt</span>
            <textarea
              value={externalSystemPrompt}
              onChange={(event) => setExternalSystemPrompt(event.target.value)}
              rows={2}
            />
          </label>

          <label className="field">
            <span>Local model</span>
            <select
              value={externalLocalModelId}
              onChange={(event) => setExternalLocalModelId(event.target.value)}
            >
              {localModelOptions.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>External model</span>
            <select
              value={externalModelId}
              onChange={(event) => setExternalModelId(event.target.value)}
            >
              {externalModelOptions.map((model) => (
                <option key={`${model.provider}-${model.model_id}`} value={model.model_id}>
                  {formatExternalModelLabel(model)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Prompt style</span>
            <select
              value={externalPromptStyle}
              onChange={(event) => setExternalPromptStyle(event.target.value)}
            >
              {promptStyleOptions.map((style) => (
                <option key={style.value} value={style.value}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Inference mode</span>
            <select
              value={externalInferenceMode}
              onChange={(event) => setExternalInferenceMode(event.target.value)}
            >
              {inferenceModeOptions.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Max tokens</span>
            <input
              type="number"
              min="1"
              max="2000"
              value={externalMaxNewTokens}
              onChange={(event) => setExternalMaxNewTokens(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Temperature</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={externalTemperature}
              onChange={(event) => setExternalTemperature(event.target.value)}
              disabled={!manualMode}
            />
            <strong>{Number(externalTemperature).toFixed(1)}</strong>
          </label>

          <label className="field">
            <span>Top-k</span>
            <input
              type="number"
              min="1"
              max="200"
              value={externalTopK}
              onChange={(event) => setExternalTopK(event.target.value)}
              placeholder="none"
              disabled={!manualMode}
            />
          </label>
        </div>

        <div className="playground-notes">
          <span>{selectedExternalModel?.base_url || "base URL unset"}</span>
          {selectedPromptStyle && <span>{selectedPromptStyle.detail}</span>}
          {selectedInferenceMode && <span>{selectedInferenceMode.detail}</span>}
        </div>

        {externalPromptStyle === "custom" && (
          <label className="field template-editor">
            <span>Custom template</span>
            <textarea
              value={externalTemplate}
              onChange={(event) => setExternalTemplate(event.target.value)}
              rows={5}
            />
          </label>
        )}

        {externalError && <div className="error-line">{externalError}</div>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>External Request Preview</h2>
            <p>The request shape sent by the API server to the provider.</p>
          </div>
          {externalPreview && (
            <div className="metrics">
              <span>{externalPreview.provider}</span>
              <span>{externalPreview.prompt_style}</span>
              <span>{externalPreview.inference_mode}</span>
              <span>est tokens {externalPreview.estimated_prompt_tokens}</span>
            </div>
          )}
        </div>

        {externalPreview ? (
          <div className="comparison-grid">
            <div className="template-box">
              <h3>Rendered prompt</h3>
              <pre>{externalPreview.prompt}</pre>
            </div>
            <div className="template-box">
              <h3>Messages payload</h3>
              <pre>{JSON.stringify(externalPreview.messages, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <Server aria-hidden="true" />
            <span>No external request preview yet</span>
          </div>
        )}

        {externalPreview?.unsupported_settings?.length > 0 && (
          <div className="warning-list">
            {externalPreview.unsupported_settings.map((warning) => (
              <div className="warning-line" key={warning}>
                {warning}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Local vs External</h2>
            <p>Run the same message against both sides.</p>
          </div>
        </div>

        {externalCompareResults ? (
          <div className="comparison-grid">
            <ExternalResultColumn
              result={externalCompareResults.local}
              title={externalLocalModelId}
            />
            <ExternalResultColumn
              result={externalCompareResults.external}
              title={formatExternalModelLabel(selectedExternalModel)}
            />
          </div>
        ) : (
          <div className="empty-state">
            <GitCompareArrows aria-hidden="true" />
            <span>No comparison yet</span>
          </div>
        )}
      </section>
    </div>
  );
}

function ExternalResultColumn({ result, title }) {
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
        <span>prompt {formatMaybeNumber(result.data.prompt_tokens)}</span>
        {result.data.estimated_prompt_tokens && (
          <span>est {result.data.estimated_prompt_tokens}</span>
        )}
        <span>generated {formatMaybeNumber(result.data.tokens_generated)}</span>
        {result.data.latency_ms && <span>{result.data.latency_ms} ms</span>}
        {result.data.inference_mode && <span>{result.data.inference_mode}</span>}
      </div>
      <pre>{formatText(result.data.reply)}</pre>
    </div>
  );
}

function DeploymentView({
  deploymentBatchSize,
  deploymentBlockSize,
  deploymentConcurrentRequests,
  deploymentError,
  deploymentEstimate,
  deploymentIncludeTraining,
  deploymentMaxNewTokens,
  deploymentModelId,
  deploymentPrecision,
  deploymentProfile,
  deploymentPromptTokens,
  estimateDeploymentResources,
  isEstimatingDeployment,
  modelOptions,
  runtimeInfo,
  setDeploymentBatchSize,
  setDeploymentBlockSize,
  setDeploymentConcurrentRequests,
  setDeploymentIncludeTraining,
  setDeploymentMaxNewTokens,
  setDeploymentModelId,
  setDeploymentPrecision,
  setDeploymentPromptTokens
}) {
  const limits = deploymentProfile?.limits || {};
  const deploymentModes = deploymentProfile?.deployment_modes || [];
  const selectedModel = modelOptions.find(
    (model) => model.model_id === deploymentModelId
  );

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Deployment and Resource Limits</h2>
            <p>Estimate the practical limits before moving from local learning to serving.</p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={estimateDeploymentResources}
            disabled={isEstimatingDeployment}
          >
            {isEstimatingDeployment ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : (
              <SlidersHorizontal aria-hidden="true" />
            )}
            Estimate
          </button>
        </div>

        <div className="metric-grid">
          <Metric label="Runtime" value={formatRuntimeLabel(runtimeInfo)} />
          <Metric label="Torch" value={runtimeInfo?.torch_version || "-"} />
          <Metric label="CUDA" value={runtimeInfo?.cuda_available ? "available" : "not available"} />
          <Metric label="Chat max tokens" value={limits.chat_max_new_tokens || 200} />
          <Metric label="Training workers" value={deploymentProfile?.server?.training_executor_workers || 1} />
          <Metric label="Model lock" value="per local model" />
        </div>

        <div className="foundation-flow deployment-modes">
          {deploymentModes.map((mode) => (
            <article className="foundation-card" key={mode.id}>
              <span className="tier-label">{mode.id}</span>
              <h3>{mode.label}</h3>
              {mode.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Resource Estimator</h2>
            <p>Change context, concurrency, precision, and training knobs.</p>
          </div>
          {selectedModel && (
            <div className="metrics">
              <span>{selectedModel.parameters ? formatNumber(selectedModel.parameters) : "-"} params</span>
              <span>{selectedModel.context_length || "-"} ctx</span>
              <span>{selectedModel.state}</span>
            </div>
          )}
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Model</span>
            <select
              value={deploymentModelId}
              onChange={(event) => setDeploymentModelId(event.target.value)}
            >
              {modelOptions.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Prompt tokens</span>
            <input
              type="number"
              min="0"
              max="8192"
              value={deploymentPromptTokens}
              onChange={(event) => setDeploymentPromptTokens(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Max new tokens</span>
            <input
              type="number"
              min="1"
              max="2000"
              value={deploymentMaxNewTokens}
              onChange={(event) => setDeploymentMaxNewTokens(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Concurrent requests</span>
            <input
              type="number"
              min="1"
              max="64"
              value={deploymentConcurrentRequests}
              onChange={(event) => setDeploymentConcurrentRequests(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Precision</span>
            <select
              value={deploymentPrecision}
              onChange={(event) => setDeploymentPrecision(event.target.value)}
            >
              <option value="fp32">fp32</option>
              <option value="fp16">fp16</option>
              <option value="int8">int8</option>
            </select>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={deploymentIncludeTraining}
              onChange={(event) => setDeploymentIncludeTraining(event.target.checked)}
            />
            Include training estimate
          </label>

          <label className="field">
            <span>Batch size</span>
            <input
              type="number"
              min="1"
              max="64"
              value={deploymentBatchSize}
              onChange={(event) => setDeploymentBatchSize(event.target.value)}
              disabled={!deploymentIncludeTraining}
            />
          </label>

          <label className="field">
            <span>Block size</span>
            <input
              type="number"
              min="2"
              max="1024"
              value={deploymentBlockSize}
              onChange={(event) => setDeploymentBlockSize(event.target.value)}
              disabled={!deploymentIncludeTraining}
            />
          </label>
        </div>

        {deploymentError && <div className="error-line">{deploymentError}</div>}

        {deploymentEstimate && (
          <div className="output-box">
            <h3>Estimated resource shape</h3>
            <div className="metric-grid">
              <Metric
                label="Parameter memory"
                value={formatBytes(deploymentEstimate.inference.parameter_bytes)}
              />
              <Metric
                label="KV cache concept"
                value={formatBytes(deploymentEstimate.inference.kv_cache_like_bytes)}
              />
              <Metric
                label="Context work"
                value={formatBytes(deploymentEstimate.inference.local_context_work_bytes)}
              />
              <Metric
                label="Attention scratch"
                value={formatBytes(deploymentEstimate.inference.attention_scratch_bytes)}
              />
              <Metric
                label="Inference total"
                value={formatBytes(deploymentEstimate.inference.total_estimated_bytes)}
              />
              <Metric
                label="Training total"
                value={formatBytes(deploymentEstimate.training.total_estimated_bytes)}
              />
            </div>

            <div className="implementation-map">
              <div>
                <span>Effective context</span>
                <strong>
                  {deploymentEstimate.request.effective_context_tokens} /{" "}
                  {deploymentEstimate.model.context_length} tokens
                </strong>
              </div>
              <div>
                <span>Model shape</span>
                <strong>
                  {deploymentEstimate.model.n_layers} layers,{" "}
                  {deploymentEstimate.model.n_heads} heads, emb{" "}
                  {deploymentEstimate.model.emb_dim}
                </strong>
              </div>
              <div>
                <span>Serving caveat</span>
                <strong>{deploymentEstimate.notes[1]}</strong>
              </div>
            </div>

            {deploymentEstimate.warnings.length > 0 && (
              <div className="warning-list">
                {deploymentEstimate.warnings.map((warning) => (
                  <div className="warning-line" key={warning}>
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Deployment Checklist</h2>
            <p>Keep these boundaries explicit when packaging the learning app.</p>
          </div>
        </div>

        <div className="implementation-map">
          <div>
            <span>API process</span>
            <strong>Run FastAPI from the project `.venv`; model weights and provider secrets stay server-side.</strong>
          </div>
          <div>
            <span>Web process</span>
            <strong>Build or run the Next.js console with `NEXT_PUBLIC_API_BASE_URL` pointing at the API.</strong>
          </div>
          <div>
            <span>Local models</span>
            <strong>CPU is enough for tiny lessons; GPT-2 fine-tuning needs CUDA for reasonable time.</strong>
          </div>
          <div>
            <span>External models</span>
            <strong>External providers remove local model memory pressure but add network latency, cost, and rate limits.</strong>
          </div>
          <div>
            <span>Training jobs</span>
            <strong>The current teaching backend runs one training/pretrained job worker, keeping behavior simple and observable.</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function PretrainedView({
  cancelPretrainedJob,
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
        <div className="button-row">
          {(pretrainedJob?.status === "queued" || pretrainedJob?.status === "running") && (
            <button
              className="secondary-button danger"
              type="button"
              onClick={cancelPretrainedJob}
            >
              <XCircle aria-hidden="true" />
              Cancel
            </button>
          )}
          <button className="secondary-button" type="button" onClick={refreshAll}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
        </div>
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
              disabled={
                isStartingPretrained ||
                pretrainedJob?.status === "queued" ||
                pretrainedJob?.status === "running"
              }
            >
              {isStartingPretrained ||
              pretrainedJob?.status === "queued" ||
              pretrainedJob?.status === "running" ? (
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

function DatasetBuilderView({
  builderDataset,
  builderDraft,
  builderError,
  clearBuilderDraft,
  deleteBuilderExample,
  deletingBuilderExampleId,
  editBuilderExample,
  isSavingBuilder,
  isSeedingBuilder,
  refreshAll,
  saveBuilderExample,
  seedBuilderDataset,
  updateBuilderDraft
}) {
  const examples = builderDataset?.examples || [];
  const trainCount =
    builderDataset?.train_examples ??
    examples.filter((example) => example.split === "train").length;
  const evalCount =
    builderDataset?.eval_examples ??
    examples.filter((example) => example.split === "eval").length;
  const isEditing = Boolean(builderDraft.example_id);

  return (
    <section className="panel dataset-builder-panel">
      <div className="panel-heading">
        <div>
          <h2>Dataset Builder</h2>
          <p>Create instruction examples, assign train/eval split, then train below.</p>
        </div>
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={refreshAll}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={seedBuilderDataset}
            disabled={isSeedingBuilder}
          >
            {isSeedingBuilder ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : (
              <Database aria-hidden="true" />
            )}
            Seed
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Dataset" value={builderDataset?.dataset_id || "instruction-builder"} />
        <Metric label="Train examples" value={trainCount} />
        <Metric label="Eval examples" value={evalCount} />
        <Metric label="File" value={builderDataset?.path || "data/custom/instruction-builder.json"} />
        <Metric label="Objective" value={builderDataset?.training_objective || "instruction-sft"} />
        <Metric label="Base model" value={builderDataset?.recommended_base_model_id || "gpt2-124M"} />
      </div>

      {builderError && <div className="error-line">{builderError}</div>}

      <form className="builder-form" onSubmit={saveBuilderExample}>
        <div className="form-grid">
          <label className="field">
            <span>Split</span>
            <select
              value={builderDraft.split}
              onChange={(event) => updateBuilderDraft("split", event.target.value)}
            >
              <option value="train">train</option>
              <option value="eval">eval</option>
            </select>
          </label>

          <label className="field wide">
            <span>Instruction</span>
            <textarea
              value={builderDraft.instruction}
              onChange={(event) => updateBuilderDraft("instruction", event.target.value)}
              placeholder="Explain what a model checkpoint is in one sentence."
              required
            />
          </label>

          <label className="field wide">
            <span>Input</span>
            <textarea
              value={builderDraft.input}
              onChange={(event) => updateBuilderDraft("input", event.target.value)}
              placeholder="Optional extra input for the instruction."
            />
          </label>

          <label className="field wide">
            <span>Output</span>
            <textarea
              value={builderDraft.output}
              onChange={(event) => updateBuilderDraft("output", event.target.value)}
              placeholder="A model checkpoint is a saved snapshot of model weights and metadata."
              required
            />
          </label>
        </div>

        <div className="builder-form-actions">
          <button className="primary-button" type="submit" disabled={isSavingBuilder}>
            {isSavingBuilder ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : isEditing ? (
              <Pencil aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {isEditing ? "Update example" : "Add example"}
          </button>
          <button className="secondary-button" type="button" onClick={clearBuilderDraft}>
            Clear
          </button>
        </div>
      </form>

      <div className="builder-list">
        {examples.length === 0 ? (
          <div className="empty-state">
            <Database aria-hidden="true" />
            <span>No custom examples yet</span>
          </div>
        ) : (
          examples.map((example) => (
            <article className="builder-example-row" key={example.example_id}>
              <div className="builder-example-body">
                <div className="builder-example-heading">
                  <span
                    className={
                      example.split === "train" ? "state good" : "state active-state"
                    }
                  >
                    {example.split}
                  </span>
                  <strong>{example.instruction}</strong>
                </div>
                <div className="builder-example-fields">
                  <div>
                    <span>Input</span>
                    <p>{example.input || "-"}</p>
                  </div>
                  <div>
                    <span>Output</span>
                    <p>{example.output}</p>
                  </div>
                </div>
              </div>
              <div className="builder-example-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => editBuilderExample(example)}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </button>
                <button
                  className="secondary-button danger"
                  type="button"
                  onClick={() => deleteBuilderExample(example)}
                  disabled={deletingBuilderExampleId === example.example_id}
                >
                  {deletingBuilderExampleId === example.example_id ? (
                    <LoaderCircle aria-hidden="true" className="spin" />
                  ) : (
                    <Trash2 aria-hidden="true" />
                  )}
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function TrainingView({
  batchSize,
  baseModelId,
  blockSize,
  cancelPretrainedJob,
  cancelTrainingJob,
  datasetPrepareError,
  datasetId,
  datasets,
  evalEvery,
  isPreparingDataset,
  isStartingTraining,
  isStartingPretrained,
  lastProgress,
  learningRate,
  loadWhenComplete,
  modelOptions,
  outputModelId,
  prepareDataset,
  pretrainedJob,
  pretrainedModels,
  progressPercent,
  runtimeInfo,
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
  stage,
  startPretrainedDownload,
  startTraining,
  trainingError,
  trainingJob,
  trainingSteps
}) {
  const gpt2Small =
    pretrainedModels.find((model) => model.model_size === "124M") ||
    pretrainedModels.find((model) => model.model_id === "gpt2-124M") || {
      model_size: "124M",
      model_id: "gpt2-124M",
      label: "GPT-2 small",
      parameters: 124000000,
      downloaded: false
    };
  const gpt2Loaded = modelOptions.some(
    (model) => model.model_id === "gpt2-124M" && model.state !== "not-loaded"
  );
  const isLoraStage = stage.id === "lora";
  const isChatStage = stage.id === "chat-sft";
  const isBuilderStage = stage.id === "dataset-builder";
  const showInstructionLoop =
    stage.id === "instruction" || isLoraStage || isChatStage || isBuilderStage;
  const trainingIsActive =
    trainingJob?.status === "queued" || trainingJob?.status === "running";
  const builderHasTrainExamples =
    !isBuilderStage || (selectedDataset?.train_examples || 0) > 0;
  const datasetKnownByApi =
    !selectedDataset ||
    datasets.length === 0 ||
    datasets.some((dataset) => dataset.dataset_id === selectedDataset.dataset_id);
  const datasetApiMismatch = Boolean(selectedDataset && !datasetKnownByApi);
  const beforeTitle =
    stage.id === "instruction"
      ? "Before (raw GPT-2)"
      : isLoraStage
        ? "Before (frozen GPT-2)"
        : isChatStage
          ? "Before (base GPT-2 chat prompt)"
          : isBuilderStage
            ? "Before (GPT-2 base)"
            : "Before (base)";
  const afterTitle =
    stage.id === "instruction"
      ? "After (instruction SFT)"
      : isLoraStage
        ? "After (LoRA merged)"
        : isChatStage
          ? "After (chat LoRA merged)"
          : isBuilderStage
            ? "After (custom SFT)"
            : "After";

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{stage.title}</h2>
          <p>{stage.description}</p>
        </div>
        <div className="button-row">
          {trainingIsActive && (
            <button
              className="secondary-button danger"
              type="button"
              onClick={cancelTrainingJob}
            >
              <XCircle aria-hidden="true" />
              Cancel
            </button>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={startTraining}
            disabled={
              isStartingTraining ||
              trainingIsActive ||
              !builderHasTrainExamples ||
              datasetApiMismatch
            }
          >
            {isStartingTraining ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : (
              <Play aria-hidden="true" />
            )}
            Start
          </button>
        </div>
      </div>

      <DatasetLadder
        datasetId={datasetId}
        datasets={datasets}
        selectDataset={selectDataset}
      />

      {showInstructionLoop && (
        <InstructionLoopPanel
          datasetPrepareError={datasetPrepareError}
          gpt2Loaded={gpt2Loaded}
          gpt2Small={gpt2Small}
          isPreparingDataset={isPreparingDataset}
          isStartingPretrained={isStartingPretrained}
          cancelPretrainedJob={cancelPretrainedJob}
          prepareDataset={prepareDataset}
          pretrainedJob={pretrainedJob}
          runtimeInfo={runtimeInfo}
          datasetApiMismatch={datasetApiMismatch}
          selectedDataset={selectedDataset}
          stage={stage}
          startPretrainedDownload={startPretrainedDownload}
        />
      )}

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
            {selectedDataset.train_examples !== undefined && (
              <span>train {selectedDataset.train_examples}</span>
            )}
            {selectedDataset.eval_examples !== undefined && (
              <span>eval {selectedDataset.eval_examples}</span>
            )}
          </div>
          <div className="prompt-pair">
            <div>
              <span>Learning goal</span>
              <strong>{selectedDataset.learning_goal || stage.description}</strong>
            </div>
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
      {!builderHasTrainExamples && (
        <div className="warning-line">
          Add at least one train example before starting custom instruction training.
        </div>
      )}
      {datasetApiMismatch && (
        <div className="warning-line">
          The Web UI knows {selectedDataset.dataset_id}, but the running API does
          not. Restart or reload the API process, then refresh the Web UI.
        </div>
      )}

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
            <span>{trainingJob.result?.training_summary?.tuning_method || "training"}</span>
            <span>
              device {trainingJob.result?.training_summary?.device || formatRuntimeLabel(runtimeInfo)}
            </span>
            {trainingJob.result?.training_summary?.trainable_percent !== undefined && (
              <span>
                trainable {trainingJob.result.training_summary.trainable_percent}%
              </span>
            )}
            {trainingJob.result?.training_summary?.examples_used_for_training !== undefined && (
              <span>
                examples{" "}
                {trainingJob.result.training_summary.examples_used_for_training}
              </span>
            )}
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
                title={beforeTitle}
                text={trainingJob.result.training_summary.before_sample}
              />
              <OutputColumn
                title={afterTitle}
                text={trainingJob.result.training_summary.sample_text}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InstructionLoopPanel({
  cancelPretrainedJob,
  datasetApiMismatch,
  datasetPrepareError,
  gpt2Loaded,
  gpt2Small,
  isPreparingDataset,
  isStartingPretrained,
  prepareDataset,
  pretrainedJob,
  runtimeInfo,
  selectedDataset,
  stage,
  startPretrainedDownload
}) {
  const latestPretrainedProgress = pretrainedJob?.progress?.at(-1);
  const datasetReady = Boolean(selectedDataset?.exists);
  const isCpuRuntime = runtimeInfo?.device === "cpu";
  const isLoraStage = stage?.id === "lora";
  const isChatStage = stage?.id === "chat-sft";
  const isBuilderStage = stage?.id === "dataset-builder";
  const templatePreview =
    selectedDataset?.chat_template || selectedDataset?.instruction_template || "";
  const chatMessagesPreview = selectedDataset?.chat_example?.messages
    ?.map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return (
    <div className="instruction-loop">
      <div className="loop-grid">
        <div className="loop-step">
          <span className={datasetReady ? "state good" : "state muted"}>
            {datasetReady ? "ready" : "missing"}
          </span>
          <h3>
            {isChatStage
              ? "Chat data"
              : isBuilderStage
                ? "Custom data"
                : "Instruction data"}
          </h3>
          <p>
            {isChatStage
              ? `${selectedDataset?.chat_training_pairs || 0} assistant targets`
              : isBuilderStage
              ? `${selectedDataset?.train_examples || 0} train / ${
                  selectedDataset?.eval_examples || 0
                } eval`
              : `${selectedDataset?.example_count || 0} examples`}
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => prepareDataset(selectedDataset)}
            disabled={isPreparingDataset || datasetReady || datasetApiMismatch}
          >
            {isPreparingDataset ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : (
              <Database aria-hidden="true" />
            )}
            {isBuilderStage
              ? datasetReady
                ? "Builder ready"
                : "Create dataset"
              : datasetReady
                ? "Dataset ready"
                : "Download dataset"}
          </button>
        </div>

        <div className="loop-step">
          <span className={gpt2Loaded ? "state good" : "state muted"}>
            {gpt2Loaded ? "loaded" : "not loaded"}
          </span>
          <h3>GPT-2 base</h3>
          <p>{gpt2Small.label || "GPT-2 small"}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => startPretrainedDownload(gpt2Small, null)}
            disabled={isStartingPretrained || gpt2Loaded}
          >
            {isStartingPretrained ? (
              <LoaderCircle aria-hidden="true" className="spin" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {gpt2Loaded ? "Base loaded" : gpt2Small.downloaded ? "Load GPT-2" : "Download GPT-2"}
          </button>
          {(pretrainedJob?.status === "queued" || pretrainedJob?.status === "running") && (
            <button
              className="secondary-button danger"
              type="button"
              onClick={cancelPretrainedJob}
            >
              <XCircle aria-hidden="true" />
              Cancel
            </button>
          )}
          {latestPretrainedProgress?.message && (
            <span className="loop-note">{latestPretrainedProgress.message}</span>
          )}
        </div>

        <div className="loop-step">
          <span className={runtimeInfo?.device === "cuda" ? "state good" : "state active-state"}>
            {runtimeInfo?.device === "cuda" ? "gpu" : "cpu"}
          </span>
          <h3>
            {isChatStage
              ? "Chat LoRA"
              : isLoraStage
              ? "LoRA adapters"
              : isBuilderStage
                ? "Custom SFT"
                : "Instruction SFT"}
          </h3>
          <p>
            {isChatStage
              ? "Freeze GPT-2, train LoRA adapters on multi-turn transcripts, then merge into a chat checkpoint."
              : isLoraStage
              ? "Freeze GPT-2, train low-rank adapters, merge into a checkpoint."
              : isBuilderStage
                ? "Only train split examples update the model; eval examples stay reserved for comparison."
                : "Run training, load the checkpoint, then compare before and after."}
          </p>
          <span className="loop-note">runtime {formatRuntimeLabel(runtimeInfo)}</span>
        </div>
      </div>

      {datasetPrepareError && <div className="error-line">{datasetPrepareError}</div>}
      {isCpuRuntime && (
        <div className="warning-line">
          {isLoraStage || isChatStage
            ? "CPU-only runtime: LoRA trains far fewer parameters, but GPT-2 still needs forward/backward passes. CUDA is still recommended."
            : "CPU-only runtime: GPT-2 SFT is suitable only as a short smoke test here. Use a CUDA PyTorch install for reasonable training time."}
        </div>
      )}

      <div className="instruction-preview">
        <div className="template-box">
          <h3>Prompt template</h3>
          <pre>{templatePreview}</pre>
        </div>
        <div className="template-box">
          <h3>Dataset example</h3>
          {isChatStage && selectedDataset?.chat_example ? (
            <>
              <Metric
                label="System"
                value={selectedDataset.chat_example.system || "-"}
              />
              <Metric label="Turns" value={chatMessagesPreview || "-"} />
              <Metric label="Target response" value={selectedDataset.target_response_preview} />
            </>
          ) : selectedDataset?.instruction_example ? (
            <>
              <Metric
                label="Instruction"
                value={selectedDataset.instruction_example.instruction}
              />
              <Metric label="Input" value={selectedDataset.instruction_example.input || "-"} />
              <Metric label="Target response" value={selectedDataset.target_response_preview} />
            </>
          ) : (
            <p>No local instruction example yet.</p>
          )}
        </div>
      </div>

      {selectedDataset?.formatted_prompt_preview && (
        <div className="template-box">
          <h3>Formatted model input</h3>
          <pre>{selectedDataset.formatted_prompt_preview}</pre>
        </div>
      )}
    </div>
  );
}

function RuntimePill({ apiStatus, runtimeInfo }) {
  if (apiStatus !== "online" || !runtimeInfo) {
    return (
      <span className="status-pill runtime muted">
        <Server aria-hidden="true" />
        Runtime unknown
      </span>
    );
  }

  const isCuda = runtimeInfo.device === "cuda";
  return (
    <span
      className={`status-pill runtime ${isCuda ? "online" : "warning"}`}
      title={formatRuntimeTitle(runtimeInfo)}
    >
      <Server aria-hidden="true" />
      {formatRuntimeLabel(runtimeInfo)}
    </span>
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
          <p>{dataset.learning_goal || dataset.description}</p>
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
  experimentComparison,
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

            <ExperimentCompareSummary comparison={experimentComparison} />

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
                  {experiment.model_version_label && (
                    <span>{experiment.model_version_label}</span>
                  )}
                  <span>{experiment.training_objective || "text"}</span>
                  <span>{experiment.tuning_method || "full"}</span>
                  {experiment.trainable_percent !== undefined && (
                    <span>trainable {experiment.trainable_percent}%</span>
                  )}
                  {experiment.examples_used_for_training !== undefined && (
                    <span>examples {experiment.examples_used_for_training}</span>
                  )}
                  <span>device {experiment.device || "-"}</span>
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

function ExperimentCompareSummary({ comparison }) {
  if (!comparison) {
    return null;
  }

  const flags = [
    { label: "Prompt", value: comparison.same.prompt },
    { label: "Dataset", value: comparison.same.dataset },
    { label: "Base", value: comparison.same.baseModel },
    { label: "Objective", value: comparison.same.objective },
    { label: "Tuning", value: comparison.same.tuning }
  ];

  return (
    <div className="comparison-summary">
      <div className="comparison-summary-heading">
        <div>
          <h3>Comparison Summary</h3>
          <p>Right experiment minus left experiment.</p>
        </div>
        <div className="comparison-flags">
          {flags.map((flag) => (
            <span
              className={flag.value ? "state good" : "state active-state"}
              key={flag.label}
            >
              {flag.label} {flag.value ? "same" : "diff"}
            </span>
          ))}
        </div>
      </div>

      <div className="delta-grid">
        {comparison.deltas.map((delta) => (
          <div className={`delta-cell ${delta.status}`} key={delta.key}>
            <span>{delta.label}</span>
            <strong>{formatDelta(delta.delta)}</strong>
            <small>
              {formatMaybeNumber(delta.left)} {"->"} {formatMaybeNumber(delta.right)}
            </small>
          </div>
        ))}
      </div>

      <div className="comparison-notes">
        {comparison.notes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
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
        <Metric
          label="Version"
          value={experiment.model_version_label || experiment.model_version_id || "-"}
        />
        <Metric label="Base model" value={experiment.base_model_id || "-"} />
        <Metric label="Checkpoint" value={experiment.checkpoint_id || "-"} />
        <Metric label="Dataset" value={experiment.dataset_id} />
        <Metric label="Objective" value={experiment.training_objective || "text"} />
        <Metric label="Tuning" value={experiment.tuning_method || "full"} />
        <Metric
          label="Trainable"
          value={
            experiment.trainable_percent !== undefined
              ? `${experiment.trainable_percent}%`
              : "-"
          }
        />
        <Metric
          label="Examples used"
          value={experiment.examples_used_for_training ?? "-"}
        />
        <Metric label="Train split" value={experiment.train_examples ?? "-"} />
        <Metric label="Eval split" value={experiment.eval_examples ?? "-"} />
        <Metric label="Final loss" value={formatMaybeNumber(experiment.final_loss)} />
        <Metric label="Device" value={experiment.device || "-"} />
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
          <h2>Model Versions</h2>
          <p>Inspect checkpoint lineage, training config, and saved metrics.</p>
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

        {checkpoints.map((checkpoint) => {
          const summary = checkpoint.training_summary || {};
          const lineage = checkpoint.lineage || {};
          const runConfig = checkpoint.run_config || {};
          return (
            <article className="checkpoint-row" key={checkpoint.checkpoint_id}>
              <div>
                <h3>{checkpoint.version_label || checkpoint.model_id}</h3>
                <p>{checkpoint.checkpoint_id}</p>
                <div className="version-lineage">
                  <span>{lineage.parent_model_id || checkpoint.base_model_id}</span>
                  <strong>{"->"}</strong>
                  <span>{lineage.model_id || checkpoint.model_id}</span>
                </div>
                <div className="metrics">
                  <span>version {checkpoint.version_id || "-"}</span>
                  <span>model {checkpoint.model_id}</span>
                  <span>dataset {runConfig.dataset_id || summary.dataset_id || "-"}</span>
                  <span>{runConfig.training_objective || summary.training_objective || "text"}</span>
                  <span>{runConfig.tuning_method || summary.tuning_method || "full"}</span>
                  <span>loss {formatMaybeNumber(summary.final_loss)}</span>
                  <span>tokens {summary.tokens_seen ?? "-"}</span>
                  <span>steps {runConfig.max_steps || summary.max_steps || "-"}</span>
                  <span>lr {runConfig.learning_rate || summary.learning_rate || "-"}</span>
                  <span>{formatBytes(checkpoint.size_bytes)}</span>
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
          );
        })}
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

async function readNdjsonStream(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response body is not available.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        onEvent(JSON.parse(trimmed));
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    onEvent(JSON.parse(buffer.trim()));
  }
}

function buildExperimentComparison(left, right) {
  if (!left || !right) {
    return null;
  }

  const same = {
    prompt:
      (left.comparison_prompt || left.sample_prompt) ===
      (right.comparison_prompt || right.sample_prompt),
    dataset: left.dataset_id === right.dataset_id,
    baseModel: left.base_model_id === right.base_model_id,
    objective: left.training_objective === right.training_objective,
    tuning: (left.tuning_method || "full") === (right.tuning_method || "full")
  };
  const deltas = [
    metricDelta(left, right, "final_loss", "Final loss", "lower"),
    metricDelta(left, right, "tokens_seen", "Tokens seen"),
    metricDelta(left, right, "max_steps", "Steps"),
    metricDelta(left, right, "dataset_tokens", "Dataset tokens"),
    metricDelta(left, right, "trainable_percent", "Trainable %"),
    metricDelta(left, right, "examples_used_for_training", "Examples")
  ];
  const notes = [
    same.prompt
      ? "Prompt is controlled."
      : "Prompt differs; output comparison is less controlled."
  ];
  if (!same.dataset) {
    notes.push("Datasets differ.");
  }
  if (!same.baseModel) {
    notes.push("Base models differ.");
  }
  if (!same.tuning) {
    notes.push("Tuning methods differ.");
  }
  const lossStatus = deltas[0].status;
  if (lossStatus === "good") {
    notes.push("Right final loss is lower.");
  } else if (lossStatus === "bad") {
    notes.push("Right final loss is higher.");
  }

  return { same, deltas, notes };
}

function metricDelta(left, right, key, label, prefer) {
  const leftValue = toNumber(left[key]);
  const rightValue = toNumber(right[key]);
  if (leftValue === null || rightValue === null) {
    return {
      key,
      label,
      left: left[key],
      right: right[key],
      delta: null,
      status: "unknown"
    };
  }

  const delta = rightValue - leftValue;
  let status = delta === 0 ? "same" : "changed";
  if (prefer === "lower" && delta !== 0) {
    status = delta < 0 ? "good" : "bad";
  }
  if (prefer === "higher" && delta !== 0) {
    status = delta > 0 ? "good" : "bad";
  }

  return { key, label, left: leftValue, right: rightValue, delta, status };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatDelta(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  const prefix = value > 0 ? "+" : "";
  const formatted = Number.isInteger(value) ? value : value.toFixed(4);
  return `${prefix}${formatted}`;
}

function experimentLabel(experiment) {
  const loss = formatMaybeNumber(experiment.final_loss);
  const version = experiment.model_version_label || experiment.output_model_id;
  return `${experiment.dataset_tier}/${version} loss ${loss}`;
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

function formatExternalModelLabel(model) {
  if (!model) {
    return "external model";
  }
  const providerModel = model.provider_model_name || "model unset";
  return `${model.label} / ${providerModel}`;
}

function estimateTextWindows(tokenCount, blockSize, stride) {
  if (!tokenCount || !blockSize || tokenCount <= blockSize) {
    return 0;
  }
  return Math.floor((tokenCount - blockSize - 1) / Math.max(1, stride)) + 1;
}

function learningRateStatus(value) {
  if (value >= 0.01) {
    return { className: "bad", label: "lr high" };
  }
  if (value <= 0.00001) {
    return { className: "active-state", label: "lr very low" };
  }
  return { className: "good", label: "lr moderate" };
}

function configValueForKnob(name, values) {
  const map = {
    max_steps: values.trainingSteps,
    batch_size: values.batchSize,
    block_size: values.blockSize,
    stride: 1,
    learning_rate: values.learningRate,
    eval_every: values.evalEvery,
    sample_prompt: "dataset comparison prompt",
    prompt_style: "dataset selected style",
    sample_tokens: values.sampleTokens,
    seed: 123
  };
  return `current: ${map[name] ?? "set by dataset"}`;
}

function formatRuntimeLabel(runtimeInfo) {
  if (!runtimeInfo) {
    return "Runtime unknown";
  }
  if (runtimeInfo.device === "cuda") {
    return runtimeInfo.device_name || "CUDA GPU";
  }
  return "CPU only";
}

function formatRuntimeTitle(runtimeInfo) {
  if (!runtimeInfo) {
    return "";
  }
  const parts = [
    `device: ${runtimeInfo.device || "unknown"}`,
    `torch: ${runtimeInfo.torch_version || "unknown"}`
  ];
  if (runtimeInfo.cuda_available) {
    parts.push(`cuda: ${runtimeInfo.cuda_version || "available"}`);
    parts.push(`gpu: ${runtimeInfo.device_name || "unknown"}`);
  }
  return parts.join("\n");
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
  if (["available", "configured", "succeeded"].includes(status)) {
    return "good";
  }
  if (["failed", "missing-config", "missing-api-key", "missing-model"].includes(status)) {
    return "bad";
  }
  if (["cancelled", "disabled"].includes(status)) {
    return "muted";
  }
  return "active-state";
}
