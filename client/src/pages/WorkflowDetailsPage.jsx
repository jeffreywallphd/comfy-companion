import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { apiFetch } from "../api/client";
import { fetchImageOptions } from "../api/assets";

import ImageSelectField from "../components/ImageSelectField";

function StatusPill({ source }) {
  const label = source === "comfyui" ? "ComfyUI" : "Local";
  const className = source === "comfyui" ? "wf-pill wf-pill-comfy" : "wf-pill wf-pill-local";
  return <span className={className}>{label}</span>;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getFieldKey(field) {
  return field.key || field.label || `${field.nodeId}.${field.inputName}`;
}

function buildFormValuesFromEditableFields(editableFields = []) {
  const values = {};

  for (const field of editableFields) {
    values[getFieldKey(field)] = field.defaultValue;
  }

  return values;
}

function normalizeImageDefaults(editableFields = [], defaults = {}) {
  const next = { ...defaults };

  for (const field of editableFields) {
    if (field.type !== "image_select") continue;

    const key = getFieldKey(field);
    const value = next[key];

    if (typeof value === "string" && value) {
      next[key] = {
        source: "comfyui",
        fileName: value
      };
    }
  }

  return next;
}

function HelpHint({ text }) {
  const [open, setOpen] = useState(false);

  if (!text) {
    return null;
  }

  return (
    <span
      className="wf-help-hint"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen((prev) => !prev);
        }
      }}
      aria-label="Show help"
    >
      ?
      <span className={`wf-help-popover ${open ? "wf-help-popover-open" : ""}`}>
        {text}
      </span>
    </span>
  );
}

