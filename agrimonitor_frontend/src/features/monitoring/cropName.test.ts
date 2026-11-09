import { describe, expect, it } from "vitest";

import { capitalizeCropWords, getPlantingCropName, isSelectableCropName } from "./cropName";

describe("capitalizeCropWords", () => {
  it("capitalizes the first letter of each word", () => {
    expect(capitalizeCropWords("buah naga")).toBe("Buah Naga");
  });

  describe("getPlantingCropName", () => {
    it("uses the custom name instead of a catalog entry", () => {
      expect(getPlantingCropName({ custom_crop_name: "Dragon Fruit", crop: null })).toBe("Dragon Fruit");
    });

    it("uses the catalog name for existing planting records", () => {
      expect(getPlantingCropName({ custom_crop_name: null, crop: { id: 1, name: "Tomato", variety: null, description: null, expected_harvest_days: null } })).toBe("Tomato");
    });
  });

  it("capitalizes words separated by hyphens and preserves other letters", () => {
    expect(capitalizeCropWords("pokok cili-merah")).toBe("Pokok Cili-Merah");
  });

  it("supports Unicode letters", () => {
    expect(capitalizeCropWords("café arabica")).toBe("Café Arabica");
  });

  it("excludes both pineapple spellings regardless of casing", () => {
    expect(isSelectableCropName("Nanas")).toBe(false);
    expect(isSelectableCropName(" nAnAs ")).toBe(false);
    expect(isSelectableCropName("Nenas")).toBe(false);
    expect(isSelectableCropName(" nEnAs ")).toBe(false);
    expect(isSelectableCropName("Timun")).toBe(true);
  });
});
