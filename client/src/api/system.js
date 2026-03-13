import React from "react";
import { apiFetch } from "./client";

export function fetchSystemStatus() {
  return apiFetch("/api/system/status");
}