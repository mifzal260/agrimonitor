import { describe, expect, it } from "vitest";

import { buildCommodityPriceGroups } from "../priceTrendUtils";
import type { MarketPrice } from "../../../types/marketPrice";

function price(overrides: Partial<MarketPrice>): MarketPrice {
  return {
    id: 1,
    crop_id: null,
    commodity_name: "Cili Hijau",
    location: "Kedah",
    price_type: "retail",
    price: "10.00",
    unit: "kg",
    recorded_date: "2026-07-01",
    trend: "stable",
    ...overrides,
  };
}

describe("market price grouping", () => {
  it("groups by commodity name and location without mixing locations", () => {
    const groups = buildCommodityPriceGroups([
      price({ id: 1, commodity_name: "Cili Hijau", location: "Kedah", price_type: "retail", price: "10" }),
      price({ id: 2, commodity_name: "Cili Hijau", location: "Perak", price_type: "retail", price: "12" }),
      price({ id: 3, commodity_name: "Tomato", location: "Kedah", price_type: "retail", price: "8" }),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.displayName).sort()).toEqual([
      "Cili Hijau - Kedah",
      "Cili Hijau - Perak",
      "Tomato - Kedah",
    ]);
  });

  it("normalizes whitespace and case for commodity/location keys", () => {
    const groups = buildCommodityPriceGroups([
      price({ id: 1, commodity_name: " CILI   HIJAU ", location: " Kedah ", price_type: "farm", price: "6" }),
      price({ id: 2, commodity_name: "cili hijau", location: "kedah", price_type: "wholesale", price: "8" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].levels.farm?.current.price).toBe("6");
    expect(groups[0].levels.wholesale?.current.price).toBe("8");
  });

  it("keeps empty location in its own explicit group", () => {
    const groups = buildCommodityPriceGroups([
      price({ id: 1, location: "", price_type: "retail", price: "9" }),
      price({ id: 2, location: "Kedah", price_type: "retail", price: "10" }),
    ]);

    expect(groups.map((group) => group.locationLabel)).toContain("Lokasi tidak dinyatakan");
    expect(groups).toHaveLength(2);
  });
});
