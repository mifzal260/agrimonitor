import { describe, expect, it } from "vitest";

import { capitalizeSymptomWords, getSymptomRecordName } from "./symptomName";

describe("symptom record name", () => {
  it("uses the custom symptom name when there is no catalog symptom", () => {
    expect(getSymptomRecordName({ custom_symptom_name: "Leaf Blight", symptom: null })).toBe("Leaf Blight");
  });

  it("preserves catalog symptom names for existing records", () => {
    expect(getSymptomRecordName({
      custom_symptom_name: null,
      symptom: { id: 1, name: "Yellow leaves", description: null },
    })).toBe("Yellow leaves");
  });

  it("capitalizes each word in custom symptom names", () => {
    expect(capitalizeSymptomWords("leaf blight")).toBe("Leaf Blight");
  });
});