function generateSeed() {
    // stay within JS safe integer range
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function renderInput(field, value, onChange, imageOptions = [], onNewSeed, onImageUploadComplete) {
  const type = (field.type || "string").toLowerCase();
  const key = getFieldKey(field);
  const label = field.label || field.key || key;

  const labelBlock = (
    <span className="wf-form-label-row">
      <span>{label}</span>
      <HelpHint text={field.description} />
    </span>
  );

  if (type === "image_select") {
    return (
      <div className="wf-form-field" key={key}>
        {labelBlock}
        <ImageSelectField
          field={field}
          value={value}
          onChange={onChange}
          imageOptions={imageOptions}
          onUploadComplete={onImageUploadComplete}
        />
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <label className="wf-form-field" key={key}>
        {labelBlock}
        <label className="wf-checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(key, event.target.checked)}
          />
          <span>Enabled</span>
        </label>
      </label>
    );
  }

  if (type === "number" || type === "integer" || type === "float") {
    const isSeedField =
      field.inputName === "seed" ||
      field.key?.toLowerCase().includes("seed") ||
      field.label?.toLowerCase().includes("seed");
  
    return (
      <label className="wf-form-field" key={key}>
        {labelBlock}
  
        <div className="wf-number-input-row">
          <input
            type="number"
            value={value ?? ""}
            onChange={(event) =>
              onChange(
                key,
                event.target.value === "" ? "" : Number(event.target.value)
              )
            }
          />
  
          {isSeedField && (
            <button
              type="button"
              className="wf-seed-button"
              onClick={() => onNewSeed(key)}
            >
              New Variation
            </button>
          )}
        </div>
      </label>
    );
  }

  if (Array.isArray(field.options) && field.options.length > 0) {
    return (
      <label className="wf-form-field" key={key}>
        {labelBlock}
        <select
          value={value ?? ""}
          onChange={(event) => onChange(key, event.target.value)}
        >
          {field.options.map((option) => {
            const optionValue =
              typeof option === "string" ? option : option.value;
            const optionLabel =
              typeof option === "string" ? option : option.label || option.value;

            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      </label>
    );
  }

  const useTextarea =
    type === "text" ||
    type === "prompt" ||
    (field.inputName && field.inputName.toLowerCase() === "text") ||
    (field.key && field.key.toLowerCase().includes("prompt"));

  if (useTextarea) {
    return (
      <label className="wf-form-field" key={key}>
        {labelBlock}
        <textarea
          rows={4}
          value={value ?? ""}
          onChange={(event) => onChange(key, event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="wf-form-field" key={key}>
      {labelBlock}
      <input
        type="text"
        value={value ?? ""}
        onChange={(event) => onChange(key, event.target.value)}
      />
    </label>
  );
}

export default function WorkflowDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workflowId } = useParams();

  const initialWorkflow = location.state?.workflow || null;

  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [defaultValues, setDefaultValues] = useState({});
  const [formValues, setFormValues] = useState({});
  const [loading, setLoading] = useState(!initialWorkflow);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [imageOptions, setImageOptions] = useState([]);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [expandedImages, setExpandedImages] = useState({});

  useEffect(() => {
    let mounted = true;

    async function loadImageOptions() {
      try {
        const response = await fetchImageOptions("all");
        if (!mounted) return;
        setImageOptions(response.images || []);
      } catch (err) {
        console.error("[WorkflowDetailsPage] Failed to load image options:", err);
      }
    }

    loadImageOptions();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadWorkflowDetails() {
      if (initialWorkflow?.source && initialWorkflow?.id) {
        try {
          setLoading(true);
          setError("");

          const response = await apiFetch(
            `/api/workflows/item/${initialWorkflow.source}/${encodeURIComponent(initialWorkflow.id)}`
          );

          if (!mounted) return;

          const derivedDefaultsRaw =
            response.defaultValues && Object.keys(response.defaultValues).length > 0
              ? response.defaultValues
              : buildFormValuesFromEditableFields(response.workflowItem?.editableFields || []);

          const derivedDefaults = normalizeImageDefaults(
            response.workflowItem?.editableFields || [],
            derivedDefaultsRaw
          );

          console.log("[WorkflowDetailsPage] workflowItem returned from backend:", response.workflowItem);
          console.log("[WorkflowDetailsPage] editableFields returned from backend:", response.workflowItem?.editableFields);
          console.log("[WorkflowDetailsPage] defaultValues returned from backend:", response.defaultValues);
          console.log("[WorkflowDetailsPage] derivedDefaults used in form:", derivedDefaults);

          setWorkflow(response.workflowItem);
          setDefaultValues(derivedDefaults);
          setFormValues({ ...derivedDefaults });
        } catch (err) {
          console.error("[WorkflowDetailsPage] Failed to hydrate initial workflow details:", err);
          if (mounted) {
            setError(err.message || "Failed to load workflow details.");
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }

        return;
      }

      if (!workflowId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const decodedId = decodeURIComponent(workflowId);
        const sourcesToTry = ["comfyui", "local"];
        let found = null;

        for (const source of sourcesToTry) {
          try {
            const response = await apiFetch(
              `/api/workflows/item/${source}/${encodeURIComponent(decodedId)}`
            );
            found = response;
            break;
          } catch (err) {
            console.log(`[WorkflowDetailsPage] Workflow not found in source ${source}:`, err.message);
          }
        }

        if (!mounted) return;

        if (!found) {
          setError(`Could not load workflow details for ${decodedId}.`);
          return;
        }

        const derivedDefaultsRaw =
          found.defaultValues && Object.keys(found.defaultValues).length > 0
            ? found.defaultValues
            : buildFormValuesFromEditableFields(found.workflowItem?.editableFields || []);

        const derivedDefaults = normalizeImageDefaults(
          found.workflowItem?.editableFields || [],
          derivedDefaultsRaw
        );

        console.log("[WorkflowDetailsPage] workflowItem returned from backend:", found.workflowItem);
        console.log("[WorkflowDetailsPage] editableFields returned from backend:", found.workflowItem?.editableFields);
        console.log("[WorkflowDetailsPage] defaultValues returned from backend:", found.defaultValues);
        console.log("[WorkflowDetailsPage] derivedDefaults used in form:", derivedDefaults);

        setWorkflow(found.workflowItem);
        setDefaultValues(derivedDefaults);
        setFormValues({ ...derivedDefaults });
      } catch (err) {
        console.error("[WorkflowDetailsPage] Failed to load workflow details:", err);
        if (mounted) {
          setError(err.message || "Failed to load workflow details.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadWorkflowDetails();

    return () => {
      mounted = false;
    };
  }, [initialWorkflow, workflowId]);

  const editableFields = useMemo(() => {
    return workflow?.editableFields || workflow?.fields || [];
  }, [workflow]);

  const workflowJsonText = useMemo(() => {
    if (!workflow?.workflow) {
      return "";
    }

    try {
      return JSON.stringify(workflow.workflow, null, 2);
    } catch (err) {
      console.error("[WorkflowDetailsPage] Failed to stringify workflow JSON:", err);
      return "Unable to render workflow JSON.";
    }
  }, [workflow]);

  function handleFieldChange(fieldKey, value) {
    setFormValues((prev) => ({
      ...prev,
      [fieldKey]: value
    }));
  }

  function handleImageUploadComplete(asset) {
    setImageOptions((prev) => {
      const exists = prev.some(
        (item) => item.source === asset.source && item.fileName === asset.fileName
      );
  
      if (exists) {
        return prev.map((item) =>
          item.source === asset.source && item.fileName === asset.fileName
            ? asset
            : item
        );
      }
  
      return [asset, ...prev];
    });
  }

  async function handleRunWorkflow() {
    if (!workflow) return;

    try {
      setRunning(true);
      setRunMessage("");
      setError("");

      const payload = {
        source: workflow.source,
        workflowId: workflow.id || workflow.fileName,
        overrides: formValues
      };

      console.log("[WorkflowDetailsPage] Sending workflow run request:", payload);

      const response = await apiFetch("/api/workflows/run", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setGeneratedImages(response.generations || []);

      setRunMessage(
        response?.comfyResponse?.prompt_id
          ? `Workflow queued successfully. Prompt ID: ${response.comfyResponse.prompt_id}`
          : "Workflow queued successfully."
      );
    } catch (err) {
      console.error("[WorkflowDetailsPage] Failed to run workflow:", err);
      setError(err.message || "Failed to run workflow.");
    } finally {
      setRunning(false);
    }
  }

    async function handleDeleteGeneratedImage(fileName) {
        try {
            await apiFetch(`/api/generations/${encodeURIComponent(fileName)}`, {
            method: "DELETE"
            });

            setGeneratedImages((prev) =>
            prev.filter((image) => image.fileName !== fileName)
            );
        } catch (err) {
            console.error("[WorkflowDetailsPage] Failed to delete generated image:", err);
            setError(err.message || "Failed to delete generated image.");
        }
    }

    function handleSaveToDevice(image) {
        const link = document.createElement("a");
        link.href = image.url;
        link.download = image.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function toggleImageExpanded(fileName) {
        setExpandedImages((prev) => ({
          ...prev,
          [fileName]: !prev[fileName]
        }));
    }

    function handleNewSeed(fieldKey) {
        const newSeed = generateSeed();
      
        setFormValues((prev) => ({
          ...prev,
          [fieldKey]: newSeed
        }));
    }

  if (loading) {
    return (
      <div className="wf-page-shell">
        <section className="wf-details-panel">
          <div className="wf-details-empty">
            <h3>Loading workflow details...</h3>
          </div>
        </section>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="wf-page-shell">
        <section className="wf-details-panel">
          <div className="wf-details-empty">
            <h3>Workflow details unavailable</h3>
            <p>
              No workflow payload was provided for <strong>{workflowId}</strong>.
            </p>
            <div className="wf-actions">
              <button
                type="button"
                className="wf-secondary-button"
                onClick={() => navigate("/workflows")}
              >
                Back to Workflows
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const tags = workflow.tags || [];

  return (
    <div className="wf-page-shell">
      <section className="wf-details-page-hero">
        <div>
          <div className="wf-kicker">Workflow Details</div>
          <h1>{workflow.displayName || workflow.name || workflow.fileName}</h1>
          <p>
            Review metadata, edit supported fields, and run this workflow through ComfyUI.
          </p>
        </div>

        <div className="wf-details-page-actions">
          <StatusPill source={workflow.source} />
          <button
            type="button"
            className="wf-secondary-button"
            onClick={() => navigate("/workflows")}
          >
            Back to Workflows
          </button>
        </div>
      </section>

      {error ? <div className="wf-error-banner">{error}</div> : null}
      {runMessage ? <div className="wf-success-banner">{runMessage}</div> : null}

      <section className="wf-details-panel">
        <div className="wf-detail-grid">
          <div className="wf-detail-card">
            <div className="wf-detail-label">Source</div>
            <div className="wf-detail-value">
              {workflow.source === "comfyui" ? "ComfyUI Workflow Folder" : "Local Orchestrator Library"}
            </div>
          </div>

          <div className="wf-detail-card">
            <div className="wf-detail-label">Category</div>
            <div className="wf-detail-value">{workflow.category || "Uncategorized"}</div>
          </div>

          <div className="wf-detail-card">
            <div className="wf-detail-label">File / Identifier</div>
            <div className="wf-detail-value wf-break">{workflow.fileName || workflow.id || "Not provided"}</div>
          </div>

          <div className="wf-detail-card">
            <div className="wf-detail-label">Last Updated</div>
            <div className="wf-detail-value">{workflow.updatedAt ? formatDate(workflow.updatedAt) : "Unknown"}</div>
          </div>

          <div className="wf-detail-card">
            <div className="wf-detail-label">Node Count</div>
            <div className="wf-detail-value">
              {workflow.nodeCount != null ? workflow.nodeCount : "Unknown"}
            </div>
          </div>

          <div className="wf-detail-card">
            <div className="wf-detail-label">Path</div>
            <div className="wf-detail-value wf-break">{workflow.path || "Not provided"}</div>
          </div>
        </div>

        <div className="wf-section">
          <h3>Description</h3>
          <p>{workflow.description || "No description has been provided for this workflow yet."}</p>
        </div>

        <div className="wf-section">
          <h3>Tags</h3>
          {tags.length > 0 ? (
            <div className="wf-tag-list">
              {tags.map((tag) => (
                <span key={tag} className="wf-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="wf-muted-text">No tags yet.</p>
          )}
        </div>

        <div className="wf-section">
          <h3>Editable Fields</h3>

          {editableFields.length > 0 ? (
            <div className="wf-operation-groups">
              {Object.entries(
                editableFields.reduce((groups, field) => {
                  const opKey = field.operationGroupKey || "ungrouped";
                  const opLabel = field.operationGroupLabel || opKey;

                  if (!groups[opKey]) {
                    groups[opKey] = {
                      label: opLabel,
                      sortOrder: field.operationGroupSortOrder ?? 999,
                      nodeGroups: {}
                    };
                  }

                  const nodeGroupKey = `${field.nodeLabel || `${field.nodeType} (${field.nodeId})`}__${field.nodeId}`;

                  if (!groups[opKey].nodeGroups[nodeGroupKey]) {
                    groups[opKey].nodeGroups[nodeGroupKey] = {
                      label: field.nodeLabel || `${field.nodeType} (${field.nodeId})`,
                      nodeId: field.nodeId,
                      nodeType: field.nodeType,
                      nodeSortOrder: field.nodeSortOrder ?? 999,
                      fields: []
                    };
                  }

                  groups[opKey].nodeGroups[nodeGroupKey].fields.push(field);

                  return groups;
                }, {})
              )
                .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
                .map(([operationKey, operationGroup]) => (
                  <section key={operationKey} className="wf-operation-group-card">
                    <div className="wf-operation-group-header">
                      <h4>{operationGroup.label}</h4>
                    </div>

                    <div className="wf-field-groups">
                      {Object.values(operationGroup.nodeGroups)
                        .sort((a, b) => a.nodeSortOrder - b.nodeSortOrder || Number(a.nodeId) - Number(b.nodeId))
                        .map((group) => (
                          <section key={`${group.nodeType}-${group.nodeId}`} className="wf-field-group-card">
                            <div className="wf-field-group-header">
                              <h5>{group.label}</h5>
                              <span className="wf-field-group-meta">
                                {group.nodeType} · Node {group.nodeId}
                              </span>
                            </div>

                            <div className="wf-form-grid">
                              {group.fields
                                .sort((a, b) => (a.inputSortOrder ?? 999) - (b.inputSortOrder ?? 999))
                                .map((field) =>
                                  renderInput(
                                    field,
                                    formValues[getFieldKey(field)] ?? field.defaultValue ?? "",
                                    handleFieldChange,
                                    imageOptions,
                                    handleNewSeed,
                                    handleImageUploadComplete
                                  )
                                )}
                            </div>
                          </section>
                        ))}
                    </div>
                  </section>
                ))}
            </div>
          ) : (
            <p className="wf-muted-text">No editable field metadata is available yet.</p>
          )}
        </div>

        <div className="wf-actions">
          <button
            type="button"
            className="wf-primary-button"
            onClick={handleRunWorkflow}
            disabled={running}
          >
            {running ? "Running..." : "Run Workflow"}
          </button>

          <button
            type="button"
            className="wf-secondary-button"
            onClick={() => setFormValues({ ...defaultValues })}
          >
            Reset Defaults
          </button>

          <button
            type="button"
            className="wf-secondary-button"
            onClick={() => setShowJson((prev) => !prev)}
          >
            {showJson ? "Hide Workflow JSON" : "View Workflow JSON"}
          </button>
        </div>
      </section>

      {generatedImages.length > 0 ? (
        <section className="wf-generated-panel">
            <div className="wf-section">
            <h3>Generated Images</h3>
            <div className="wf-generated-grid">
                {generatedImages.map((image) => (
                <div
                    key={image.fileName}
                    className={
                    expandedImages[image.fileName]
                        ? "wf-generated-card wf-generated-card-expanded"
                        : "wf-generated-card"
                    }
                >
                    <img
                    src={image.url}
                    alt={image.fileName}
                    className={
                        expandedImages[image.fileName]
                        ? "wf-generated-image wf-generated-image-expanded"
                        : "wf-generated-image"
                    }
                    />
                    <div className="wf-generated-meta">
                    <div className="wf-generated-name">{image.fileName}</div>
                    <div className="wf-generated-original">
                        From: {image.originalFileName}
                    </div>

                    <div className="wf-generated-actions">
                        <button
                        type="button"
                        className="wf-secondary-button wf-generated-action-button"
                        onClick={() => handleSaveToDevice(image)}
                        >
                        Save to Device
                        </button>

                        <button
                        type="button"
                        className="wf-secondary-button wf-generated-action-button"
                        onClick={() => handleDeleteGeneratedImage(image.fileName)}
                        >
                        Delete Image
                        </button>

                        <button
                        type="button"
                        className="wf-secondary-button wf-generated-action-button"
                        onClick={() => toggleImageExpanded(image.fileName)}
                        >
                        {expandedImages[image.fileName] ? "Shrink Image" : "Expand Image"}
                        </button>
                    </div>
                    </div>
                </div>
                ))}
            </div>
            </div>
        </section>
        ) : null}

      {showJson ? (
        <section className="wf-json-panel">
          <div className="wf-section">
            <h3>Workflow JSON</h3>
            <pre className="wf-json-block">{workflowJsonText}</pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}