import { apiFetch } from "./client";

export async function fetchCheckpointModels() {
    const data = await apiFetch("/api/comfy/checkpoints");
    return data.models || [];
}