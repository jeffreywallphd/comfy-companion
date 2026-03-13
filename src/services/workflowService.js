const fs = require("fs/promises");
const path = require("path");
const config = require("../config/config");

function getWorkflowPath(fileName) {
    return path.join(config.workflowsDir, path.basename(fileName));
}

async function listWorkflows() {
    const entries = await fs.readdir(config.workflowsDir, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => ({
            fileName: entry.name,
            displayName: entry.name.replace(/\.json$/i, "")
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function loadWorkflow(fileName) {
    const workflowPath = getWorkflowPath(fileName);
    const raw = await fs.readFile(workflowPath, "utf8");
    return JSON.parse(raw);
}

function cloneWorkflow(workflow) {
    return JSON.parse(JSON.stringify(workflow));
}

function patchWorkflow(workflow, patches = []) {
    const cloned = cloneWorkflow(workflow);

    for (const patch of patches) {
        const { nodeId, inputName, value } = patch;
        if (!cloned[nodeId]) {
            throw new Error(`Node not found: ${nodeId}`);
        }
        if (!cloned[nodeId].inputs) {
            cloned[nodeId].inputs = {};
        }
        cloned[nodeId].inputs[inputName] = value;
    }

    return cloned;
}

module.exports = {
    listWorkflows,
    loadWorkflow,
    patchWorkflow
};