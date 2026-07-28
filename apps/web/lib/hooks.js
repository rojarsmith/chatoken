"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, DEFAULT_API_BASE_URL } from "./api";

const API_BASE_KEY = "chatoken.apiBaseUrl";
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
