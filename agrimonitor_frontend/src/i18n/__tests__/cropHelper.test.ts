import { describe, expect, it } from "vitest";

import en from "../locales/en.json";
import ms from "../locales/ms.json";

describe("custom crop helper localization", () => {
  it("explains that a custom crop name is stored only on its planting record", () => {
    expect(ms.cropMonitoring.otherCropHelp).toContain("rekod tanaman ini");
    expect(ms.cropMonitoring.otherCropHelp).toContain("tidak ditambah ke katalog bersama");
    expect(en.cropMonitoring.otherCropHelp).toContain("only on this planting record");
    expect(en.cropMonitoring.otherCropHelp).toContain("not added to the shared catalog");
  });
});
