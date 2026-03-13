import React, { useEffect, useMemo, useState } from "react";
import {
  fetchSystemStatus,
  startComfyUi,
  stopComfyUi
} from "../api/system";

function formatDate(value) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "Unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatPercent(used, total) {
  if (!total || total <= 0) return "Unknown";
  return `${((used / total) * 100).toFixed(1)}%`;
}

function StatusPill({ status }) {
  const normalized = status || "checking";

  const className =
    normalized === "available"
      ? "sys-pill sys-pill-available"
      : normalized === "unavailable"
        ? "sys-pill sys-pill-unavailable"
        : "sys-pill sys-pill-checking";

  const label =
    normalized === "available"
      ? "Available"
      : normalized === "unavailable"
        ? "Unavailable"
        : "Checking...";

  return <span className={className}>{label}</span>;
}

function GpuCard({ gpu, titlePrefix = "GPU" }) {
  return (
    <div className="sys-gpu-card">
      <div className="sys-gpu-header">
        <h3>{gpu.name || `${titlePrefix} ${gpu.index}`}</h3>
        <span className="sys-gpu-type">{gpu.type || gpu.provider || "gpu"}</span>
      </div>

      <div className="sys-detail-grid">
        <div className="sys-detail-card">
          <div className="sys-detail-label">Total VRAM</div>
          <div className="sys-detail-value">{formatBytes(gpu.vramTotal)}</div>
        </div>

        <div className="sys-detail-card">
          <div className="sys-detail-label">Used VRAM</div>
          <div className="sys-detail-value">{formatBytes(gpu.vramUsed)}</div>
        </div>

        <div className="sys-detail-card">
          <div className="sys-detail-label">Free VRAM</div>
          <div className="sys-detail-value">{formatBytes(gpu.vramFree)}</div>
        </div>

        <div className="sys-detail-card">
          <div className="sys-detail-label">VRAM In Use</div>
          <div className="sys-detail-value">{formatPercent(gpu.vramUsed, gpu.vramTotal)}</div>
        </div>

        {"torchVramTotal" in gpu ? (
          <div className="sys-detail-card">
            <div className="sys-detail-label">Torch Reserved Total</div>
            <div className="sys-detail-value">{formatBytes(gpu.torchVramTotal)}</div>
          </div>
        ) : null}

        {"torchVramUsed" in gpu ? (
          <div className="sys-detail-card">
            <div className="sys-detail-label">Torch Reserved Used</div>
            <div className="sys-detail-value">
              {gpu.torchVramUsed == null ? "Unknown" : formatBytes(gpu.torchVramUsed)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SystemStatusPage() {
  const [data, setData] = useState(null);
  const [checking, setChecking] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStatus() {
    try {
      setChecking(true);
      setError("");

      const response = await fetchSystemStatus();
      setData(response);
    } catch (err) {
      console.error("[SystemStatusPage] Failed to load status:", err);
      setError(err.message || "Failed to load system status.");
    } finally {
      setChecking(false);
    }
  }

  async function handleStartComfyUi() {
    try {
      setActionLoading(true);
      setError("");
      await startComfyUi();
      await loadStatus();
    } catch (err) {
      console.error("[SystemStatusPage] Failed to start ComfyUI:", err);
      setError(err.message || "Failed to start ComfyUI.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStopComfyUi() {
    try {
      setActionLoading(true);
      setError("");
      await stopComfyUi();
      await loadStatus();
    } catch (err) {
      console.error("[SystemStatusPage] Failed to stop ComfyUI:", err);
      setError(err.message || "Failed to stop ComfyUI.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();

    const intervalId = window.setInterval(() => {
      loadStatus();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const comfyStatus = useMemo(() => {
    if (checking && !data) return "checking";
    return data?.comfyui?.status || "unavailable";
  }, [checking, data]);

  const comfyGpus = data?.comfyui?.systemStats?.devices || [];
  const localGpus = data?.localGpu?.devices || [];
  const companionRam = data?.memory || {};
  const managed = data?.comfyui?.managed || {};

  const canStart =
  comfyStatus !== "available" &&
  !managed?.running &&
  !actionLoading;

  const canStop =
  Boolean(managed?.running) &&
  Boolean(managed?.spawnedByCompanion) &&
  !actionLoading;

  return (
    <div className="wf-page-shell">
      <section className="wf-details-page-hero">
        <div>
          <div className="wf-kicker">System Status</div>
          <h1>ComfyCompanion and ComfyUI Status</h1>
          <p>
            Live status for ComfyCompanion and the connected ComfyUI instance.
            This page refreshes automatically every 5 seconds.
          </p>
        </div>

        <div className="wf-details-page-actions">
          <StatusPill status={comfyStatus} />
          <button
            type="button"
            className="wf-secondary-button"
            onClick={loadStatus}
            disabled={checking || actionLoading}
          >
            {checking ? "Checking..." : "Refresh Now"}
          </button>
        </div>
      </section>

      {error ? <div className="wf-error-banner">{error}</div> : null}

      <section className="wf-details-panel">
        <div className="wf-section">
          <h3>ComfyCompanion</h3>

          <div className="sys-detail-grid">
            <div className="sys-detail-card">
              <div className="sys-detail-label">Status</div>
              <div className="sys-detail-value">{data?.app?.status || "Unknown"}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Started</div>
              <div className="sys-detail-value">{formatDate(data?.app?.startedAt)}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Uptime</div>
              <div className="sys-detail-value">
                {data?.app?.uptimeSeconds != null ? `${data.app.uptimeSeconds}s` : "Unknown"}
              </div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Node Version</div>
              <div className="sys-detail-value">{data?.app?.nodeVersion || "Unknown"}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Host Name</div>
              <div className="sys-detail-value">{data?.server?.hostName || "Unknown"}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Platform</div>
              <div className="sys-detail-value">
                {data?.server?.platform || "Unknown"} {data?.server?.arch || ""}
              </div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">System RAM Total</div>
              <div className="sys-detail-value">{formatBytes(companionRam.systemRamTotal)}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">System RAM Used</div>
              <div className="sys-detail-value">{formatBytes(companionRam.systemRamUsed)}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">System RAM Free</div>
              <div className="sys-detail-value">{formatBytes(companionRam.systemRamFree)}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">System RAM In Use</div>
              <div className="sys-detail-value">
                {formatPercent(companionRam.systemRamUsed, companionRam.systemRamTotal)}
              </div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Workflows Directory</div>
              <div className="sys-detail-value">
                {data?.paths?.workflowsDirExists ? "Available" : "Missing"}
              </div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Data Directory</div>
              <div className="sys-detail-value">
                {data?.paths?.dataDirExists ? "Available" : "Missing"}
              </div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">API Key Protection</div>
              <div className="sys-detail-value">
                {data?.security?.apiKeyEnabled ? "Enabled" : "Disabled"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="wf-details-panel">
        <div className="wf-section">
          <h3>ComfyCompanion Local GPU / VRAM</h3>

          {localGpus.length > 0 ? (
            <div className="sys-gpu-grid">
              {localGpus.map((gpu) => (
                <GpuCard key={`local-${gpu.index}-${gpu.name}`} gpu={gpu} titlePrefix="Local GPU" />
              ))}
            </div>
          ) : (
            <p className="wf-muted-text">
              {data?.localGpu?.error || "No local GPU / VRAM information is available from ComfyCompanion."}
            </p>
          )}
        </div>
      </section>

      <section className="wf-details-panel">
        <div className="wf-section">
          <h3>ComfyUI</h3>

          <div className="sys-detail-grid">
            <div className="sys-detail-card">
              <div className="sys-detail-label">Status</div>
              <div className="sys-detail-value">
                {comfyStatus === "available"
                  ? "Available"
                  : comfyStatus === "unavailable"
                    ? "Unavailable"
                    : "Checking..."}
              </div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Configured URL</div>
              <div className="sys-detail-value">{data?.comfyui?.configuredUrl || "Unknown"}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Last Checked</div>
              <div className="sys-detail-value">{formatDate(data?.comfyui?.checkedAt)}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">GPU Count</div>
              <div className="sys-detail-value">{comfyGpus.length}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Managed Process Running</div>
              <div className="sys-detail-value">{managed?.running ? "Yes" : "No"}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Spawned by ComfyCompanion</div>
              <div className="sys-detail-value">{managed?.spawnedByCompanion ? "Yes" : "No"}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Managed PID</div>
              <div className="sys-detail-value">{managed?.pid ?? "None"}</div>
            </div>

            <div className="sys-detail-card">
              <div className="sys-detail-label">Managed Start Time</div>
              <div className="sys-detail-value">{formatDate(managed?.startedAt)}</div>
            </div>
          </div>

          <div className="wf-actions">
            <button
              type="button"
              className="wf-primary-button"
              onClick={handleStartComfyUi}
              disabled={!canStart}
            >
              {actionLoading ? "Working..." : "Start ComfyUI"}
            </button>

            <button
              type="button"
              className="wf-secondary-button"
              onClick={handleStopComfyUi}
              disabled={!canStop}
            >
              {actionLoading ? "Working..." : "Stop ComfyUI"}
            </button>
          </div>

          {data?.comfyui?.error ? (
            <div className="sys-inline-warning">{data.comfyui.error}</div>
          ) : null}
        </div>
      </section>

      <section className="wf-details-panel">
        <div className="wf-section">
          <h3>ComfyUI GPU / VRAM Details</h3>

          {comfyGpus.length > 0 ? (
            <div className="sys-gpu-grid">
              {comfyGpus.map((gpu) => (
                <GpuCard key={`comfy-${gpu.index}-${gpu.name}`} gpu={gpu} titlePrefix="ComfyUI GPU" />
              ))}
            </div>
          ) : (
            <p className="wf-muted-text">
              {comfyStatus === "available"
                ? "No GPU devices were reported by ComfyUI."
                : "GPU and VRAM information are unavailable because ComfyUI is not currently reachable."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}