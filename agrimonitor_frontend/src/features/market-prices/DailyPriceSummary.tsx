import { useTranslation } from "react-i18next";

import { formatDateLong } from "../../utils/localeFormat";
import { PriceSummaryStats } from "./PriceSummaryStats";
import type { PriceSummary } from "./priceTrendUtils";

export function DailyPriceSummary({ summary, onViewAll }: { summary: PriceSummary; onViewAll: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="soft-glass-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("marketPrice.dailySummary")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("marketPrice.dailySummaryDescription")}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {summary.updatedCommodityCount} {t("marketPrice.updatedCommodities")}{summary.latestDate ? " · " + formatDateLong(summary.latestDate) : ""}
          </p>
        </div>
        <button className="neo-button px-3 py-2 text-sm font-semibold focus:outline-none" type="button" onClick={onViewAll}>
          {t("marketPrice.viewAllPrices")}
        </button>
      </div>
      <div className="mt-4"><PriceSummaryStats summary={summary} /></div>
    </section>
  );
}



