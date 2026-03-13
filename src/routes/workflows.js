const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const {
    getWorkflowsBySource,
    getComfyUiWorkflows,
    getLocalWorkflows,
    getWorkflowById,
    LOCAL_WORKFLOWS_DIR
} = require("../services/workflowLibraryService");

const { queuePrompt } = require("../services/comfyService");

const {
    loadWorkflow,
    patchWorkflow
} = require("../services/workflowService");

const {
    buildDefaultValuesFromEditableFields,
    applyEditableOverridesToWorkflow
} = require("../services/workflowEditableFieldService");

const {
    resolveImageSelection,
    copyLocalImageToComfyInput,
    registerPendingCleanup,
    removeFiles
} = require("../services/imageLibraryService");

const {
    convertWorkflowToPrompt,
    forceUniqueSaveImagePrefixes
} = require("../services/workflowToPromptService");

const { waitForPromptOutputs } = require("../services/comfyResultService");
const { moveComfyOutputToGenerations } = require("../services/generationLibraryService");

const router = express.Router();

function extractDefaultValues(workflow, editableFields = []) {
    const values = {};

    for (const field of editableFields) {
        const nodeId = String(field.nodeId || "");
        const inputName = field.inputName;

        if (!nodeId || !inputName) {
            continue;
        }

        const node = workflow[nodeId];
        const value = node?.inputs?.[inputName];

        values[field.key || field.label || `${nodeId}.${inputName}`] = value;
    }

    return values;
}

router.get("/", async (req, res) => {
    try {
        const source = String(req.query.source || "all").toLowerCase();
        const workflows = await getWorkflowsBySource(source);

        res.json({
            source,
            count: workflows.length,
            workflows
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to load workflows",
            details: error.message
        });
    }
});

router.get("/comfyui", async (req, res) => {
    try {
        const workflows = await getComfyUiWorkflows();
        res.json({ source: "comfyui", count: workflows.length, workflows });
    } catch (error) {
        res.status(500).json({
            error: "Failed to load ComfyUI workflows",
            details: error.message
        });
    }
});

router.get("/local", async (req, res) => {
    try {
        const workflows = await getLocalWorkflows();
        res.json({ source: "local", count: workflows.length, workflows });
    } catch (error) {
        res.status(500).json({
            error: "Failed to load local workflows",
            details: error.message
        });
    }
});

