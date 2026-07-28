"use client";

import Link from "next/link";
import { BrainCircuit, CheckCircle2, LoaderCircle, RefreshCw, Server, XCircle } from "lucide-react";

import { formatRuntimeLabel, formatRuntimeTitle } from "../../lib/format";

const STATUS_ICON = {
  online: CheckCircle2,
  offline: XCircle,
  checking: LoaderCircle
};

const STATUS_LABEL = {
  online: "API online",
  offline: "API offline",
  checking: "Checking…"
};

export default function TopBar({ apiBaseUrl, onApiBaseUrlChange, status, runtime, onRefresh }) {
  const StatusIcon = STATUS_ICON[status] ?? LoaderCircle;

  return (
    <header className="lx-topbar">
      <Link href="/" className="lx-brand">
        <BrainCircuit size={26} color="var(--blue)" />
        <span>
          <strong>Chatoken</strong>
          <span>Build a minimal ChatGPT, one idea at a time</span>
        </span>
      </Link>

      <div className="lx-topbar-spacer" />

      <div className="lx-api-field">
        <label htmlFor="lx-api-base">API</label>
        <input
          id="lx-api-base"
          value={apiBaseUrl}
          onChange={(event) => onApiBaseUrlChange(event.target.value)}
          spellCheck={false}
        />
      </div>

      <span className={`lx-pill ${status}`}>
        <StatusIcon size={14} />
        {STATUS_LABEL[status] ?? status}
      </span>

      {runtime ? (
        <span className="lx-pill" title={formatRuntimeTitle(runtime)}>
          <Server size={14} />
          {formatRuntimeLabel(runtime)}
        </span>
      ) : null}

      <button type="button" className="lx-secondary" onClick={onRefresh} title="Re-check the API">
        <RefreshCw size={14} />
      </button>

      <Link href="/legacy" className="lx-secondary" style={{ lineHeight: "32px", textDecoration: "none" }}>
        Legacy console
      </Link>
    </header>
  );
}
