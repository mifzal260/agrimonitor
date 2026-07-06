import { apiRequest } from "./client";
import type { DashboardSummary } from "../types/dashboard";

export function getDashboardSummary(token: string) {
  return apiRequest<DashboardSummary>("/dashboard/summary", {
    headers: { Authorization: `Bearer ${token}` },
  });
}