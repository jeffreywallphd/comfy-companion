const fs = require("fs/promises");
const path = require("path");

const MANIFEST_PATH = path.resolve(
    __dirname,
    "../data/manifests/editableNodeManifest.json"
);

let manifestCache = null;

async function loadEditableNodeManifest() {
    if (manifestCache) {
        console.log("[editableManifestService] Returning cached editable node manifest.");
        return manifestCache;
    }

    console.log("[editableManifestService] Loading editable node manifest from:", MANIFEST_PATH);

    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const manifest = JSON.parse(raw);

    if (!manifest || typeof manifest !== "object") {
        throw new Error("Editable node manifest is invalid.");
    }

    if (!manifest.nodeTypes || typeof manifest.nodeTypes !== "object") {
        throw new Error("Editable node manifest is missing nodeTypes.");
    }

    if (!manifest.operationGroups || typeof manifest.operationGroups !== "object") {
        throw new Error("Editable node manifest is missing operationGroups.");
    }

    manifestCache = manifest;

    console.log(
        "[editableManifestService] Manifest loaded successfully. Node types:",
        Object.keys(manifest.nodeTypes)
    );

    console.log(
        "[editableManifestService] Operation groups loaded:",
        Object.keys(manifest.operationGroups)
    );

    return manifestCache;
}

function clearEditableNodeManifestCache() {
    manifestCache = null;
    console.log("[editableManifestService] Manifest cache cleared.");
}

async function getEditableNodeDefinition(nodeType) {
    const manifest = await loadEditableNodeManifest();
    return manifest.nodeTypes[nodeType] || null;
}

async function getOperationGroupDefinition(groupKey) {
    const manifest = await loadEditableNodeManifest();
    return manifest.operationGroups[groupKey] || null;
}

module.exports = {
    loadEditableNodeManifest,
    clearEditableNodeManifestCache,
    getEditableNodeDefinition,
    getOperationGroupDefinition,
    MANIFEST_PATH
};