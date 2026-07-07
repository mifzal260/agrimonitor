import { apiRequest } from "./client";
import type { CsvImportResult, MarketPrice } from "../types/marketPrice";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type MarketPriceFilters = {
  commodity_name?: string;
  location?: string;
  price_type?: string;
  date_from?: string;
  date_to?: string;
};

export type MarketPricePayload = {
  crop_id?: number | null;
  commodity_name: string;
  location: string;
  price_type: string;
  price: string;
  unit: string;
  recorded_date: string;
  trend: string;
};

function toQueryString(filters: MarketPriceFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listMarketPrices(token: string, filters: MarketPriceFilters = {}) {
  return apiRequest<MarketPrice[]>(`/market-prices${toQueryString(filters)}`, { headers: authHeaders(token) });
}

export function listLatestMarketPrices(token: string) {
  return apiRequest<MarketPrice[]>("/market-prices/latest", { headers: authHeaders(token) });
}

export function createMarketPrice(token: string, payload: MarketPricePayload) {
  return apiRequest<MarketPrice>("/market-prices", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...payload, crop_id: payload.crop_id ?? null }),
  });
}

export async function importMarketPricesCsv(token: string, file: File) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (window.location.hostname.includes("onrender.com") ? "https://agrimonitor-backend.onrender.com/api/v1" : "http://localhost:8000/api/v1");
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${apiBaseUrl}/market-prices/import-csv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(typeof errorBody?.detail === "string" ? errorBody.detail : "CSV import failed");
  }
  return response.json() as Promise<CsvImportResult>;
}