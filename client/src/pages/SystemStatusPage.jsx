import React, { useEffect, useState } from "react";
import { fetchSystemStatus } from "../api/system";

export default function SystemStatusPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchSystemStatus();
        if (mounted) {
          setStatus(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load system status");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <h1>System Status</h1>
        <p>Loading status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <h1>System Status</h1>
        <p style={{ color: "#fca5a5" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "16px" }}>System Status</h1>

      <div style={{ display: "grid", gap: "16px" }}>
        <section style={cardStyle}>
          <h2 style={headingStyle}>Application</h2>
          <p><strong>Name:</strong> {status.app.name}</p>
          <p><strong>Status:</strong> {status.app.status}</p>
          <p><strong>Uptime:</strong> {status.app.uptimeSeconds} seconds</p>
          <p><strong>Environment:</strong> {status.app.nodeEnv}</p>
        </section>

        <section style={cardStyle}>
          <h2 style={headingStyle}>Server</h2>
          <p><strong>Host:</strong> {status.server.hostName}</p>
          <p><strong>Platform:</strong> {status.server.platform}</p>
          <p><strong>Local Time:</strong> {status.server.localTime}</p>
        </section>

        <section style={cardStyle}>
          <h2 style={headingStyle}>Paths</h2>
          <p><strong>Workflows Dir:</strong> {status.paths.workflowsDir}</p>
          <p><strong>Workflows Dir Exists:</strong> {String(status.paths.workflowsDirExists)}</p>
          <p><strong>Data Dir:</strong> {status.paths.dataDir}</p>
          <p><strong>Data Dir Exists:</strong> {String(status.paths.dataDirExists)}</p>
        </section>

        <section style={cardStyle}>
          <h2 style={headingStyle}>Security</h2>
          <p><strong>API Key Enabled:</strong> {String(status.security.apiKeyEnabled)}</p>
        </section>

        <section style={cardStyle}>
          <h2 style={headingStyle}>ComfyUI</h2>
          <p><strong>Configured URL:</strong> {status.comfyui.configuredUrl}</p>
          <p><strong>Reachable:</strong> {String(status.comfyui.reachable)}</p>
        </section>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "rgba(12, 21, 37, 0.96)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  borderRadius: "18px",
  padding: "18px",
};

const headingStyle = {
  marginTop: 0,
  marginBottom: "12px",
};