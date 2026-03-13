import React, { useEffect, useMemo, useRef, useState } from "react";

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
  imageOptions = []
}) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);

  const currentValue = getDisplayValue(value);

  const selectedOption = useMemo(() => {
    return imageOptions.find((option) => getOptionValue(option) === currentValue) || null;
  }, [imageOptions, currentValue]);

  const filteredOptions = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) return imageOptions;

    return imageOptions.filter((option) => {
      const haystack =
        `${option.displayName} ${option.fileName} ${option.source}`.toLowerCase();
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

  return (
    <div className="image-select-field" ref={containerRef}>
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
                alt={selectedOption.displayName}
              />
            </div>

            <div className="image-select-trigger-text">
              <div className="image-select-trigger-name">{selectedOption.displayName}</div>
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
                        alt={option.displayName}
                      />
                    </div>

                    <div className="image-select-option-text">
                      <div className="image-select-option-name">{option.displayName}</div>
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