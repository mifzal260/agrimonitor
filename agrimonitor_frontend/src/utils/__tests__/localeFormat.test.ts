import { describe, expect, it } from "vitest";

import i18n from "../../i18n";
import { formatCurrency, formatDateLong, formatDateShort, formatPricePerUnit, toFiniteNumber } from "../localeFormat";

describe("localeFormat", () => {
  it.each([
    [100, 100],
    ["100", 100],
    ["100.50", 100.5],
    [0, 0],
    ["0", 0],
  ])("parses valid numeric input %s", (input, expected) => {
    expect(toFiniteNumber(input)).toBe(expected);
  });

  it.each([null, undefined, "", "   ", "abc", Number.NaN, Infinity, -Infinity])("rejects unavailable or invalid input %s", (input) => {
    expect(toFiniteNumber(input)).toBeNull();
    expect(formatCurrency(input as string | number | null | undefined)).toBe("—");
  });

  it.each([
    [0, "RM 0.00"],
    [10, "RM 10.00"],
    [10.5, "RM 10.50"],
    [1000, "RM 1,000.00"],
    [-20, "-RM 20.00"],
  ])("formats currency value %s consistently", (input, expected) => {
    expect(formatCurrency(input)).toBe(expected);
  });

  it.each(["", "abc", Number.NaN, null, undefined])("does not produce RM NaN for invalid currency %s", (input) => {
    expect(formatCurrency(input as string | number | null | undefined)).toBe("—");
  });

  it.each([
    ["kg", "RM 4.50 / kg"],
    ["bakul", "RM 4.50 / bakul"],
    ["ikat", "RM 4.50 / ikat"],
    ["100 biji", "RM 4.50 / 100 biji"],
    ["", "RM 4.50"],
  ])("does not force kg for unit %s", (unit, expected) => {
    expect(formatPricePerUnit(4.5, unit)).toBe(expected);
  });

  it("formats Malay date-only values without shifting the calendar day", async () => {
    await i18n.changeLanguage("ms");
    expect(formatDateShort("2026-07-15")).toBe("15 Jul");
    expect(formatDateLong("2026-01-01")).toBe("1 Januari 2026");
    expect(formatDateShort("2024-02-29")).toBe("29 Feb");
  });

  it("formats English long dates through the shared locale helper", async () => {
    await i18n.changeLanguage("en");
    expect(formatDateShort("2026-07-15")).toBe("15 Jul");
    expect(formatDateLong("2026-01-01")).toBe("1 January 2026");
  });

  it("formats ISO timestamps with timezone information", async () => {
    await i18n.changeLanguage("ms");
    expect(formatDateShort("2026-07-15T08:30:00Z")).toBe("15 Jul");
    expect(formatDateLong("2026-07-15T08:30:00+08:00")).toBe("15 Julai 2026");

    await i18n.changeLanguage("en");
    expect(formatDateShort("2026-07-15T08:30:00Z")).toBe("15 Jul");
    expect(formatDateLong("2026-07-15T08:30:00+08:00")).toBe("15 July 2026");
  });

  it.each([null, undefined, "", "not-a-date", "2026-99-99"])("uses unavailable fallback for invalid date %s", (input) => {
    expect(formatDateShort(input)).toBe("—");
    expect(formatDateLong(input)).toBe("—");
  });
});
