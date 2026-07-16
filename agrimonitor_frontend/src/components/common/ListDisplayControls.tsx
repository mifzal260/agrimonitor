import { useTranslation } from "react-i18next";

import { INITIAL_VISIBLE_LIST_COUNT, hasHiddenListItems, nextVisibleListCount } from "../../utils/listDisplay";

type ListDisplayControlsProps = {
  totalItems: number;
  visibleCount: number;
  onVisibleCountChange: (count: number) => void;
};

export function ListDisplayControls({ totalItems, visibleCount, onVisibleCountChange }: ListDisplayControlsProps) {
  const { t } = useTranslation();

  if (totalItems <= INITIAL_VISIBLE_LIST_COUNT) return null;

  const shownCount = Math.min(totalItems, visibleCount);
  const hasMore = hasHiddenListItems(totalItems, visibleCount);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
      <p className="text-xs text-slate-500">{t("common.showingCount", { shown: shownCount, total: totalItems })}</p>
      <button
        className="neo-button rounded-xl border border-field-100 px-3 py-2 text-xs font-semibold text-field-800 focus:outline-none focus:ring-2 focus:ring-field-300"
        type="button"
        onClick={() => onVisibleCountChange(hasMore ? nextVisibleListCount(totalItems, visibleCount) : INITIAL_VISIBLE_LIST_COUNT)}
      >
        {hasMore ? t("common.showMore") : t("common.showLess")}
      </button>
    </div>
  );
}
