import { apiRequest } from "./client";
import type { DashboardSummary } from "../types/dashboard";

export function getDashboardSummary(_token: string) {
  return apiRequest<DashboardSummary>("/dashboard/summary");
}

