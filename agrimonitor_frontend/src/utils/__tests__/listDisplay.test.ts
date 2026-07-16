import { describe, expect, it } from "vitest";

import { INITIAL_VISIBLE_LIST_COUNT, getVisibleListItems, hasHiddenListItems, nextVisibleListCount } from "../listDisplay";

describe("listDisplay", () => {
  const records = Array.from({ length: 17 }, (_, index) => index + 1);

  it.each([
    [0, 0, false],
    [1, 1, false],
    [8, 8, false],
    [9, 8, true],
    [16, 8, true],
    [17, 8, true],
  ])("starts with a safe visible count for %s records", (total, expectedVisible, expectedHidden) => {
    const sample = records.slice(0, total);
    expect(getVisibleListItems(sample)).toHaveLength(expectedVisible);
    expect(hasHiddenListItems(sample.length)).toBe(expectedHidden);
  });

  it("shows the initial visible window without losing later records", () => {
    expect(getVisibleListItems(records)).toEqual(records.slice(0, INITIAL_VISIBLE_LIST_COUNT));
    expect(hasHiddenListItems(records.length)).toBe(true);
  });

  it("expands by the initial window size until all records are accessible", () => {
    const secondWindow = nextVisibleListCount(records.length, INITIAL_VISIBLE_LIST_COUNT);
    expect(secondWindow).toBe(16);
    expect(getVisibleListItems(records, secondWindow)).toEqual(records.slice(0, 16));

    const finalWindow = nextVisibleListCount(records.length, secondWindow);
    expect(finalWindow).toBe(17);
    expect(getVisibleListItems(records, finalWindow)).toEqual(records);
  });

  it("resets back to the initial count when there are no hidden records", () => {
    expect(nextVisibleListCount(records.length, 17)).toBe(INITIAL_VISIBLE_LIST_COUNT);
  });
});
