import React, { useEffect, useMemo, useRef, useState } from "react";
import { uploadAssetImage } from "../api/assets";

function getOptionValue(option) {
  return `${option.source}:${option.fileName}`;
}

function getDisplayValue(value) {
  if (!value || typeof value !== "object") return "";
  return `${value.source}:${value.fileName}`;
}

export default function ImageSelectField({
  field,
  value,
  onChange,
  imageOptions = [],
  onUploadComplete
}) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [uploading, setUploading] = useState(false);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentValue = getDisplayValue(value);

  const selectedOption = useMemo(() => {
    return imageOptions.find((option) => getOptionValue(option) === currentValue) || null;
  }, [imageOptions, currentValue]);

  const filteredOptions = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) return imageOptions;

    return imageOptions.filter((option) => {
      const haystack =
        `${option.displayName || ""} ${option.name || ""} ${option.fileName || ""} ${option.source || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [imageOptions, searchText]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleSelect(option) {
    onChange(field.key, {
      source: option.source,
      fileName: option.fileName
    });
    setOpen(false);
    setSearchText("");
  }

  function clearSelection() {
    onChange(field.key, "");
    setOpen(false);
    setSearchText("");
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setUploading(true);

      const response = await uploadAssetImage(file);
      const asset = response?.asset;

      if (!asset) {
        throw new Error("Upload succeeded but no asset was returned.");
      }

      if (typeof onUploadComplete === "function") {
        onUploadComplete(asset);
      }

      onChange(field.key, {
        source: asset.source,
        fileName: asset.fileName
      });

      setOpen(false);
      setSearchText("");
    } catch (error) {
      console.error("[ImageSelectField] Failed to upload image:", error);
      window.alert(error.message || "Failed to upload image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-select-field" ref={containerRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="image-select-hidden-input"
        onChange={handleFileSelected}
      />

      <button
        type="button"
        className={`image-select-trigger ${open ? "image-select-trigger-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {selectedOption ? (
          <>
            <div className="image-select-trigger-thumb-wrap">
              <img
                className="image-select-trigger-thumb"
                src={selectedOption.thumbnailUrl}
                alt={selectedOption.displayName || selectedOption.fileName}
              />
            </div>

            <div className="image-select-trigger-text">
              <div className="image-select-trigger-name">
                {selectedOption.displayName || selectedOption.fileName}
              </div>
              <div className="image-select-trigger-meta">
                {selectedOption.source === "local" ? "Orchestrator" : "ComfyUI"}
              </div>
            </div>
          </>
        ) : (
          <div className="image-select-trigger-placeholder">Select an image</div>
        )}

        <div className="image-select-trigger-chevron">{open ? "▲" : "▼"}</div>
      </button>

      {open ? (
        <div className="image-select-popover">
          <div className="image-select-toolbar">
            <input
              type="text"
              className="image-select-search"
              placeholder="Search images..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <button
              type="button"
              className="image-select-clear"
              onClick={clearSelection}
            >
              Clear
            </button>
          </div>

          <div className="image-select-upload-row">
            <button
              type="button"
              className="image-select-upload-button"
              onClick={openFilePicker}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload Image"}
            </button>
          </div>

          <div className="image-select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = getOptionValue(option) === currentValue;

                return (
                  <button
                    type="button"
                    key={getOptionValue(option)}
                    className={`image-select-option ${isSelected ? "image-select-option-selected" : ""}`}
                    onClick={() => handleSelect(option)}
                  >
                    <div className="image-select-option-thumb-wrap">
                      <img
                        className="image-select-option-thumb"
                        src={option.thumbnailUrl}
                        alt={option.displayName || option.fileName}
                      />
                    </div>

                    <div className="image-select-option-text">
                      <div className="image-select-option-name">
                        {option.displayName || option.fileName}
                      </div>
                      <div className="image-select-option-meta">
                        {option.source === "local" ? "Orchestrator" : "ComfyUI"}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="image-select-empty">No matching images found.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}