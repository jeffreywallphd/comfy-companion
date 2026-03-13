const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const config = require("../config/config");

const LOCAL_IMAGE_DIR = path.resolve(config.dataDir, "images/local");
const CLEANUP_REGISTRY_PATH = path.resolve(config.dataDir, "images/manifests/comfy-cleanup.json");

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function ensureImageDirs() {
    await ensureDir(LOCAL_IMAGE_DIR);
    await ensureDir(path.dirname(CLEANUP_REGISTRY_PATH));
}

function isImageFile(fileName) {
    return /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(fileName);
}

function safeNowStamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

async function listLocalImages() {
    await ensureImageDirs();

    const entries = await fs.readdir(LOCAL_IMAGE_DIR, { withFileTypes: true });
    const files = entries
        .filter((entry) => entry.isFile() && isImageFile(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    return files.map((fileName) => ({
        id: `local:${fileName}`,
        source: "local",
        fileName,
        displayName: fileName,
        path: path.join(LOCAL_IMAGE_DIR, fileName),
        thumbnailUrl: `/api/assets/local-image/${encodeURIComponent(fileName)}`
    }));
}

async function listComfyInputImages() {
    if (!config.comfyInputDir) {
        return [];
    }

    try {
        const entries = await fs.readdir(config.comfyInputDir, { withFileTypes: true });
        const files = entries
            .filter((entry) => entry.isFile() && isImageFile(entry.name))
            .map((entry) => entry.name)
            .sort((a, b) => a.localeCompare(b));

        return files.map((fileName) => ({
            id: `comfyui:${fileName}`,
            source: "comfyui",
            fileName,
            displayName: fileName,
            path: path.join(config.comfyInputDir, fileName),
            thumbnailUrl: `${config.comfyUrl}/view?filename=${encodeURIComponent(fileName)}&type=input`
        }));
    } catch (error) {
        console.error("[imageLibraryService] Failed to list ComfyUI input images:", error.message);
        return [];
    }
}

async function listImagesBySource(source = "all") {
    if (source === "local") {
        return listLocalImages();
    }

    if (source === "comfyui") {
        return listComfyInputImages();
    }

    const [local, comfyui] = await Promise.all([
        listLocalImages(),
        listComfyInputImages()
    ]);

    return [...local, ...comfyui];
}

async function resolveImageSelection(selection) {
    if (!selection || typeof selection !== "object") {
        throw new Error("Image selection is invalid.");
    }

    const { source, fileName } = selection;

    if (!source || !fileName) {
        throw new Error("Image selection must include source and fileName.");
    }

    if (source === "local") {
        const fullPath = path.join(LOCAL_IMAGE_DIR, path.basename(fileName));
        await fs.access(fullPath);
        return {
            source,
            fileName: path.basename(fileName),
            fullPath
        };
    }

    if (source === "comfyui") {
        if (!config.comfyInputDir) {
            throw new Error("COMFY_INPUT_DIR is not configured.");
        }

        const fullPath = path.join(config.comfyInputDir, path.basename(fileName));
        await fs.access(fullPath);
        return {
            source,
            fileName: path.basename(fileName),
            fullPath
        };
    }

    throw new Error(`Unsupported image source: ${source}`);
}

async function copyLocalImageToComfyInput(fileName) {
    if (!config.comfyInputDir) {
        throw new Error("COMFY_INPUT_DIR is not configured.");
    }

    await ensureImageDirs();
    await ensureDir(config.comfyInputDir);

    const sourcePath = path.join(LOCAL_IMAGE_DIR, path.basename(fileName));
    await fs.access(sourcePath);

    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const tempName = `${base}__orch__${safeNowStamp()}__${crypto.randomBytes(4).toString("hex")}${ext}`;
    const targetPath = path.join(config.comfyInputDir, tempName);

    await fs.copyFile(sourcePath, targetPath);

    return {
        tempFileName: tempName,
        targetPath
    };
}

async function readCleanupRegistry() {
    try {
        const raw = await fs.readFile(CLEANUP_REGISTRY_PATH, "utf8");
        return JSON.parse(raw);
    } catch {
        return { pending: [] };
    }
}

async function writeCleanupRegistry(data) {
    await ensureImageDirs();
    await fs.writeFile(CLEANUP_REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function registerPendingCleanup(promptId, files = []) {
    if (!promptId || !files.length) return;

    const registry = await readCleanupRegistry();
    registry.pending.push({
        promptId,
        files,
        createdAt: new Date().toISOString()
    });

    await writeCleanupRegistry(registry);
}

module.exports = {
    LOCAL_IMAGE_DIR,
    listImagesBySource,
    listLocalImages,
    listComfyInputImages,
    resolveImageSelection,
    copyLocalImageToComfyInput,
    registerPendingCleanup
};