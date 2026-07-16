import { apiRequest } from "./client";
import type { Cost, Harvest, ProfitLossSummary } from "../types/finance";

export function getFinanceSummary(_token: string) {
  return apiRequest<ProfitLossSummary>("/finance/summary");
}

export function listCosts(_token: string) {
  return apiRequest<Cost[]>("/finance/costs");
}

export function createCost(_token: string, payload: { planting_record_id: number; cost_type: string; amount: string; cost_date: string; notes?: string }) {
  return apiRequest<Cost>("/finance/costs", {
    method: "POST",
    body: JSON.stringify({ ...payload, notes: payload.notes || null }),
  });
}

export function listHarvests(_token: string) {
  return apiRequest<Harvest[]>("/finance/harvests");
}

export function createHarvest(_token: string, payload: { planting_record_id: number; harvest_date: string; quantity: string; unit: string; selling_price_per_unit: string; notes?: string }) {
  return apiRequest<Harvest>("/finance/harvests", {
    method: "POST",
    body: JSON.stringify({ ...payload, notes: payload.notes || null }),
  });
}

export function updateHarvest(_token: string, harvestId: number, payload: { harvest_date?: string; quantity?: string; unit?: string; selling_price_per_unit?: string; notes?: string }) {
  return apiRequest<Harvest>(`/finance/harvests/${harvestId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, notes: payload.notes || null }),
  });
}

export function deleteHarvest(_token: string, harvestId: number) {
  return apiRequest<null>(`/finance/harvests/${harvestId}`, {
    method: "DELETE",
  });
}

