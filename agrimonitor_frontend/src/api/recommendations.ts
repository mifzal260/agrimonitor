import { apiRequest } from "./client";
import type { Alert, RecommendationResult } from "../types/recommendation";

export function evaluatePlantingRecord(_token: string, plantingRecordId: number) {
  return apiRequest<RecommendationResult>(`/recommendations/planting-records/${plantingRecordId}/evaluate`, {
    method: "POST",
  });
}

export function listAlerts(_token: string) {
  return apiRequest<Alert[]>("/recommendations/alerts", {
  });
}
