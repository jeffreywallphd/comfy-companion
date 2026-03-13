const config = require("../config/config");

async function queuePrompt(promptWorkflow) {
    const url = `${config.comfyUrl}/prompt`;

    console.log("[comfyService.queuePrompt] Sending workflow to ComfyUI:", url);
    console.log(
        "[comfyService.queuePrompt] Prompt node keys:",
        Object.keys(promptWorkflow || {})
    );

    const payload = {
        prompt: promptWorkflow
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
        console.error("[comfyService.queuePrompt] ComfyUI returned error:", text);
        console.error(
            "[comfyService.queuePrompt] Failed payload preview:",
            JSON.stringify(payload, null, 2).slice(0, 6000)
        );
        throw new Error(`ComfyUI prompt request failed: ${response.status} ${text}`);
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (error) {
        console.error("[comfyService.queuePrompt] Failed to parse ComfyUI response JSON:", text);
        throw error;
    }

    console.log("[comfyService.queuePrompt] Workflow queued successfully:", json);
    return json;
}

module.exports = {
    queuePrompt
};