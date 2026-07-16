import { apiRequest } from "./client";
import type { CsvImportResult, MarketPrice } from "../types/marketPrice";

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

export function listMarketPrices(_token: string, filters: MarketPriceFilters = {}) {
  return apiRequest<MarketPrice[]>(`/market-prices${toQueryString(filters)}`);
}

export function listLatestMarketPrices(_token: string) {
  return apiRequest<MarketPrice[]>("/market-prices/latest");
}

export function createMarketPrice(_token: string, payload: MarketPricePayload) {
  return apiRequest<MarketPrice>("/market-prices", {
    method: "POST",
    body: JSON.stringify({ ...payload, crop_id: payload.crop_id ?? null }),
  });
}

export async function importMarketPricesCsv(_token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<CsvImportResult>("/market-prices/import-csv", {
    method: "POST",
    body: formData,
  });
}
