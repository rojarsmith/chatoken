"use client";

import { createContext, useContext } from "react";

import LadderRail from "./LadderRail";
import Playground from "./Playground";
import TopBar from "./TopBar";
import WorkbenchDrawer from "./WorkbenchDrawer";
import { useApiBaseUrl, useModelId, useModels, useProgress, useRuntime } from "../../lib/hooks";

const ConsoleContext = createContext(null);

export function useConsole() {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error("useConsole must be used inside ConsoleShell");
  return value;
}

export default function ConsoleShell({ currentStageId = null, showRail = true, showPlayground = true, children }) {
  const [apiBaseUrl, setApiBaseUrl] = useApiBaseUrl();
  const { runtime, status, refresh: refreshRuntime } = useRuntime(apiBaseUrl);
  const { models, refresh: refreshModels } = useModels(apiBaseUrl);
  const { stateOf, setStageState, doneCount } = useProgress();
  const [modelId, setModelId] = useModelId();

  const contextValue = {
    apiBaseUrl,
    runtime,
    status,
    models,
    modelId,
    setModelId,
    refresh: () => {
      refreshRuntime();
      refreshModels();
    },
    stateOf,
    setStageState
  };

  const bodyClass = [
    "lx-body",
    showRail ? "" : "wide",
    showRail && !showPlayground ? "no-playground" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ConsoleContext.Provider value={contextValue}>
      <div className="lx-shell">
        <TopBar
          apiBaseUrl={apiBaseUrl}
          onApiBaseUrlChange={setApiBaseUrl}
          status={status}
          runtime={runtime}
          onRefresh={contextValue.refresh}
        />

        <div className={bodyClass}>
          {showRail ? (
            <LadderRail
              currentStageId={currentStageId}
              stateOf={stateOf}
              doneCount={doneCount}
            />
          ) : null}

          <main className="lx-canvas">{children}</main>

          {showPlayground ? (
            <Playground
              apiBaseUrl={apiBaseUrl}
              models={models}
              modelId={modelId}
              onModelIdChange={setModelId}
            />
          ) : null}
        </div>

        <WorkbenchDrawer models={models} runtime={runtime} apiBaseUrl={apiBaseUrl} />
      </div>
    </ConsoleContext.Provider>
  );
}
