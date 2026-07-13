import { useTranslation } from "react-i18next";

import type { PriceSummary } from "./priceTrendUtils";

export function PriceSummaryStats({ summary }: { summary: PriceSummary }) {
  const { t } = useTranslation();
  const stats = [
    { label: t("status.up"), value: summary.stats.up, className: "text-emerald-700" },
    { label: t("status.down"), value: summary.stats.down, className: "text-amber-700" },
    { label: t("status.stable"), value: summary.stats.stable, className: "text-sky-700" },
    { label: t("dashboard.updatedOn"), value: summary.updatedCommodityCount, className: "text-field-700" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {stats.map((stat) => (
        <div className="rounded-lg border border-field-100 bg-field-50 px-3 py-3" key={stat.label}>
          <dt className="text-xs font-medium text-slate-600">{stat.label}</dt>
          <dd className={`mt-1 text-xl font-bold ${stat.className}`}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
