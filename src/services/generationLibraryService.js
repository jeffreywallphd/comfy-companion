const fs = require("fs/promises");
const path = require("path");
const config = require("../config/config");

const GENERATIONS_DIR = path.resolve(config.dataDir, "generations");

async function ensureGenerationsDir() {
    await fs.mkdir(GENERATIONS_DIR, { recursive: true });
}

function buildGenerationBaseName(originalName = "generation.png") {
    const ext = path.extname(originalName) || ".png";
    const base = path.basename(originalName, ext).replace(/[^\w.-]+/g, "_");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${stamp}__${base}${ext}`;
}

async function getUniqueGenerationName(originalName) {
    await ensureGenerationsDir();

    const ext = path.extname(originalName) || ".png";
    const baseCandidate = buildGenerationBaseName(originalName);
    const baseNoExt = path.basename(baseCandidate, ext);

    let counter = 0;
    while (true) {
        const candidate =
            counter === 0
                ? `${baseNoExt}${ext}`
                : `${baseNoExt}__${counter}${ext}`;

        const fullPath = path.join(GENERATIONS_DIR, candidate);

        try {
            await fs.access(fullPath);
            counter += 1;
        } catch {
            return candidate;
        }
    }
}

async function moveComfyOutputToGenerations(fileName, subfolder = "") {
    if (!config.comfyOutputDir) {
        throw new Error("COMFY_OUTPUT_DIR is not configured.");
    }

    await ensureGenerationsDir();

    const safeName = path.basename(fileName);
    const sourcePath = path.join(config.comfyOutputDir, subfolder || "", safeName);
    const targetFileName = await getUniqueGenerationName(safeName);
    const targetPath = path.join(GENERATIONS_DIR, targetFileName);

    await fs.rename(sourcePath, targetPath);

    return {
        fileName: targetFileName,
        originalFileName: safeName,
        source: "orchestrator",
        fullPath: targetPath,
        url: `/media/generations/${encodeURIComponent(targetFileName)}`
    };
}

module.exports = {
    GENERATIONS_DIR,
    ensureGenerationsDir,
    moveComfyOutputToGenerations
};