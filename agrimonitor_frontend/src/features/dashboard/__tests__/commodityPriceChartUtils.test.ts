import { describe, expect, it } from "vitest";

import { buildCommodityPriceChartData, getDefaultCommodity } from "../commodityPriceChartUtils";
import type { MarketPrice } from "../../../types/marketPrice";

function price(overrides: Partial<MarketPrice>): MarketPrice {
  return {
    id: 1,
    crop_id: null,
    commodity_name: "Cili Hijau",
    location: "Malaysia",
    price_type: "retail",
    price: "10.00",
    unit: "kg",
    recorded_date: "2026-07-01",
    trend: "stable",
    ...overrides,
  };
}

describe("commodity price chart utils", () => {
  it("selects records deterministically when input order is reversed", () => {
    const records = [
      price({ id: 1, recorded_date: "2026-07-01", price_type: "retail", price: "10" }),
      price({ id: 3, recorded_date: "2026-07-02", price_type: "retail", price: "13" }),
      price({ id: 2, recorded_date: "2026-07-02", price_type: "retail", price: "12" }),
      price({ id: 4, recorded_date: "bad-date", price_type: "retail", price: "99" }),
    ];

    const key = getDefaultCommodity(records);
    const forward = buildCommodityPriceChartData(records, key);
    const reversed = buildCommodityPriceChartData([...records].reverse(), key);

    expect(forward).toEqual(reversed);
    expect(forward.find((row) => row.date === "2026-07-02")?.retail).toBe(13);
  });

  it("does not mix locations in the selected commodity chart", () => {
    const records = [
      price({ id: 1, commodity_name: "Tomato", location: "Kedah", price_type: "retail", price: "4" }),
      price({ id: 2, commodity_name: "Tomato", location: "Perak", price_type: "retail", price: "8" }),
    ];

    const kedah = buildCommodityPriceChartData(records, "tomato|kedah");
    expect(kedah).toHaveLength(1);
    expect(kedah[0].retail).toBe(4);
  });
});
