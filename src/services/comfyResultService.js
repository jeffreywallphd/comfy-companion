const config = require("../config/config");

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPromptHistory(promptId) {
    const url = `${config.comfyUrl}/history/${encodeURIComponent(promptId)}`;

    const response = await fetch(url);
    const text = await response.text();

    if (!response.ok) {
        throw new Error(`Failed to fetch prompt history: ${response.status} ${text}`);
    }

    return JSON.parse(text);
}

function getPromptHistoryEntry(historyJson, promptId) {
    if (!historyJson || typeof historyJson !== "object") {
        return null;
    }

    return historyJson[promptId] || null;
}

function extractOutputImagesFromHistoryEntry(promptHistory) {
    if (!promptHistory || !promptHistory.outputs || typeof promptHistory.outputs !== "object") {
        return [];
    }

    const images = [];

    for (const [nodeId, output] of Object.entries(promptHistory.outputs)) {
        if (!output || !Array.isArray(output.images)) {
            continue;
        }

        for (const image of output.images) {
            images.push({
                nodeId,
                fileName: image.filename,
                subfolder: image.subfolder || "",
                type: image.type || "output"
            });
        }
    }

    return images;
}

function extractTerminalErrorInfo(promptHistory) {
    if (!promptHistory || typeof promptHistory !== "object") {
        return null;
    }

    const status = promptHistory.status || {};
    const messages = Array.isArray(status.messages) ? status.messages : [];

    const errorMessages = messages
        .filter((msg) => Array.isArray(msg) && msg[0] === "execution_error")
        .map((msg) => msg[1]);

    return {
        completed: Boolean(status.completed),
        status,
        errorMessages
    };
}

async function waitForPromptOutputs(promptId, options = {}) {
    const timeoutMs = options.timeoutMs ?? 120000;
    const intervalMs = options.intervalMs ?? 1500;
    const start = Date.now();
    let lastHistory = null;

    while (Date.now() - start < timeoutMs) {
        const history = await fetchPromptHistory(promptId);
        lastHistory = history;

        const promptHistory = getPromptHistoryEntry(history, promptId);

        if (promptHistory) {
            const images = extractOutputImagesFromHistoryEntry(promptHistory);
            const terminalInfo = extractTerminalErrorInfo(promptHistory);

            console.log("[comfyResultService] Prompt history entry found for prompt:", promptId);
            console.log(
                "[comfyResultService] History summary:",
                {
                    hasOutputs: Boolean(promptHistory.outputs),
                    imageCount: images.length,
                    completed: terminalInfo?.completed ?? false,
                    statusKeys: Object.keys(promptHistory.status || {})
                }
            );

            if (images.length > 0) {
                return {
                    history,
                    promptHistory,
                    images,
                    completed: true
                };
            }

            // If ComfyUI has created a history entry and marked the prompt complete,
            // stop waiting and surface a useful error instead of timing out.
            if (terminalInfo?.completed) {
                const errorText =
                    terminalInfo.errorMessages.length > 0
                        ? JSON.stringify(terminalInfo.errorMessages, null, 2)
                        : "Prompt completed but no output images were found in history.";

                const error = new Error(errorText);
                error.promptHistory = promptHistory;
                error.history = history;
                error.completedWithoutImages = true;
                throw error;
            }
        }

        await sleep(intervalMs);
    }

    const timeoutError = new Error(`Timed out waiting for ComfyUI outputs for prompt ${promptId}`);
    timeoutError.history = lastHistory;
    throw timeoutError;
}

module.exports = {
    fetchPromptHistory,
    getPromptHistoryEntry,
    extractOutputImagesFromHistoryEntry,
    waitForPromptOutputs
};