import type { MarketPrice } from "../../types/marketPrice";
import { toFiniteNumber } from "../../utils/localeFormat";
import {
  commodityLocationKey,
  commodityLocationLabel,
  compareMarketPriceRecords,
} from "../../utils/marketPriceData";

export type CommodityPriceOption = {
  key: string;
  label: string;
};

export type CommodityPriceChartRow = {
  date: string;
  commodity: string;
  farm: number | null;
  wholesale: number | null;
  retail: number | null;
  farmUnit: string | null;
  wholesaleUnit: string | null;
  retailUnit: string | null;
};

export function getCommodityOptions(records: MarketPrice[]): CommodityPriceOption[] {
  const latestByGroup = new Map<string, { label: string; latestDate: string }>();

  records.forEach((record) => {
    const key = commodityLocationKey(record);
    const currentLatest = latestByGroup.get(key);
    if (!currentLatest || compareMarketPriceRecords(record, { ...record, recorded_date: currentLatest.latestDate, id: 0 }) > 0) {
      latestByGroup.set(key, { label: commodityLocationLabel(record), latestDate: record.recorded_date });
    }
  });

  return Array.from(latestByGroup.entries())
    .sort((left, right) => right[1].latestDate.localeCompare(left[1].latestDate) || left[1].label.localeCompare(right[1].label, "ms"))
    .map(([key, value]) => ({ key, label: value.label }));
}

export function getDefaultCommodity(records: MarketPrice[]) {
  return getCommodityOptions(records)[0]?.key ?? "";
}

export function buildCommodityPriceChartData(records: MarketPrice[], commodityLocation: string) {
  const rows = new Map<string, CommodityPriceChartRow>();
  const selectedRecords = new Map<string, MarketPrice>();

  records
    .filter((record) => commodityLocationKey(record) === commodityLocation && isChartPriceType(record.price_type))
    .forEach((record) => {
      if (!isChartPriceType(record.price_type)) return;
      const key = [record.recorded_date, record.price_type].join("|");
      const existing = selectedRecords.get(key);
      if (!existing || compareMarketPriceRecords(record, existing) > 0) {
        selectedRecords.set(key, record);
      }
    });

  selectedRecords.forEach((record) => {
    if (!isChartPriceType(record.price_type)) return;

    const row = rows.get(record.recorded_date) ?? {
      date: record.recorded_date,
      commodity: commodityLocationLabel(record),
      farm: null,
      wholesale: null,
      retail: null,
      farmUnit: null,
      wholesaleUnit: null,
      retailUnit: null,
    };
    const price = toFiniteNumber(record.price);
    if (price !== null) {
      row[record.price_type] = price;
      row[`${record.price_type}Unit`] = record.unit || null;
    }
    rows.set(record.recorded_date, row);
  });

  return Array.from(rows.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function isChartPriceType(value: string): value is "farm" | "wholesale" | "retail" {
  return value === "farm" || value === "wholesale" || value === "retail";
}


