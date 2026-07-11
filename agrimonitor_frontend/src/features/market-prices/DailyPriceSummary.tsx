import { PriceSummaryStats } from "./PriceSummaryStats";
import type { PriceSummary } from "./priceTrendUtils";

export function DailyPriceSummary({ summary, onViewAll }: { summary: PriceSummary; onViewAll: () => void }) {
  return (
    <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ringkasan Harga Hari Ini</h2>
          <p className="mt-1 text-sm text-slate-600">Ringkasan perubahan harga berdasarkan data pasaran terkini.</p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {summary.updatedCommodityCount} komoditi dikemas kini{summary.latestDate ? " · " + formatMalayDate(summary.latestDate) : ""}
          </p>
        </div>
        <button className="rounded-md border border-field-700 px-3 py-2 text-sm font-semibold text-field-700 hover:bg-field-50 focus:outline-none focus:ring-2 focus:ring-field-700 focus:ring-offset-2" type="button" onClick={onViewAll}>
          Lihat semua harga
        </button>
      </div>
      <div className="mt-4"><PriceSummaryStats summary={summary} /></div>
    </section>
  );
}

function formatMalayDate(dateValue: string) {
  return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "long", year: "numeric" }).format(new Date(dateValue + "T00:00:00"));
}
