import React, { useEffect, useState } from "react";
import {
  deleteAsset,
  fetchAllAssets,
  getAssetDownloadUrl,
  getAssetViewUrl,
} from "../api/assets";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function FullScreenModal({ asset, onClose }) {
  useEffect(() => {
    if (!asset) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [asset, onClose]);

  if (!asset) return null;

  return (
    <div className="assets-modal-backdrop" onClick={onClose}>
      <div
        className="assets-modal-content"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="assets-modal-close"
          onClick={onClose}
          aria-label="Close full screen image view"
        >
          ×
        </button>

        <img
          className="assets-modal-image"
          src={getAssetViewUrl(asset)}
          alt={asset.name || "Asset preview"}
        />
      </div>
    </div>
  );
}

function AssetCard({ asset, onDelete, onViewFullScreen }) {
  function handleSaveToDevice() {
    const link = document.createElement("a");
    link.href = getAssetDownloadUrl(asset);
    link.download = asset.name || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${asset.name || "this image"}"?`
    );
    if (!confirmed) return;
    await onDelete(asset);
  }

  return (
    <div className="asset-card">
      <div className="asset-card-preview">
        <img
          className="asset-card-image"
          src={getAssetViewUrl(asset)}
          alt={asset.name || "Asset preview"}
          onClick={() => onViewFullScreen(asset)}
        />
      </div>

      <div className="asset-card-body">
        <div className="asset-card-name" title={asset.name}>
          {asset.name || "Unnamed image"}
        </div>

        <div className="asset-card-meta">
          <div><strong>Source:</strong> {asset.source || "unknown"}</div>
          {asset.width && asset.height ? (
            <div><strong>Dimensions:</strong> {asset.width} × {asset.height}</div>
          ) : null}
          {asset.size != null ? (
            <div><strong>Size:</strong> {formatBytes(asset.size)}</div>
          ) : null}
          {asset.modifiedAt ? (
            <div><strong>Modified:</strong> {formatDate(asset.modifiedAt)}</div>
          ) : null}
        </div>

        <div className="asset-card-actions">
          <button type="button" onClick={handleSaveToDevice}>
            Save to Device
          </button>
          <button type="button" onClick={() => onViewFullScreen(asset)}>
            View Full Screen
          </button>
          <button
            type="button"
            className="asset-card-delete"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [deletingAllGenerations, setDeletingAllGenerations] = useState(false);

  async function loadAssets() {
    setLoading(true);
    setError("");

    try {
      const response = await fetchAllAssets();
      const nextAssets = Array.isArray(response?.assets)
        ? response.assets
        : Array.isArray(response)
          ? response
          : [];

      setAssets(nextAssets);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to load assets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  async function handleDelete(asset) {
    try {
      await deleteAsset(asset);

      setAssets((current) => current.filter((item) => item.id !== asset.id));

      setSelectedAsset((current) =>
        current?.id === asset.id ? null : current
      );
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Failed to delete asset.");
    }
  }

  async function handleDeleteAllGenerations() {
    if (generationAssets.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${generationAssets.length} generated image(s)?`
    );

    if (!confirmed) return;

    try {
      setDeletingAllGenerations(true);

      await Promise.all(generationAssets.map((asset) => deleteAsset(asset)));

      const generationIds = new Set(generationAssets.map((asset) => asset.id));

      setAssets((current) =>
        current.filter((item) => !generationIds.has(item.id))
      );

      setSelectedAsset((current) =>
        current && generationIds.has(current.id) ? null : current
      );
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Failed to delete all generated images.");
    } finally {
      setDeletingAllGenerations(false);
    }
  }

  const inputAssets = assets.filter((asset) => asset.source === "local");
  const generationAssets = assets.filter((asset) => asset.source === "generation");
  const comfyAssets = assets.filter((asset) => asset.source === "comfyui");

  return (
    <div className="assets-page">
      <div className="assets-page-header">
        <h1>Assets</h1>
        <button type="button" onClick={loadAssets} disabled={loading || deletingAllGenerations}>
          Refresh
        </button>
      </div>

      {loading ? <div className="assets-page-status">Loading assets...</div> : null}
      {error ? <div className="assets-page-error">{error}</div> : null}

      {!loading && !error && assets.length === 0 ? (
        <div className="assets-page-status">No assets found.</div>
      ) : null}

      {!loading && !error ? (
        <div className="assets-sections">
          <section className="assets-section-card">
            <div className="assets-section-header">
              <h2>Input Images</h2>
              <span>{inputAssets.length}</span>
            </div>
            <div className="assets-grid">
              {inputAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={handleDelete}
                  onViewFullScreen={setSelectedAsset}
                />
              ))}
            </div>
          </section>

          <section className="assets-section-card">
            <div className="assets-section-header">
              <h2>Generated Images</h2>
              <div className="assets-section-header-actions">
                <span>{generationAssets.length}</span>
                {generationAssets.length > 0 ? (
                  <button
                    type="button"
                    className="asset-card-delete"
                    onClick={handleDeleteAllGenerations}
                    disabled={deletingAllGenerations}
                  >
                    {deletingAllGenerations ? "Deleting..." : "Delete All"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="assets-grid">
              {generationAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={handleDelete}
                  onViewFullScreen={setSelectedAsset}
                />
              ))}
            </div>
          </section>

          {comfyAssets.length > 0 ? (
            <section className="assets-section-card">
              <div className="assets-section-header">
                <h2>ComfyUI Input Images</h2>
                <span>{comfyAssets.length}</span>
              </div>
              <div className="assets-grid">
                {comfyAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onDelete={handleDelete}
                    onViewFullScreen={setSelectedAsset}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <FullScreenModal
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  );
}
