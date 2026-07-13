import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDashboardSummary } from "../../api/dashboard";
import { listMarketPrices } from "../../api/marketPrices";
import { listPlantingRecords, listSymptomRecords } from "../../api/monitoring";
import { StatusBadge } from "../../components/StatusBadge";
import type { DashboardSummary } from "../../types/dashboard";
import type { MarketPrice } from "../../types/marketPrice";
import type { PlantingRecord, SymptomRecord } from "../../types/monitoring";
import { formatCurrency, formatDateLong, formatPercent } from "../../utils/localeFormat";
import { CommodityPriceTrend } from "./CommodityPriceTrend";

type DashboardPageProps = {
  token: string;
};

function statusTone(status: string): "success" | "warning" | "danger" {
  if (status === "risk") return "danger";
  if (status === "watch") return "warning";
  return "success";
}

export function DashboardPage({ token }: DashboardPageProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [records, setRecords] = useState<PlantingRecord[]>([]);
  const [symptomRecords, setSymptomRecords] = useState<SymptomRecord[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardSummary(token), listPlantingRecords(token), listSymptomRecords(token), listMarketPrices(token)])
      .then(([summaryData, recordData, symptomData, marketPriceData]) => {
        setSummary(summaryData);
        setRecords(recordData);
        setSymptomRecords(symptomData);
        setMarketPrices(marketPriceData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("notifications.saveFailed")))
      .finally(() => setIsLoading(false));
  }, [token, t]);

  const plotMonitoring = useMemo(() => {
    return records.map((record) => {
      const activeSymptoms = symptomRecords.filter((symptom) => symptom.planting_record_id === record.id && symptom.status !== "resolved");
      const latestActiveSymptom = activeSymptoms[0];
      return { record, activeSymptoms, latestActiveSymptom };
    });
  }, [records, symptomRecords]);

  const healthyPlotCount = records.filter((record) => record.status === "healthy").length;
  const watchPlotCount = records.filter((record) => record.status === "watch").length;
  const riskPlotCount = records.filter((record) => record.status === "risk").length;

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">{t("common.loading")}...</p>;
  if (error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!summary) return null;

  const profitLossAmount = Number(summary.profit_loss) || 0;
  const revenueAmount = Number(summary.total_revenue) || 0;
  const profitMargin = revenueAmount > 0 ? (profitLossAmount / revenueAmount) * 100 : 0;
  const latestRecordDate = getLatestRecordDate(records, symptomRecords, marketPrices);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label={t("dashboard.plots")} value={summary.total_planting_records.toString()} toneLabel={t("common.info")} />
        <SummaryCard label={t("dashboard.highRisk")} value={summary.high_risk_alerts.toString()} tone="warning" toneLabel={t("common.attention")} />
        <SummaryCard label={t("dashboard.latestPrices")} value={summary.latest_market_prices.toString()} toneLabel={t("common.info")} />
        <SummaryCard label={t("dashboard.profitLoss")} value={formatCurrency(summary.profit_loss)} tone={profitLossAmount >= 0 ? "success" : "warning"} toneLabel={profitLossAmount >= 0 ? t("common.good") : t("common.attention")} />
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
        <CommodityPriceTrend prices={marketPrices} />

        <aside className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">{t("dashboard.cropStatus")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("dashboard.cropStatusDescription")}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
            <StatusStat label={t("dashboard.totalPlants")} value={summary.total_planting_records.toString()} />
            <StatusStat label={t("dashboard.healthy")} value={healthyPlotCount.toString()} tone="success" />
            <StatusStat label={t("dashboard.needsAttention")} value={watchPlotCount.toString()} tone={watchPlotCount > 0 ? "warning" : "default"} />
            <StatusStat label={t("dashboard.problematic")} value={riskPlotCount.toString()} tone={riskPlotCount > 0 ? "danger" : "default"} />
          </div>
          <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-sm">
            <FinanceStat label={t("dashboard.totalCost")} value={formatCurrency(summary.total_cost)} />
            <FinanceStat label={t("dashboard.totalRevenue")} value={formatCurrency(summary.total_revenue)} />
            <FinanceStat label={t("dashboard.netProfitLoss")} value={formatCurrency(summary.profit_loss)} tone={profitLossTone(profitLossAmount)} />
            <FinanceStat label={t("dashboard.profitMargin")} value={`${formatPercent(profitMargin)}%`} tone={profitMarginTone(profitMargin)} />
            <FinanceStat label={t("dashboard.latestRecord")} value={latestRecordDate ? formatDateLong(latestRecordDate) : t("emptyState.noLatestRecord")} />
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("dashboard.plotMonitoring")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("dashboard.plotMonitoringDescription")}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={`${healthyPlotCount} ${t("dashboard.healthy").toLowerCase()}`} tone="success" />
            <StatusBadge label={`${watchPlotCount} ${t("dashboard.needsAttention").toLowerCase()}`} tone={watchPlotCount > 0 || riskPlotCount > 0 ? "warning" : "info"} />
          </div>
        </div>
        {plotMonitoring.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{t("emptyState.noPlantingRecords")}</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {plotMonitoring.map(({ record, activeSymptoms, latestActiveSymptom }) => (
              <article key={record.id} className="rounded-lg border border-field-100 bg-field-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{record.field_name} - {record.crop.name}</p>
                    {latestActiveSymptom ? (
                      <p className="mt-1 text-slate-700">{latestActiveSymptom.symptom.name} <span className="text-xs text-slate-500">({t(`status.${latestActiveSymptom.severity}`, { defaultValue: latestActiveSymptom.severity })})</span></p>
                    ) : (
                      <p className="mt-1 text-slate-700">{t("dashboard.noActiveSymptoms")}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{activeSymptoms.length} {t("dashboard.activeSymptoms")}</p>
                  </div>
                  <StatusBadge label={t(`status.${record.status}`, { defaultValue: record.status })} tone={statusTone(record.status)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, tone = "info", toneLabel }: { label: string; value: string; tone?: "info" | "success" | "warning"; toneLabel: string }) {
  return (
    <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <StatusBadge label={toneLabel} tone={tone} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function StatusStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = { default: "text-slate-950", success: "text-emerald-700", warning: "text-amber-700", danger: "text-red-700" }[tone];
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-600">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function FinanceStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-700" : "text-slate-950";
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-slate-600">{label}</span>
      <span className={`text-right font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function profitLossTone(value: number): "default" | "success" | "danger" {
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "default";
}

function profitMarginTone(value: number): "default" | "success" | "danger" {
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "default";
}

function getLatestRecordDate(records: PlantingRecord[], symptoms: SymptomRecord[], prices: MarketPrice[]) {
  const dates = [
    ...records.map((record) => record.planting_date),
    ...symptoms.map((symptom) => symptom.observed_at),
    ...prices.map((price) => price.recorded_date),
  ].filter(Boolean);

  dates.sort((a, b) => parseDateValue(a).getTime() - parseDateValue(b).getTime());
  return dates.length > 0 ? dates[dates.length - 1] : "";
}

function parseDateValue(dateValue: string) {
  return new Date(dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00`);
}
