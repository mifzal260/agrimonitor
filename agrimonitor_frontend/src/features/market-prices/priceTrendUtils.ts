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

export type PriceLevel = "farm" | "wholesale" | "retail";

export type CommodityPriceHistoryRow = {
  date: string;
  levels: Record<PriceLevel, PriceHighlight | null>;
};

export type CommodityPriceGroup = {
  commodityName: string;
  levels: Record<PriceLevel, PriceHighlight | null>;
  latestDate: string;
  history: CommodityPriceHistoryRow[];
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

export function buildCommodityPriceGroups(
  records: MarketPrice[],
  historyRecords: MarketPrice[] = records,
): CommodityPriceGroup[] {
  const historicalSeries = groupByPriceSeries(historyRecords);
  const seriesHighlights = Array.from(groupByPriceSeries(records).entries()).map(([key, currentRecords]) => {
    const current = currentRecords[0];
    const previous = findPreviousRecord(current, historicalSeries.get(key) ?? []);
    return createPriceHighlight(current, previous);
  });
  const commodities = new Map<string, CommodityPriceGroup>();

  seriesHighlights.forEach((highlight) => {
    if (!isPriceLevel(highlight.current.price_type)) return;

    const key = normalizeCommodityName(highlight.current.commodity_name);
    const group = commodities.get(key) ?? {
      commodityName: highlight.current.commodity_name,
      levels: { farm: null, wholesale: null, retail: null },
      latestDate: highlight.current.recorded_date,
      history: [],
    };
    const existingLevel = group.levels[highlight.current.price_type];

    if (!existingLevel || compareDates(highlight.current, existingLevel.current) > 0) {
      group.levels[highlight.current.price_type] = highlight;
    }
    if (highlight.current.recorded_date > group.latestDate) {
      group.latestDate = highlight.current.recorded_date;
    }
    commodities.set(key, group);
  });

  commodities.forEach((group) => {
    group.history = buildCommodityHistory(group, historyRecords, historicalSeries);
  });

  return Array.from(commodities.values()).sort((left, right) =>
    left.commodityName.localeCompare(right.commodityName, "ms"),
  );
}

export function selectPrimaryPrice(group: CommodityPriceGroup, selectedType: string): PriceHighlight | null {
  if (isPriceLevel(selectedType)) {
    return group.levels[selectedType];
  }
  return group.levels.retail ?? group.levels.wholesale ?? group.levels.farm;
}

export function calculateLevelDifference(
  from: PriceHighlight | null,
  to: PriceHighlight | null,
): { amount: number; percent: number | null } | null {
  if (!from || !to) return null;

  const fromPrice = Number(from.current.price);
  const toPrice = Number(to.current.price);
  if (!Number.isFinite(fromPrice) || !Number.isFinite(toPrice)) return null;

  const amount = toPrice - fromPrice;
  return {
    amount,
    percent: fromPrice === 0 ? null : (amount / fromPrice) * 100,
  };
}

function buildCommodityHistory(
  group: CommodityPriceGroup,
  historyRecords: MarketPrice[],
  historicalSeries: Map<string, MarketPrice[]>,
): CommodityPriceHistoryRow[] {
  const rows = new Map<string, CommodityPriceHistoryRow>();

  historyRecords
    .filter((record) =>
      normalizeCommodityName(record.commodity_name) === normalizeCommodityName(group.commodityName)
      && record.recorded_date < group.latestDate
      && isPriceLevel(record.price_type),
    )
    .forEach((record) => {
      if (!isPriceLevel(record.price_type)) return;

      const row = rows.get(record.recorded_date) ?? {
        date: record.recorded_date,
        levels: { farm: null, wholesale: null, retail: null },
      };
      const existing = row.levels[record.price_type];
      if (!existing || record.id > existing.current.id) {
        const previous = findPreviousRecord(record, historicalSeries.get(priceSeriesKey(record)) ?? []);
        row.levels[record.price_type] = createPriceHighlight(record, previous);
      }
      rows.set(record.recorded_date, row);
    });

  return Array.from(rows.values()).sort((left, right) => right.date.localeCompare(left.date));
}

function groupByPriceSeries(records: MarketPrice[]) {
  const grouped = new Map<string, MarketPrice[]>();
  records.forEach((record) => {
    const key = priceSeriesKey(record);
    const group = grouped.get(key) ?? [];
    group.push(record);
    grouped.set(key, group);
  });
  grouped.forEach((group) => group.sort((left, right) => compareDates(right, left)));
  return grouped;
}

function priceSeriesKey(record: MarketPrice) {
  return [record.commodity_name, record.price_type, record.location]
    .map((value) => value.trim().toLocaleLowerCase())
    .join("|");
}

function normalizeCommodityName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function findPreviousRecord(current: MarketPrice, records: MarketPrice[]) {
  return records.find((record) => record.recorded_date < current.recorded_date) ?? null;
}

function toPriceHighlight(records: MarketPrice[]): PriceHighlight {
  const current = records[0];
  return createPriceHighlight(current, findPreviousRecord(current, records));
}

function createPriceHighlight(current: MarketPrice, previous: MarketPrice | null): PriceHighlight {
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

function isPriceLevel(value: string): value is PriceLevel {
  return value === "farm" || value === "wholesale" || value === "retail";
}
