import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { listMarketPrices } from "../../api/marketPrices";
import type { MarketPrice } from "../../types/marketPrice";
import { CommodityPriceAccordionList } from "./CommodityPriceAccordionList";
import { DailyPriceSummary } from "./DailyPriceSummary";
import { buildCommodityPriceGroups, buildPriceSummary } from "./priceTrendUtils";

type MarketPricePageProps = {
  token: string;
};

const emptyFilters = { commodity_name: "", location: "", price_type: "", date_from: "", date_to: "" };

export function MarketPricePage({ token }: MarketPricePageProps) {
  const { t } = useTranslation();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [allPrices, setAllPrices] = useState<MarketPrice[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [appliedPriceType, setAppliedPriceType] = useState("");

  const hasActiveFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);
  const commodityOptions = useMemo(() => uniqueOptions(allPrices.map((price) => price.commodity_name)), [allPrices]);
  const weekOptions = useMemo(() => buildWeekOptions(allPrices.map((price) => price.recorded_date)), [allPrices]);
  const selectedWeekValue = filters.date_from && filters.date_to ? `${filters.date_from}|${filters.date_to}` : "";
  const priceSummary = useMemo(() => buildPriceSummary(allPrices), [allPrices]);
  const commodityGroups = useMemo(() => buildCommodityPriceGroups(prices, allPrices), [allPrices, prices]);

  const loadData = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const priceData = await listMarketPrices(token, emptyFilters);
      setPrices(priceData);
      setAllPrices(priceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("emptyState.noMarketPrices"));
    } finally {
      setIsLoading(false);
    }
  }, [t, token]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsFiltering(true);
    try {
      const priceData = await listMarketPrices(token, { ...filters, price_type: "" });
      setPrices(priceData);
      setAppliedPriceType(filters.price_type);
      setMessage(priceData.length === 0 ? t("emptyState.noMarketPrices") : `${priceData.length} ${t("marketPrice.marketPriceRecords").toLowerCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.updateFailed"));
    } finally {
      setIsFiltering(false);
    }
  }

  async function resetFilters() {
    setFilters(emptyFilters);
    setAppliedPriceType("");
    setError("");
    setMessage("");
    setIsFiltering(true);
    try {
      const priceData = await listMarketPrices(token, emptyFilters);
      setPrices(priceData);
      setAllPrices(priceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.updateFailed"));
    } finally {
      setIsFiltering(false);
    }
  }

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">{t("common.loading")}...</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      <DailyPriceSummary summary={priceSummary} onViewAll={() => document.getElementById("senarai-harga-pasaran")?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      <form onSubmit={applyFilters} className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <PriceTypeButton label={t("common.all")} description={t("marketPrice.allPriceTypes")} value="" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
          <PriceTypeButton label={t("marketPrice.farm")} description={t("marketPrice.farmDescription")} value="farm" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
          <PriceTypeButton label={t("marketPrice.wholesale")} description={t("marketPrice.wholesaleDescription")} value="wholesale" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
          <PriceTypeButton label={t("marketPrice.retail")} description={t("marketPrice.retailDescription")} value="retail" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-field-100 bg-field-50 p-4 md:grid-cols-[1.2fr_1fr_auto]">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("marketPrice.commodity")}</span>
            <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={filters.commodity_name} onChange={(event) => setFilters({ ...filters, commodity_name: event.target.value })}>
              <option value="">{t("marketPrice.allCommodities")}</option>
              {commodityOptions.map((commodity) => <option key={commodity} value={commodity}>{commodity}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("marketPrice.priceWeek")}</span>
            <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={selectedWeekValue} onChange={(event) => {
              const [date_from, date_to] = event.target.value.split("|");
              setFilters({ ...filters, date_from: date_from ?? "", date_to: date_to ?? "", location: "" });
            }}>
              <option value="">{t("marketPrice.allWeeks")}</option>
              {weekOptions.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="neo-button neo-button-primary min-h-10 flex-1 px-4 py-2 text-sm font-semibold disabled:opacity-60 md:min-w-28" type="submit" disabled={isFiltering}>{isFiltering ? t("common.loading") : t("common.filter")}</button>
            <button className="neo-button min-h-10 px-3 py-2 text-sm font-semibold disabled:opacity-60" type="button" disabled={isFiltering || !hasActiveFilters} onClick={resetFilters}>{t("common.reset")}</button>
          </div>
        </div>
      </form>

      <CommodityPriceAccordionList groups={commodityGroups} selectedPriceType={appliedPriceType} />

    </div>
  );
}

function PriceTypeButton({ label, description, value, currentValue, onSelect }: { label: string; description: string; value: string; currentValue: string; onSelect: (value: string) => void }) {
  const isActive = currentValue === value;
  return (
    <button
      className={`neo-tab p-4 text-left transition ${isActive ? "neo-tab-active" : ""}`}
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={isActive}
    >
      <span className="block text-base font-semibold">{label}</span>
      <span className={`mt-1 block text-sm ${isActive ? "text-field-50" : "text-slate-600"}`}>{description}</span>
    </button>
  );
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function buildWeekOptions(dates: string[]) {
  const weekMap = new Map<string, { from: string; to: string }>();

  dates.filter(Boolean).forEach((dateValue) => {
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;

    const day = date.getDay() === 0 ? 7 : date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const from = formatDateInput(monday);
    const to = formatDateInput(sunday);
    weekMap.set(`${from}|${to}`, { from, to });
  });

  return Array.from(weekMap.entries())
    .sort((left, right) => right[1].from.localeCompare(left[1].from))
    .map(([value, week]) => ({ value, label: `${formatDisplayDate(week.from)} - ${formatDisplayDate(week.to)}` }));
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}
