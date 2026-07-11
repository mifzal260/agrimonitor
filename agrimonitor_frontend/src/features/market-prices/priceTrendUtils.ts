import type { MarketPrice } from "../../types/marketPrice";

export type CalculatedTrend = "up" | "down" | "stable" | "unavailable";

export type PriceHighlight = {
  current: MarketPrice;
  previous: MarketPrice | null;
  changeAmount: number | null;
  changePercent: number | null;
  trend: CalculatedTrend;
};

export type PriceSummary = {
  highlights: PriceHighlight[];
  updatedCommodityCount: number;
  latestDate: string | null;
  stats: Record<"up" | "down" | "stable", number>;
};

export function buildPriceSummary(records: MarketPrice[], limit = 6): PriceSummary {
  const grouped = groupByPriceSeries(records);
  const latest = Array.from(grouped.values()).map(toPriceHighlight);
  const comparable = latest.filter((item) => item.changeAmount !== null);
  const rankedComparable = [...comparable].sort(compareHighlights);
  const rankedFallback = latest
    .filter((item) => item.changeAmount === null)
    .sort((left, right) => compareDates(right.current, left.current));
  const highlights = [...rankedComparable, ...rankedFallback].slice(0, limit);
  const latestDate = latest.reduce<string | null>(
    (currentLatest, item) => !currentLatest || item.current.recorded_date > currentLatest ? item.current.recorded_date : currentLatest,
    null,
  );

  return {
    highlights,
    updatedCommodityCount: new Set(latest.map((item) => item.current.commodity_name)).size,
    latestDate,
    stats: {
      up: comparable.filter((item) => item.trend === "up").length,
      down: comparable.filter((item) => item.trend === "down").length,
      stable: comparable.filter((item) => item.trend === "stable").length,
    },
  };
}

function groupByPriceSeries(records: MarketPrice[]) {
  const grouped = new Map<string, MarketPrice[]>();
  records.forEach((record) => {
    const key = [record.commodity_name, record.price_type, record.location]
      .map((value) => value.trim().toLocaleLowerCase())
      .join("|");
    const group = grouped.get(key) ?? [];
    group.push(record);
    grouped.set(key, group);
  });
  grouped.forEach((group) => group.sort((left, right) => compareDates(right, left)));
  return grouped;
}

function toPriceHighlight(records: MarketPrice[]): PriceHighlight {
  const current = records[0];
  const previous = records.find((record) => record.recorded_date < current.recorded_date) ?? null;
  if (!previous) return { current, previous, changeAmount: null, changePercent: null, trend: "unavailable" };

  const currentPrice = Number(current.price);
  const previousPrice = Number(previous.price);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice)) {
    return { current, previous, changeAmount: null, changePercent: null, trend: "unavailable" };
  }

  const changeAmount = currentPrice - previousPrice;
  const changePercent = previousPrice === 0 ? null : (changeAmount / previousPrice) * 100;
  const trend: CalculatedTrend = changeAmount > 0 ? "up" : changeAmount < 0 ? "down" : "stable";
  return { current, previous, changeAmount, changePercent, trend };
}

function compareHighlights(left: PriceHighlight, right: PriceHighlight) {
  return Math.abs(right.changeAmount ?? 0) - Math.abs(left.changeAmount ?? 0) || compareDates(right.current, left.current);
}

function compareDates(left: MarketPrice, right: MarketPrice) {
  return left.recorded_date.localeCompare(right.recorded_date) || left.id - right.id;
}
