import { useTranslation } from "react-i18next";

import { formatDateLong } from "../../utils/localeFormat";
import { PriceSummaryStats } from "./PriceSummaryStats";
import type { PriceSummary } from "./priceTrendUtils";

export function DailyPriceSummary({ summary, onViewAll }: { summary: PriceSummary; onViewAll: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("marketPrice.dailySummary")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("marketPrice.dailySummaryDescription")}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {summary.updatedCommodityCount} {t("marketPrice.updatedCommodities")}{summary.latestDate ? " · " + formatDateLong(summary.latestDate) : ""}
          </p>
        </div>
        <button className="rounded-md border border-field-700 px-3 py-2 text-sm font-semibold text-field-700 hover:bg-field-50 focus:outline-none focus:ring-2 focus:ring-field-700 focus:ring-offset-2" type="button" onClick={onViewAll}>
          {t("marketPrice.viewAllPrices")}
        </button>
      </div>
      <div className="mt-4"><PriceSummaryStats summary={summary} /></div>
    </section>
  );
}

