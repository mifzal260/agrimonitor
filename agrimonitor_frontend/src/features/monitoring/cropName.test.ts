import { describe, expect, it } from "vitest";

import { capitalizeCropWords, isSelectableCropName } from "./cropName";

describe("capitalizeCropWords", () => {
  it("capitalizes the first letter of each word", () => {
    expect(capitalizeCropWords("buah naga")).toBe("Buah Naga");
  });

  it("capitalizes words separated by hyphens and preserves other letters", () => {
    expect(capitalizeCropWords("pokok cili-merah")).toBe("Pokok Cili-Merah");
  });

  it("supports Unicode letters", () => {
    expect(capitalizeCropWords("café arabica")).toBe("Café Arabica");
  });

  it("excludes Nenas from the planting crop options regardless of casing", () => {
    expect(isSelectableCropName("Nenas")).toBe(false);
    expect(isSelectableCropName(" nEnAs ")).toBe(false);
    expect(isSelectableCropName("Nanas")).toBe(true);
  });
});
