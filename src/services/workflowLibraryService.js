const fs = require("fs/promises");
const path = require("path");
const config = require("../config/config");

const {buildEditableFieldsFromWorkflow} = require("./workflowEditableFieldService");

const LOCAL_WORKFLOWS_DIR = path.resolve(config.dataDir, "local-workflows");

console.log("[workflowLibraryService] Module loaded.");
console.log("[workflowLibraryService] ComfyUI workflows directory:", config.workflowsDir);
console.log("[workflowLibraryService] Local workflows directory:", LOCAL_WORKFLOWS_DIR);

async function ensureDirectory(dirPath) {
    console.log(`[workflowLibraryService.ensureDirectory] Ensuring directory exists: ${dirPath}`);

    try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`[workflowLibraryService.ensureDirectory] Directory is ready: ${dirPath}`);
    } catch (error) {
        console.error(
            `[workflowLibraryService.ensureDirectory] Failed to ensure directory: ${dirPath}`,
            error
        );
        throw error;
    }
}

async function readJsonFile(filePath) {
    console.log(`[workflowLibraryService.readJsonFile] Reading JSON file: ${filePath}`);

    try {
        const raw = await fs.readFile(filePath, "utf8");
        console.log(
            `[workflowLibraryService.readJsonFile] File read successfully: ${filePath}. Length: ${raw.length} chars`
        );

        const parsed = JSON.parse(raw);
        console.log(`[workflowLibraryService.readJsonFile] JSON parsed successfully: ${filePath}`);

        return parsed;
    } catch (error) {
        console.error(
            `[workflowLibraryService.readJsonFile] Failed to read or parse JSON file: ${filePath}`,
            error
        );
        throw error;
    }
}

async function listJsonFiles(dirPath) {
    console.log(`[workflowLibraryService.listJsonFiles] Listing JSON files in directory: ${dirPath}`);

    try {
        await ensureDirectory(dirPath);

        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        console.log(
            `[workflowLibraryService.listJsonFiles] Total directory entries found in ${dirPath}: ${entries.length}`
        );

        const jsonFiles = entries
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
            .map((entry) => entry.name);

        console.log(
            `[workflowLibraryService.listJsonFiles] JSON workflow files found in ${dirPath}:`,
            jsonFiles
        );

        return jsonFiles;
    } catch (error) {
        console.error(
            `[workflowLibraryService.listJsonFiles] Failed to list JSON files in directory: ${dirPath}`,
            error
        );
        throw error;
    }
}

function safeDate(value) {
    console.log("[workflowLibraryService.safeDate] Normalizing date value:", value);

    if (!value) {
        console.log("[workflowLibraryService.safeDate] No date value provided. Returning null.");
        return null;
    }

    const date = new Date(value);
    const result = Number.isNaN(date.getTime()) ? null : date.toISOString();

    console.log("[workflowLibraryService.safeDate] Normalized date result:", result);
    return result;
}

function countApiWorkflowNodes(workflow) {
    console.log("[workflowLibraryService.countApiWorkflowNodes] Counting workflow nodes.");

    if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
        console.log(
            "[workflowLibraryService.countApiWorkflowNodes] Workflow is missing or not a valid object. Returning null."
        );
        return null;
    }

    const nodeCount = Object.keys(workflow).length;
    console.log("[workflowLibraryService.countApiWorkflowNodes] Node count:", nodeCount);

    return nodeCount;
}

function normalizeComfyWorkflow(fileName, stats, json) {
    console.log(`[workflowLibraryService.normalizeComfyWorkflow] Normalizing ComfyUI workflow: ${fileName}`);

    const workflow = json.workflow || json;
    const metadata = json.metadata || {};

    const normalized = {
        id: fileName,
        fileName,
        displayName: metadata.displayName || fileName.replace(/\.json$/i, ""),
        name: metadata.name || fileName.replace(/\.json$/i, ""),
        source: "comfyui",
        category: metadata.category || "ComfyUI",
        description: metadata.description || "",
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        editableFields: Array.isArray(metadata.editableFields) ? metadata.editableFields : [],
        nodeCount: countApiWorkflowNodes(workflow),
        updatedAt: safeDate(stats.mtime),
        path: path.join(config.workflowsDir, fileName)
    };

    console.log(
        `[workflowLibraryService.normalizeComfyWorkflow] Normalized ComfyUI workflow summary for ${fileName}:`,
        {
            displayName: normalized.displayName,
            nodeCount: normalized.nodeCount,
            category: normalized.category,
            updatedAt: normalized.updatedAt
        }
    );

    return normalized;
}

