import type { MarketPrice } from "../../types/marketPrice";

export type CommodityPriceChartRow = {
  date: string;
  commodity: string;
  farm: number | null;
  wholesale: number | null;
  retail: number | null;
};

export function getCommodityOptions(records: MarketPrice[]) {
  const latestByCommodity = new Map<string, string>();

  records.forEach((record) => {
    const currentLatest = latestByCommodity.get(record.commodity_name);
    if (!currentLatest || record.recorded_date > currentLatest) {
      latestByCommodity.set(record.commodity_name, record.recorded_date);
    }
  });

  return Array.from(latestByCommodity.entries())
    .sort((left, right) => right[1].localeCompare(left[1]) || left[0].localeCompare(right[0], "ms"))
    .map(([commodity]) => commodity);
}

export function getDefaultCommodity(records: MarketPrice[]) {
  return getCommodityOptions(records)[0] ?? "";
}

export function buildCommodityPriceChartData(records: MarketPrice[], commodity: string) {
  const rows = new Map<string, CommodityPriceChartRow>();

  records
    .filter((record) => record.commodity_name === commodity && isChartPriceType(record.price_type))
    .forEach((record) => {
      if (!isChartPriceType(record.price_type)) return;

      const row = rows.get(record.recorded_date) ?? {
        date: record.recorded_date,
        commodity: record.commodity_name,
        farm: null,
        wholesale: null,
        retail: null,
      };
      const price = Number(record.price);
      if (Number.isFinite(price)) {
        row[record.price_type] = price;
      }
      rows.set(record.recorded_date, row);
    });

  return Array.from(rows.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function isChartPriceType(value: string): value is "farm" | "wholesale" | "retail" {
  return value === "farm" || value === "wholesale" || value === "retail";
}
