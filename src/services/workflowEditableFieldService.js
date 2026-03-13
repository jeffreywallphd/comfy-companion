const { loadEditableNodeManifest } = require("./editableManifestService");
const {
    buildWorkflowGraph,
    getDirectInputSource,
    hasDownstreamNodeType
} = require("./workflowGraphService");

function getWidgetBackedInputs(node) {
    if (!node || !Array.isArray(node.inputs)) {
        return [];
    }

    return node.inputs.filter((input) => input && input.widget && input.widget.name);
}

function getWidgetIndexByInputName(node, inputName) {
    const widgetInputs = getWidgetBackedInputs(node);
    return widgetInputs.findIndex((input) => input.name === inputName);
}

function getDefaultValueFromNode(node, inputName) {
    const special = getSpecialWidgetValue(node, inputName);

    if (special.handled) {
        return {
            widgetIndex: special.widgetIndex,
            defaultValue: special.defaultValue
        };
    }

    const widgetIndex = getWidgetIndexByInputName(node, inputName);

    if (widgetIndex < 0) {
        return {
            widgetIndex: -1,
            defaultValue: undefined
        };
    }

    const widgetValues = Array.isArray(node.widgets_values) ? node.widgets_values : [];

    return {
        widgetIndex,
        defaultValue: widgetValues[widgetIndex]
    };
}

function getSpecialWidgetValue(node, inputName) {
    if (!node || !Array.isArray(node.widgets_values)) {
        return { handled: false };
    }

    // KSampler in ComfyUI UI workflows commonly stores:
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
                widgetIndex,
                defaultValue: node.widgets_values[widgetIndex]
            };
        }
    }

    return { handled: false };
}

function applySingleWidgetOverride(node, widgetIndex, value) {
    if (!Array.isArray(node.widgets_values)) {
        node.widgets_values = [];
    }

    node.widgets_values[widgetIndex] = value;
}

function buildFieldKey(node, editableInput) {
    return `${node.type}_${node.id}_${editableInput.inputName}`;
}

function inferNodeInstanceLabel(node, workflowJson, graph) {
    const nodeType = node.type;

    if (nodeType === "CLIPTextEncode") {
        const positiveSource = getDirectInputSource(graph, 5, "positive");
        const negativeSource = getDirectInputSource(graph, 5, "negative");

        if (positiveSource?.sourceNode?.id === node.id) {
            return "Image Generation Prompt";
        }

        if (negativeSource?.sourceNode?.id === node.id) {
            return "Things to Avoid During Generation";
        }

        return `Text Description (Node ${node.id})`;
    }

    if (nodeType === "LoadImage") {
        const reachesFaceIpAdapter = hasDownstreamNodeType(graph, node.id, "IPAdapterFaceID");
        const reachesCompositionIpAdapter = hasDownstreamNodeType(graph, node.id, "IPAdapter");

        if (reachesFaceIpAdapter) {
            return "Reference Face Image";
        } else if(reachesCompositionIpAdapter) {
            return "Reference Body Image";
        }

        return "Reference Image";
    }

    if (nodeType === "ResizeAndPadImage") {
        const reachesFaceIpAdapter = hasDownstreamNodeType(graph, node.id, "IPAdapterFaceID");
        const reachesCompositionIpAdapter = hasDownstreamNodeType(graph, node.id, "IPAdapter");

        if (reachesFaceIpAdapter) {
            return "Reference Face Image Resize";
        } else if(reachesCompositionIpAdapter) {
            return "Reference Body Image Resize";
        }

        return "Main Input Resize";
    }

    if (nodeType === "CheckpointLoaderSimple") {
        return "Checkpoint Loader";
    }

    if (nodeType === "IPAdapterUnifiedLoader") {
        return "IPAdapter Identity Model Loader";
    }

    if (nodeType === "IPAdapterUnifiedLoaderCommunity") {
        return "Body Composition Model Loader";
    }

    if (nodeType === "KSampler") {
        return "Image Generation Settings";
    }

    if (nodeType === "IPAdapterFaceID") {
        return "Face Identity Settings";
    }

    if (nodeType === "IPAdapter") {
        return "Body Composition Settings";
    }

    if (nodeType === "SaveImage") {
        return "Output Settings";
    }

    return `${nodeType} (Node ${node.id})`;
}