function normalizeLocalWorkflow(fileName, stats, json) {
    console.log(`[workflowLibraryService.normalizeLocalWorkflow] Normalizing local workflow: ${fileName}`);

    const metadata = json.metadata || {};
    const workflow = json.workflow || json;

    const normalized = {
        id: json.id || fileName,
        fileName,
        displayName: metadata.displayName || json.displayName || fileName.replace(/\.json$/i, ""),
        name: metadata.name || json.name || fileName.replace(/\.json$/i, ""),
        source: "local",
        category: metadata.category || json.category || "Local Library",
        description: metadata.description || json.description || "",
        tags: Array.isArray(metadata.tags)
            ? metadata.tags
            : Array.isArray(json.tags)
                ? json.tags
                : [],
        editableFields: Array.isArray(metadata.editableFields)
            ? metadata.editableFields
            : Array.isArray(json.editableFields)
                ? json.editableFields
                : [],
        nodeCount: countApiWorkflowNodes(workflow),
        updatedAt: safeDate(metadata.updatedAt || json.updatedAt || stats.mtime),
        path: path.join(LOCAL_WORKFLOWS_DIR, fileName)
    };

    console.log(
        `[workflowLibraryService.normalizeLocalWorkflow] Normalized local workflow summary for ${fileName}:`,
        {
            displayName: normalized.displayName,
            nodeCount: normalized.nodeCount,
            category: normalized.category,
            updatedAt: normalized.updatedAt
        }
    );

    return normalized;
}

async function getComfyUiWorkflows() {
    console.log("[workflowLibraryService.getComfyUiWorkflows] Loading ComfyUI workflows.");

    try {
        const files = await listJsonFiles(config.workflowsDir);
        console.log(
            `[workflowLibraryService.getComfyUiWorkflows] Number of ComfyUI workflow files found: ${files.length}`
        );

        const results = [];

        for (const fileName of files) {
            const fullPath = path.join(config.workflowsDir, fileName);
            console.log(
                `[workflowLibraryService.getComfyUiWorkflows] Processing ComfyUI workflow file: ${fileName}`
            );

            try {
                const [stats, json] = await Promise.all([
                    fs.stat(fullPath),
                    readJsonFile(fullPath)
                ]);

                console.log(
                    `[workflowLibraryService.getComfyUiWorkflows] File stats loaded for ${fileName}. Modified time: ${stats.mtime}`
                );

                const normalized = normalizeComfyWorkflow(fileName, stats, json);
                results.push(normalized);

                console.log(
                    `[workflowLibraryService.getComfyUiWorkflows] Successfully added ComfyUI workflow: ${fileName}`
                );
            } catch (error) {
                console.error(
                    `[workflowLibraryService.getComfyUiWorkflows] Failed to process ComfyUI workflow file: ${fileName}`,
                    error
                );

                results.push({
                    id: fileName,
                    fileName,
                    displayName: fileName.replace(/\.json$/i, ""),
                    source: "comfyui",
                    category: "ComfyUI",
                    description: "This workflow file could not be parsed.",
                    tags: ["parse-error"],
                    editableFields: [],
                    nodeCount: null,
                    updatedAt: null,
                    path: fullPath,
                    error: error.message
                });
            }
        }

        console.log(
            `[workflowLibraryService.getComfyUiWorkflows] Completed loading ComfyUI workflows. Total returned: ${results.length}`
        );

        return results;
    } catch (error) {
        console.error("[workflowLibraryService.getComfyUiWorkflows] Failed to load ComfyUI workflows.", error);
        throw error;
    }
}

