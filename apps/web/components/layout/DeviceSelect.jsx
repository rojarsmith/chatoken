"use client";

import { Cpu, LoaderCircle, Zap } from "lucide-react";

import { useDevice } from "../../lib/hooks";

/**
 * Switch the models between GPU and CPU without restarting the API.
 *
 * This is a teaching control as much as a convenience: running Stage 04 on CPU
 * and then on CUDA is a far more concrete lesson about what the GPU is doing
 * than any paragraph claiming it is faster.
 */
export default function DeviceSelect({ apiBaseUrl, onChanged }) {
  const { device, choose, pending, error } = useDevice(apiBaseUrl, onChanged);

  if (!device) return null;

  const onCuda = device.device === "cuda";
  const Icon = pending ? LoaderCircle : onCuda ? Zap : Cpu;

  return (
    <span className="lx-device" title={error || device.device_name || device.device}>
      <Icon size={14} color={onCuda ? "var(--green)" : "var(--muted)"} />
      <select
        aria-label="Compute device"
        value={device.preference}
        disabled={pending}
        onChange={(event) => choose(event.target.value)}
      >
        {device.options.map((option) => (
          <option key={option.id} value={option.id} disabled={!option.available}>
            {option.label}
            {option.available ? "" : " — unavailable"}
          </option>
        ))}
      </select>
      <span className={`lx-device-now ${onCuda ? "cuda" : ""}`}>
        {device.device === "cuda" ? device.device_name || "CUDA" : "CPU"}
      </span>
      {error ? <span className="lx-device-error">{error}</span> : null}
    </span>
  );
}