function inferOperationGroupKey(node, nodeDefinition, graph) {
    const defaultGroup = nodeDefinition.operationGroup || "ungrouped";

    if (node.type === "LoadImage" || node.type === "ResizeAndPadImage") {
        const reachesFaceIpAdapter = hasDownstreamNodeType(graph, node.id, "IPAdapterFaceID");
        const reachesCompositionIpAdapter = hasDownstreamNodeType(graph, node.id, "IPAdapter");
        if (reachesFaceIpAdapter) {
            return "ipadapter";
        } else if(reachesCompositionIpAdapter) {
            return "ipadapter";
        }
    }

    return defaultGroup;
}

async function buildEditableFieldsFromWorkflow(workflowJson) {
    console.log("[workflowEditableFieldService] Building editable fields from workflow JSON.");

    if (!workflowJson || !Array.isArray(workflowJson.nodes)) {
        console.log("[workflowEditableFieldService] Workflow JSON is missing a nodes array.");
        return [];
    }

    const manifest = await loadEditableNodeManifest();
    const graph = buildWorkflowGraph(workflowJson);
    const fields = [];

    for (const node of workflowJson.nodes) {
        const nodeType = node.type;
        const nodeDefinition = manifest.nodeTypes[nodeType];

        if (!nodeDefinition) {
            continue;
        }

        const nodeLabel = inferNodeInstanceLabel(node, workflowJson, graph);
        const operationGroupKey = inferOperationGroupKey(node, nodeDefinition, graph);
        const operationGroup = manifest.operationGroups[operationGroupKey] || {
            label: operationGroupKey,
            sortOrder: 999
        };

        const nodeSortOrder = Number(nodeDefinition.nodeSortOrder ?? 999);
        const editableInputs = Array.isArray(nodeDefinition.editableInputs)
            ? nodeDefinition.editableInputs
            : [];

        console.log(
            `[workflowEditableFieldService] Processing node ${node.id} (${nodeType}) as "${nodeLabel}" in group "${operationGroup.label}".`
        );

        for (const editableInput of editableInputs) {
            const matchingInput = Array.isArray(node.inputs)
                ? node.inputs.find((input) => input.name === editableInput.inputName)
                : null;

            if (!matchingInput) {
                continue;
            }

            const { widgetIndex, defaultValue } = getDefaultValueFromNode(
                node,
                editableInput.inputName
            );

            if (widgetIndex < 0) {
                continue;
            }

            const fieldLabel = editableInput.label || editableInput.inputName;

            fields.push({
                key: buildFieldKey(node, editableInput),
                label: fieldLabel,
                fullLabel: `${nodeLabel} · ${fieldLabel}`,
                description: editableInput.description || "",
                nodeLabel,
                operationGroupKey,
                operationGroupLabel: operationGroup.label,
                operationGroupSortOrder: Number(operationGroup.sortOrder ?? 999),
                nodeSortOrder,
                inputSortOrder: Number(editableInput.inputSortOrder ?? 999),
                type: editableInput.type || "string",
                nodeId: String(node.id),
                nodeType: node.type,
                inputName: editableInput.inputName,
                widgetIndex,
                defaultValue,
                defaultVisible:
                    editableInput.defaultVisible === undefined
                        ? true
                        : Boolean(editableInput.defaultVisible)
            });
        }
    }

    console.log(
        `[workflowEditableFieldService] Finished building editable fields. Total fields: ${fields.length}`
    );

    return fields;
}

function buildDefaultValuesFromEditableFields(editableFields = []) {
    const defaults = {};

    for (const field of editableFields) {
        defaults[field.key] = field.defaultValue;
    }

    return defaults;
}

function applyEditableOverridesToWorkflow(workflowJson, editableFields = [], overrides = {}) {
    console.log("[workflowEditableFieldService] Applying editable overrides to workflow.");

    const cloned = JSON.parse(JSON.stringify(workflowJson));

    for (const field of editableFields) {
        if (!(field.key in overrides)) {
            continue;
        }

        const nodeIdNum = Number(field.nodeId);
        const node = Array.isArray(cloned.nodes)
            ? cloned.nodes.find((item) => Number(item.id) === nodeIdNum)
            : null;

        if (!node) {
            continue;
        }

        applySingleWidgetOverride(node, field.widgetIndex, overrides[field.key]);
    }

    return cloned;
}

module.exports = {
    buildEditableFieldsFromWorkflow,
    buildDefaultValuesFromEditableFields,
    applyEditableOverridesToWorkflow,
    getWidgetBackedInputs,
    getWidgetIndexByInputName,
    getDefaultValueFromNode
};