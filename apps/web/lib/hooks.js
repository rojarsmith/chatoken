"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, DEFAULT_API_BASE_URL } from "./api";

const API_BASE_KEY = "chatoken.apiBaseUrl";
const MODEL_ID_KEY = "chatoken.modelId";
const PROGRESS_PREFIX = "chatoken.progress.";

/** The API base URL, persisted so it survives a reload. */
export function useApiBaseUrl() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API_BASE_URL);

  useEffect(() => {
    const stored = window.localStorage.getItem(API_BASE_KEY);
    if (stored) setBaseUrl(stored);
  }, []);

  const update = useCallback((next) => {
    setBaseUrl(next);
    window.localStorage.setItem(API_BASE_KEY, next);
  }, []);

  return [baseUrl, update];
}

/**
 * The model the Playground talks to. Persisted, because each route mounts its own
 * ConsoleShell — without this, loading GPT-2 in Stage 08 would be forgotten the
 * moment you walked to Stage 09.
 */
export function useModelId() {
  const [modelId, setModelId] = useState("random-tiny-byte");

  useEffect(() => {
    const stored = window.localStorage.getItem(MODEL_ID_KEY);
    if (stored) setModelId(stored);
  }, []);

  const update = useCallback((next) => {
    setModelId(next);
    window.localStorage.setItem(MODEL_ID_KEY, next);
  }, []);

  return [modelId, update];
}

/** Polls nothing — refreshes on demand and on mount. Keeps the top bar honest. */
export function useRuntime(baseUrl) {
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("checking");

  const refresh = useCallback(async () => {
    setStatus("checking");
    try {
      const health = await api.health(baseUrl);
      setRuntime(health);
      setStatus("online");
    } catch {
      setRuntime(null);
      setStatus("offline");
    }
  }, [baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { runtime, status, refresh };
}

export function useModels(baseUrl) {
  const [models, setModels] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setModels(await api.models(baseUrl));
      setError(null);
    } catch (err) {
      setModels([]);
      setError(err.message);
    }
  }, [baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, error, refresh };
}

/**
 * Per-stage progress: "not-started" | "in-progress" | "done".
 * Soft state only — stages are never locked (see decision D3 in the restructure plan).
 */
export function useProgress() {
  const [progress, setProgress] = useState({});

  useEffect(() => {
    const next = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PROGRESS_PREFIX)) {
        next[key.slice(PROGRESS_PREFIX.length)] = window.localStorage.getItem(key);
      }
    }
    setProgress(next);
  }, []);

  const setStageState = useCallback((stageId, state) => {
    setProgress((current) => ({ ...current, [stageId]: state }));
    if (state === "not-started") {
      window.localStorage.removeItem(`${PROGRESS_PREFIX}${stageId}`);
    } else {
      window.localStorage.setItem(`${PROGRESS_PREFIX}${stageId}`, state);
    }
  }, []);

  const stateOf = useCallback(
    (stageId) => progress[stageId] || "not-started",
    [progress]
  );

  const doneCount = useMemo(
    () => Object.values(progress).filter((value) => value === "done").length,
    [progress]
  );

  return { progress, stateOf, setStageState, doneCount };
}

const TERMINAL_STATES = new Set(["succeeded", "failed", "cancelled"]);

/**
 * Creates a job, then polls it until it reaches a terminal state.
 * Chat, training, and pretrained jobs share one lifecycle, so they share this hook.
 */
export function useJob(baseUrl, endpoints) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef(null);

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const poll = useCallback(
    async (jobId) => {
      try {
        const next = await endpoints.get(baseUrl, jobId);
        setJob(next);
        if (!TERMINAL_STATES.has(next.status)) {
          timer.current = setTimeout(() => poll(jobId), 700);
        }
      } catch (err) {
        setError(err.message);
      }
    },
    [baseUrl, endpoints]
  );

  const start = useCallback(
    async (body) => {
      stopPolling();
      setStarting(true);
      setError(null);
      setJob(null);
      try {
        const created = await endpoints.create(baseUrl, body);
        setJob(created);
        poll(created.job_id);
        return created;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setStarting(false);
      }
    },
    [baseUrl, endpoints, poll, stopPolling]
  );

  const cancel = useCallback(async () => {
    if (!job?.job_id) return;
    try {
      setJob(await endpoints.cancel(baseUrl, job.job_id));
    } catch (err) {
      setError(err.message);
    }
  }, [baseUrl, endpoints, job]);

  useEffect(() => stopPolling, [stopPolling]);

  const running = Boolean(job && !TERMINAL_STATES.has(job.status));

  return { job, error, start, cancel, starting, running };
}

/**
 * The device models run on. Reads the server's preference rather than keeping a
 * local copy: the device is process-wide state on the API, not a browser setting.
 */
export function useDevice(baseUrl, onChanged) {
  const [device, setDevice] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setDevice(await api.device(baseUrl));
      setError(null);
    } catch {
      setDevice(null);
    }
  }, [baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const choose = useCallback(
    async (preference) => {
      setPending(true);
      setError(null);
      try {
        const next = await api.setDevice(baseUrl, preference);
        setDevice(next);
        onChanged?.(next);
        return next;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [baseUrl, onChanged]
  );

  return { device, choose, refresh, pending, error };
}

/** Wraps an async action with pending/error/result state so panels stay small. */
export function useAction(action) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const run = useCallback(
    async (...args) => {
      setPending(true);
      setError(null);
      try {
        const value = await action(...args);
        setResult(value);
        return value;
      } catch (err) {
        setError(err.message);
        setResult(null);
        return null;
      } finally {
        setPending(false);
      }
    },
    [action]
  );

  return { run, pending, error, result, setResult };
}
