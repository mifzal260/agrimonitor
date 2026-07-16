import type { MarketPrice } from "../types/marketPrice";

const UNKNOWN_LOCATION_KEY = "__location_not_specified__";
const UNKNOWN_LOCATION_LABEL = "Lokasi tidak dinyatakan";

export function normalizeMarketText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeMarketKey(value: string | null | undefined) {
  return normalizeMarketText(value).toLocaleLowerCase();
}

export function marketLocationKey(record: MarketPrice) {
  return normalizeMarketKey(record.location) || UNKNOWN_LOCATION_KEY;
}

export function marketLocationLabel(record: MarketPrice) {
  return normalizeMarketText(record.location) || UNKNOWN_LOCATION_LABEL;
}

export function commodityLocationKey(record: MarketPrice) {
  return [normalizeMarketKey(record.commodity_name), marketLocationKey(record)].join("|");
}

export function commodityLocationLabel(record: MarketPrice) {
  return `${normalizeMarketText(record.commodity_name)} - ${marketLocationLabel(record)}`;
}

export function priceSeriesKey(record: MarketPrice) {
  return [normalizeMarketKey(record.commodity_name), marketLocationKey(record), normalizeMarketKey(record.price_type)].join("|");
}

export function compareMarketPriceRecords(left: MarketPrice, right: MarketPrice) {
  const dateComparison = left.recorded_date.localeCompare(right.recorded_date);
  if (dateComparison !== 0) return dateComparison;
  return left.id - right.id;
}