async function getLocalWorkflows() {
    console.log("[workflowLibraryService.getLocalWorkflows] Loading local orchestrator workflows.");

    try {
        const files = await listJsonFiles(LOCAL_WORKFLOWS_DIR);
        console.log(
            `[workflowLibraryService.getLocalWorkflows] Number of local workflow files found: ${files.length}`
        );

        const results = [];

        for (const fileName of files) {
            const fullPath = path.join(LOCAL_WORKFLOWS_DIR, fileName);
            console.log(
                `[workflowLibraryService.getLocalWorkflows] Processing local workflow file: ${fileName}`
            );

            try {
                const [stats, json] = await Promise.all([
                    fs.stat(fullPath),
                    readJsonFile(fullPath)
                ]);

                console.log(
                    `[workflowLibraryService.getLocalWorkflows] File stats loaded for ${fileName}. Modified time: ${stats.mtime}`
                );

                const normalized = normalizeLocalWorkflow(fileName, stats, json);
                results.push(normalized);

                console.log(
                    `[workflowLibraryService.getLocalWorkflows] Successfully added local workflow: ${fileName}`
                );
            } catch (error) {
                console.error(
                    `[workflowLibraryService.getLocalWorkflows] Failed to process local workflow file: ${fileName}`,
                    error
                );

                results.push({
                    id: fileName,
                    fileName,
                    displayName: fileName.replace(/\.json$/i, ""),
                    source: "local",
                    category: "Local Library",
                    description: "This local workflow file could not be parsed.",
                    tags: ["parse-error"],
                    editableFields: [],
                    nodeCount: null,
                    updatedAt: null,
                    path: fullPath,
                    error: error.message
                });
            }
        }

        console.log(
            `[workflowLibraryService.getLocalWorkflows] Completed loading local workflows. Total returned: ${results.length}`
        );

        return results;
    } catch (error) {
        console.error("[workflowLibraryService.getLocalWorkflows] Failed to load local workflows.", error);
        throw error;
    }
}

async function getWorkflowsBySource(source = "all") {
    console.log(`[workflowLibraryService.getWorkflowsBySource] Requested source: ${source}`);

    if (source === "comfyui") {
        console.log("[workflowLibraryService.getWorkflowsBySource] Returning ComfyUI workflows only.");
        return getComfyUiWorkflows();
    }

    if (source === "local") {
        console.log("[workflowLibraryService.getWorkflowsBySource] Returning local workflows only.");
        return getLocalWorkflows();
    }

    console.log("[workflowLibraryService.getWorkflowsBySource] Loading both ComfyUI and local workflows.");

    const [comfyui, local] = await Promise.all([
        getComfyUiWorkflows(),
        getLocalWorkflows()
    ]);

    console.log("[workflowLibraryService.getWorkflowsBySource] Finished collecting workflows from both sources.");
    console.log(
        "[workflowLibraryService.getWorkflowsBySource] Counts by source:",
        {
            comfyui: comfyui.length,
            local: local.length,
            total: comfyui.length + local.length
        }
    );

    return [...comfyui, ...local];
}

async function getWorkflowFilePath(source, workflowId) {
    const safeId = path.basename(workflowId);

    if (source === "comfyui") {
        return path.join(config.workflowsDir, safeId);
    }

    if (source === "local") {
        return path.join(LOCAL_WORKFLOWS_DIR, safeId);
    }

    throw new Error(`Unsupported workflow source: ${source}`);
}

async function getWorkflowById(source, workflowId) {
    console.log(`[workflowLibraryService.getWorkflowById] Loading workflow. source=${source}, workflowId=${workflowId}`);

    const filePath = await getWorkflowFilePath(source, workflowId);
    const [stats, json] = await Promise.all([
        fs.stat(filePath),
        readJsonFile(filePath)
    ]);

    if (source === "comfyui") {
        const normalized = normalizeComfyWorkflow(path.basename(filePath), stats, json);
        const editableFields = await buildEditableFieldsFromWorkflow(json);

        return {
            ...normalized,
            editableFields,
            workflow: json,
            raw: json
        };
    }

    if (source === "local") {
        const normalized = normalizeLocalWorkflow(path.basename(filePath), stats, json);

        const existingEditableFields =
            Array.isArray(json.editableFields)
                ? json.editableFields
                : Array.isArray(normalized.editableFields)
                    ? normalized.editableFields
                    : [];

        return {
            ...normalized,
            editableFields: existingEditableFields,
            workflow: json.workflow || json,
            raw: json
        };
    }

    throw new Error(`Unsupported workflow source: ${source}`);
}

module.exports = {
    getWorkflowsBySource,
    getComfyUiWorkflows,
    getLocalWorkflows,
    getWorkflowById,
    LOCAL_WORKFLOWS_DIR
};