router.get("/:fileName", async (req, res) => {
    try {
        const workflow = await loadWorkflow(req.params.fileName);
        res.json({ workflow });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

router.get("/item/:source/:workflowId", async (req, res) => {
    try {
        const { source, workflowId } = req.params;
        const decodedWorkflowId = decodeURIComponent(workflowId);

        const item = await getWorkflowById(source, decodedWorkflowId);

        res.json({
            workflowItem: item,
            defaultValues: buildDefaultValuesFromEditableFields(item.editableFields || [])
        });
    } catch (error) {
        console.error("[routes/workflows] Failed to load workflow item:", error);
        res.status(500).json({
            error: "Failed to load workflow item",
            details: error.message
        });
    }
});

router.post("/:fileName/patch", async (req, res) => {
    try {
        const workflow = await loadWorkflow(req.params.fileName);
        const patched = patchWorkflow(workflow, req.body.patches || []);
        res.json({ workflow: patched });
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

router.post("/run", async (req, res) => {
    const cleanupFiles = [];

    try {
        const { source, workflowId, overrides = {} } = req.body;

        console.log("[routes/workflows] Run request received:", {
            source,
            workflowId,
            overrideKeys: Object.keys(overrides || {})
        });

        if (!source || !workflowId) {
            return res.status(400).json({
                error: "source and workflowId are required"
            });
        }

        const item = await getWorkflowById(source, workflowId);
        const editableFields = item.editableFields || [];
        const preparedOverrides = { ...overrides };

        // Resolve image selections before applying workflow overrides
        for (const field of editableFields) {
            if (!(field.key in preparedOverrides)) {
                continue;
            }

            if (field.type !== "image_select") {
                continue;
            }

            const selection = preparedOverrides[field.key];

            if (!selection || typeof selection !== "object") {
                continue;
            }

            const resolved = await resolveImageSelection(selection);

            if (resolved.source === "local") {
                const copied = await copyLocalImageToComfyInput(resolved.fileName);
                preparedOverrides[field.key] = copied.tempFileName;
                cleanupFiles.push(copied.targetPath);

                console.log("[routes/workflows] Copied local image to ComfyUI input:", {
                    fieldKey: field.key,
                    sourceFile: resolved.fileName,
                    tempFileName: copied.tempFileName,
                    targetPath: copied.targetPath
                });
            } else {
                preparedOverrides[field.key] = resolved.fileName;

                console.log("[routes/workflows] Using existing image from source:", {
                    fieldKey: field.key,
                    source: resolved.source,
                    fileName: resolved.fileName
                });
            }
        }

        if (source === "comfyui") {
            const patchedUiWorkflow = applyEditableOverridesToWorkflow(
                item.workflow,
                item.editableFields || [],
                preparedOverrides
            );

            console.log("[routes/workflows] ComfyUI UI-format workflow overrides applied.");

            let promptWorkflow = convertWorkflowToPrompt(patchedUiWorkflow);
            promptWorkflow = forceUniqueSaveImagePrefixes(promptWorkflow);

            console.log(
                "[routes/workflows] Converted ComfyUI UI workflow to API prompt format:",
                Object.keys(promptWorkflow)
            );

            console.log(
                "[routes/workflows] Final prompt workflow preview:",
                JSON.stringify(promptWorkflow, null, 2).slice(0, 6000)
            );

            const comfyResponse = await queuePrompt(promptWorkflow);

            await registerPendingCleanup(comfyResponse.prompt_id, cleanupFiles);

            const result = await waitForPromptOutputs(comfyResponse.prompt_id);
            const movedGenerations = [];

            for (const image of result.images) {
                if (image.type !== "output") continue;
                const moved = await moveComfyOutputToGenerations(image.fileName, image.subfolder);
                movedGenerations.push(moved);
            }

            return res.json({
                ok: true,
                source,
                workflowId,
                queued: true,
                cleanupRegistered: cleanupFiles.length,
                promptNodeCount: Object.keys(promptWorkflow).length,
                comfyResponse,
                generations: movedGenerations
            });
        }

        if (source === "local") {
            const patches = [];

            for (const field of item.editableFields || []) {
                if (!(field.key in preparedOverrides)) continue;

                patches.push({
                    nodeId: String(field.nodeId),
                    inputName: field.inputName,
                    value: preparedOverrides[field.key]
                });
            }

            let runnableWorkflow = patchWorkflow(item.workflow, patches);
            runnableWorkflow = forceUniqueSaveImagePrefixes(runnableWorkflow);

            console.log(
                "[routes/workflows] Final local runnable workflow preview:",
                JSON.stringify(runnableWorkflow, null, 2).slice(0, 6000)
            );

            const comfyResponse = await queuePrompt(runnableWorkflow);

            await registerPendingCleanup(comfyResponse.prompt_id, cleanupFiles);

            const result = await waitForPromptOutputs(comfyResponse.prompt_id);
            const movedGenerations = [];

            for (const image of result.images) {
                if (image.type !== "output") continue;
                const moved = await moveComfyOutputToGenerations(image.fileName, image.subfolder);
                movedGenerations.push(moved);
            }

            return res.json({
                ok: true,
                source,
                workflowId,
                queued: true,
                cleanupRegistered: cleanupFiles.length,
                comfyResponse,
                generations: movedGenerations
            });
        }

        return res.status(400).json({
            error: `Unsupported source: ${source}`
        });
    } catch (error) {
        console.error("[routes/workflows] Failed to run workflow:", error);

        if (error.promptHistory) {
            console.error(
                "[routes/workflows] Prompt history at failure:",
                JSON.stringify(error.promptHistory, null, 2)
            );
        }

        if (error.history) {
            console.error(
                "[routes/workflows] Full history payload at failure:",
                JSON.stringify(error.history, null, 2)
            );
        }

        res.status(500).json({
            error: "Failed to run workflow",
            details: error.message,
            completedWithoutImages: Boolean(error.completedWithoutImages)
        });
    } finally {
        if (cleanupFiles.length > 0) {
            console.log("[routes/workflows] Cleaning up temporary ComfyUI input files:", cleanupFiles);
            await removeFiles(cleanupFiles);
        }
    }
});

router.get("/local/file/:fileName", async (req, res) => {
    try {
        const fileName = path.basename(req.params.fileName);
        const fullPath = path.join(LOCAL_WORKFLOWS_DIR, fileName);
        const raw = await fs.readFile(fullPath, "utf8");
        const json = JSON.parse(raw);

        res.json({ workflow: json });
    } catch (error) {
        res.status(500).json({
            error: "Failed to load local workflow file",
            details: error.message
        });
    }
});

module.exports = router;