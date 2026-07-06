import { apiRequest } from "./client";
import type { Cost, Harvest, ProfitLossSummary } from "../types/finance";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function getFinanceSummary(token: string) {
  return apiRequest<ProfitLossSummary>("/finance/summary", { headers: authHeaders(token) });
}

export function listCosts(token: string) {
  return apiRequest<Cost[]>("/finance/costs", { headers: authHeaders(token) });
}

export function createCost(token: string, payload: { planting_record_id: number; cost_type: string; amount: string; cost_date: string; notes?: string }) {
  return apiRequest<Cost>("/finance/costs", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...payload, notes: payload.notes || null }),
  });
}

export function listHarvests(token: string) {
  return apiRequest<Harvest[]>("/finance/harvests", { headers: authHeaders(token) });
}

export function createHarvest(token: string, payload: { planting_record_id: number; harvest_date: string; quantity: string; unit: string; selling_price_per_unit: string; notes?: string }) {
  return apiRequest<Harvest>("/finance/harvests", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...payload, notes: payload.notes || null }),
  });
}