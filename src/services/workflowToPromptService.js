const {
    buildWorkflowGraph,
    getIncomingEdges
} = require("./workflowGraphService");

function getSpecialWidgetValue(node, inputName) {
    if (!node || !Array.isArray(node.widgets_values)) {
        return { handled: false };
    }

    // ComfyUI saved KSampler UI workflows commonly store:
    // [seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise]
    if (node.type === "KSampler") {
        const ksamplerMap = {
            seed: 0,
            steps: 2,
            cfg: 3,
            sampler_name: 4,
            scheduler: 5,
            denoise: 6
        };

        if (inputName in ksamplerMap) {
            const widgetIndex = ksamplerMap[inputName];
            return {
                handled: true,
                value: node.widgets_values[widgetIndex]
            };
        }
    }

    return { handled: false };
}

function getGenericWidgetValue(node, inputName) {
    if (!node || !Array.isArray(node.inputs)) {
        return undefined;
    }

    const widgetBackedInputs = node.inputs.filter(
        (input) =>
            input &&
            input.widget &&
            input.widget.name &&
            input.type !== "IMAGEUPLOAD"
    );

    const widgetIndex = widgetBackedInputs.findIndex(
        (input) => input.name === inputName
    );

    if (widgetIndex < 0) {
        return undefined;
    }

    return Array.isArray(node.widgets_values)
        ? node.widgets_values[widgetIndex]
        : undefined;
}

function getWidgetValueForInput(node, inputName) {
    const special = getSpecialWidgetValue(node, inputName);
    if (special.handled) {
        return special.value;
    }

    return getGenericWidgetValue(node, inputName);
}

function buildPromptNode(node, graph) {
    const promptNode = {
        class_type: node.type,
        inputs: {}
    };

    const nodeInputs = Array.isArray(node.inputs) ? node.inputs : [];
    const incomingEdges = getIncomingEdges(graph, node.id);

    for (let inputIndex = 0; inputIndex < nodeInputs.length; inputIndex += 1) {
        const input = nodeInputs[inputIndex];

        if (!input || !input.name) {
            continue;
        }

        // Linked input: convert to ComfyUI API link reference [nodeId, outputIndex]
        if (input.link != null) {
            const incomingEdge = incomingEdges.find(
                (edge) =>
                    edge.targetInputIndex === inputIndex ||
                    edge.targetInputName === input.name
            );

            if (!incomingEdge) {
                console.warn(
                    `[workflowToPromptService] Missing incoming edge for node ${node.id} input ${input.name}`
                );
                continue;
            }

            promptNode.inputs[input.name] = [
                String(incomingEdge.sourceNodeId),
                Number(incomingEdge.sourceOutputIndex)
            ];

            continue;
        }

        // Widget-backed input: use widgets_values
        if (input.widget && input.type !== "IMAGEUPLOAD") {
            const value = getWidgetValueForInput(node, input.name);

            if (value !== undefined) {
                promptNode.inputs[input.name] = value;
            }

            continue;
        }

        // Ignore UI-only upload widget inputs like LoadImage.upload
    }

    return promptNode;
}

function convertWorkflowToPrompt(workflowJson) {
    console.log("[workflowToPromptService] Converting saved workflow JSON to ComfyUI API prompt format.");

    if (!workflowJson || !Array.isArray(workflowJson.nodes)) {
        throw new Error("Workflow JSON is missing a nodes array.");
    }

    const graph = buildWorkflowGraph(workflowJson);
    const prompt = {};

    const sortedNodes = [...workflowJson.nodes].sort((a, b) => {
        const aOrder = Number(a.order ?? 9999);
        const bOrder = Number(b.order ?? 9999);
        return aOrder - bOrder;
    });

    for (const node of sortedNodes) {
        prompt[String(node.id)] = buildPromptNode(node, graph);
    }

    console.log(
        "[workflowToPromptService] Conversion complete. Prompt node count:",
        Object.keys(prompt).length
    );

    return prompt;
}

function buildRunSuffix() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

function forceUniqueSaveImagePrefixes(promptWorkflow) {
    const suffix = buildRunSuffix();

    for (const [nodeId, node] of Object.entries(promptWorkflow || {})) {
        if (!node || node.class_type !== "SaveImage") {
            continue;
        }

        const currentPrefix =
            typeof node.inputs?.filename_prefix === "string" &&
            node.inputs.filename_prefix.trim().length > 0
                ? node.inputs.filename_prefix.trim()
                : "Orchestrator";

        node.inputs.filename_prefix = `${currentPrefix}__${suffix}`;

        console.log(
            `[workflowToPromptService] Updated SaveImage filename_prefix for node ${nodeId}: ${node.inputs.filename_prefix}`
        );
    }

    return promptWorkflow;
}

module.exports = {
    convertWorkflowToPrompt,
    forceUniqueSaveImagePrefixes
};