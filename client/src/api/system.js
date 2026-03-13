import React from "react";
import { apiFetch } from "./client";

export function fetchSystemStatus() {
  return apiFetch("/api/system/status");
}

export function startComfyUi() {
  return apiFetch("/api/system/comfyui/start", {
    method: "POST"
  });
}

export function stopComfyUi() {
  return apiFetch("/api/system/comfyui/stop", {
    method: "POST"
  });
}