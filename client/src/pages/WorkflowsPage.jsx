import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { apiFetch } from "../api/client";

const SOURCE_OPTIONS = [
  {
    key: "all",
    label: "All Workflows",
    description: "Browse both ComfyUI-saved workflows and local orchestrator workflows.",
  },
  {
    key: "comfyui",
    label: "ComfyUI",
    description: "Workflows discovered from the ComfyUI workflow folder.",
  },
  {
    key: "local",
    label: "Local Library",
    description: "Workflow definitions stored only inside this app.",
  },
];

const SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "updated", label: "Last Updated" },
  { key: "source", label: "Source" },
];

function StatusPill({ source }) {
  const label = source === "comfyui" ? "ComfyUI" : "Local";
  const className = source === "comfyui" ? "wf-pill wf-pill-comfy" : "wf-pill wf-pill-local";
  return <span className={className}>{label}</span>;
}

function EmptyState({ searchText, sourceFilter }) {
  return (
    <div className="wf-empty-state">
      <h3>No workflows found</h3>
      <p>
        {searchText || sourceFilter !== "all"
          ? "Try clearing the search or changing the source filter."
          : "No workflows were returned yet. Once the backend lists them, they will appear here."}
      </p>
    </div>
  );
}

function WorkflowRow({ workflow, onOpen }) {
  return (
    <div className="wf-row">
      <div className="wf-row-header">
        <div className="wf-row-title-wrap">
          <div className="wf-row-name">
            {workflow.displayName || workflow.name || workflow.fileName}
          </div>
          <div className="wf-row-file">{workflow.fileName || workflow.id || "Unnamed workflow"}</div>
        </div>
        <StatusPill source={workflow.source} />
      </div>

      <div className="wf-row-meta">
        <span>{workflow.category || "Uncategorized"}</span>
        <span>{workflow.nodeCount != null ? `${workflow.nodeCount} nodes` : "Node count unknown"}</span>
      </div>

      <div className="wf-row-footer">
        <span>{workflow.updatedAt ? formatDate(workflow.updatedAt) : "Unknown update time"}</span>
      </div>

      <div className="wf-row-actions">
        <button
          type="button"
          className="wf-primary-button"
          onClick={() => onOpen(workflow)}
        >
          Open Workflow
        </button>
      </div>
    </div>
  );
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function normalizeWorkflow(item, sourceHint) {
  return {
    id: item.id || item.fileName || item.name,
    displayName: item.displayName || item.name || item.fileName || "Unnamed workflow",
    name: item.name,
    fileName: item.fileName,
    source: item.source || sourceHint || "local",
    category: item.category || "General",
    description: item.description || "",
    tags: item.tags || [],
    editableFields: item.editableFields || item.fields || [],
    nodeCount: item.nodeCount,
    updatedAt: item.updatedAt || item.lastModified,
    path: item.path,
  };
}

export default function WorkflowsPage() {
  const navigate = useNavigate();

  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [searchText, setSearchText] = useState("");
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadWorkflows() {
      try {
        setLoading(true);
        setError("");

        const [comfyRes, localRes] = await Promise.allSettled([
          apiFetch("/api/workflows?source=comfyui"),
          apiFetch("/api/workflows?source=local"),
        ]);

        const merged = [];

        if (comfyRes.status === "fulfilled") {
          const items = comfyRes.value.workflows || comfyRes.value.items || [];
          merged.push(...items.map((item) => normalizeWorkflow(item, "comfyui")));
        } else {
          console.error("[WorkflowsPage] Failed to load ComfyUI workflows:", comfyRes.reason);
        }

        if (localRes.status === "fulfilled") {
          const items = localRes.value.workflows || localRes.value.items || [];
          merged.push(...items.map((item) => normalizeWorkflow(item, "local")));
        } else {
          console.error("[WorkflowsPage] Failed to load local workflows:", localRes.reason);
        }

        if (mounted) {
          setWorkflows(merged);

          if (
            merged.length === 0 &&
            (comfyRes.status === "rejected" || localRes.status === "rejected")
          ) {
            setError("The workflow sources could not be loaded.");
          }
        }
      } catch (err) {
        console.error("[WorkflowsPage] Unexpected error while loading workflows:", err);

        if (mounted) {
          setError(err.message || "Failed to load workflows.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadWorkflows();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleWorkflows = useMemo(() => {
    let filtered = workflows.filter((workflow) => {
      const matchesSource = sourceFilter === "all" || workflow.source === sourceFilter;
      const text =
        `${workflow.displayName} ${workflow.fileName || ""} ${workflow.category || ""} ${(workflow.tags || []).join(" ")}`.toLowerCase();
      const matchesSearch = text.includes(searchText.trim().toLowerCase());
      return matchesSource && matchesSearch;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.displayName.localeCompare(b.displayName);
      }

      if (sortBy === "source") {
        return `${a.source}-${a.displayName}`.localeCompare(`${b.source}-${b.displayName}`);
      }

      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

    return filtered;
  }, [workflows, sourceFilter, sortBy, searchText]);

  function handleOpenWorkflow(workflow) {
    navigate(`/workflows/${encodeURIComponent(workflow.id)}`, {
      state: { workflow },
    });
  }

  return (
    <div className="wf-page-shell">
      <section className="wf-hero-panel">
        <div>
          <div className="wf-kicker">Workflow Browser</div>
          <h1>Browse ComfyUI and local orchestrator workflows</h1>
          <p>
            Discover workflows saved directly by ComfyUI and workflow definitions maintained only
            inside this app. Search, filter, inspect metadata, and prepare for editing or execution.
          </p>
        </div>

        <div className="wf-hero-actions">
          <button type="button" className="wf-primary-button">Refresh Sources</button>
          <button type="button" className="wf-secondary-button">Import Local Workflow</button>
        </div>
      </section>

      <section className="wf-toolbar-panel">
        <div className="wf-source-tabs">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`wf-tab-button ${sourceFilter === option.key ? "wf-tab-active" : ""}`}
              onClick={() => setSourceFilter(option.key)}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="wf-toolbar-controls">
          <label className="wf-search-group">
            <span>Search</span>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name, file, tag, or category"
            />
          </label>

          <label className="wf-select-group">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="wf-error-banner">{error}</div> : null}

      <section className="wf-list-panel">
        <div className="wf-panel-header">
          <div>
            <div className="wf-kicker">Available Workflows</div>
            <h2>{visibleWorkflows.length} visible</h2>
          </div>
          <div className="wf-muted-text">{loading ? "Loading..." : `${workflows.length} loaded total`}</div>
        </div>

        {loading ? (
          <div className="wf-loading-state">Loading workflows...</div>
        ) : visibleWorkflows.length === 0 ? (
          <EmptyState searchText={searchText} sourceFilter={sourceFilter} />
        ) : (
          <div className="wf-list">
            {visibleWorkflows.map((workflow) => (
              <WorkflowRow
                key={`${workflow.source}-${workflow.id}`}
                workflow={workflow}
                onOpen={handleOpenWorkflow}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}