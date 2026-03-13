function buildWorkflowGraph(workflowJson) {
    const nodes = Array.isArray(workflowJson?.nodes) ? workflowJson.nodes : [];
    const links = Array.isArray(workflowJson?.links) ? workflowJson.links : [];

    const nodeMap = new Map();
    const outgoingMap = new Map();
    const incomingMap = new Map();

    for (const node of nodes) {
        nodeMap.set(Number(node.id), node);
        outgoingMap.set(Number(node.id), []);
        incomingMap.set(Number(node.id), []);
    }

    for (const rawLink of links) {
        const [
            linkId,
            sourceNodeId,
            sourceOutputIndex,
            targetNodeId,
            targetInputIndex,
            dataType
        ] = rawLink;

        const sourceNode = nodeMap.get(Number(sourceNodeId));
        const targetNode = nodeMap.get(Number(targetNodeId));

        const targetInput =
            Array.isArray(targetNode?.inputs) && targetNode.inputs[targetInputIndex]
                ? targetNode.inputs[targetInputIndex]
                : null;

        const sourceOutput =
            Array.isArray(sourceNode?.outputs) && sourceNode.outputs[sourceOutputIndex]
                ? sourceNode.outputs[sourceOutputIndex]
                : null;

        const edge = {
            linkId,
            sourceNodeId: Number(sourceNodeId),
            sourceOutputIndex: Number(sourceOutputIndex),
            sourceOutputName: sourceOutput?.name || null,
            targetNodeId: Number(targetNodeId),
            targetInputIndex: Number(targetInputIndex),
            targetInputName: targetInput?.name || null,
            dataType
        };

        if (!outgoingMap.has(edge.sourceNodeId)) {
            outgoingMap.set(edge.sourceNodeId, []);
        }

        if (!incomingMap.has(edge.targetNodeId)) {
            incomingMap.set(edge.targetNodeId, []);
        }

        outgoingMap.get(edge.sourceNodeId).push(edge);
        incomingMap.get(edge.targetNodeId).push(edge);
    }

    return {
        workflowJson,
        nodeMap,
        outgoingMap,
        incomingMap
    };
}

function getNode(graph, nodeId) {
    return graph.nodeMap.get(Number(nodeId)) || null;
}

function getOutgoingEdges(graph, nodeId) {
    return graph.outgoingMap.get(Number(nodeId)) || [];
}

function getIncomingEdges(graph, nodeId) {
    return graph.incomingMap.get(Number(nodeId)) || [];
}

function getDirectInputSource(graph, targetNodeId, targetInputName) {
    const incoming = getIncomingEdges(graph, targetNodeId);
    const match = incoming.find((edge) => edge.targetInputName === targetInputName);

    if (!match) {
        return null;
    }

    return {
        edge: match,
        sourceNode: getNode(graph, match.sourceNodeId)
    };
}

function hasDownstreamNodeType(graph, startNodeId, targetNodeType) {
    const visited = new Set();
    const queue = [Number(startNodeId)];

    while (queue.length > 0) {
        const currentId = queue.shift();

        if (visited.has(currentId)) {
            continue;
        }

        visited.add(currentId);

        const outgoing = getOutgoingEdges(graph, currentId);

        for (const edge of outgoing) {
            const nextNode = getNode(graph, edge.targetNodeId);

            if (!nextNode) {
                continue;
            }

            if (nextNode.type === targetNodeType) {
                return true;
            }

            if (!visited.has(nextNode.id)) {
                queue.push(Number(nextNode.id));
            }
        }
    }

    return false;
}

function getDownstreamNodesByType(graph, startNodeId, targetNodeType) {
    const visited = new Set();
    const queue = [Number(startNodeId)];
    const matches = [];

    while (queue.length > 0) {
        const currentId = queue.shift();

        if (visited.has(currentId)) {
            continue;
        }

        visited.add(currentId);

        const outgoing = getOutgoingEdges(graph, currentId);

        for (const edge of outgoing) {
            const nextNode = getNode(graph, edge.targetNodeId);

            if (!nextNode) {
                continue;
            }

            if (nextNode.type === targetNodeType) {
                matches.push(nextNode);
            }

            if (!visited.has(nextNode.id)) {
                queue.push(Number(nextNode.id));
            }
        }
    }

    return matches;
}

module.exports = {
    buildWorkflowGraph,
    getNode,
    getOutgoingEdges,
    getIncomingEdges,
    getDirectInputSource,
    hasDownstreamNodeType,
    getDownstreamNodesByType
};