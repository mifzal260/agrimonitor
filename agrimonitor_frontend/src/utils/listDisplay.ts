export const INITIAL_VISIBLE_LIST_COUNT = 8;

export function getVisibleListItems<T>(items: T[], visibleCount = INITIAL_VISIBLE_LIST_COUNT) {
  return items.slice(0, Math.max(0, visibleCount));
}

export function hasHiddenListItems(totalItems: number, visibleCount = INITIAL_VISIBLE_LIST_COUNT) {
  return totalItems > visibleCount;
}

export function nextVisibleListCount(totalItems: number, visibleCount = INITIAL_VISIBLE_LIST_COUNT) {
  if (!hasHiddenListItems(totalItems, visibleCount)) return INITIAL_VISIBLE_LIST_COUNT;
  return Math.min(totalItems, visibleCount + INITIAL_VISIBLE_LIST_COUNT);
}
