import { apiRequest } from "./client";
import type { Alert, RecommendationResult } from "../types/recommendation";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function evaluatePlantingRecord(token: string, plantingRecordId: number) {
  return apiRequest<RecommendationResult>(`/recommendations/planting-records/${plantingRecordId}/evaluate`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function listAlerts(token: string) {
  return apiRequest<Alert[]>("/recommendations/alerts", {
    headers: authHeaders(token),
  });
}