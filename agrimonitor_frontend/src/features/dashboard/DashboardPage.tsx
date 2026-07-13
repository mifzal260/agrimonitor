import { useEffect, useMemo, useState } from "react";

import { getDashboardSummary } from "../../api/dashboard";
import { listMarketPrices } from "../../api/marketPrices";
import { listPlantingRecords, listSymptomRecords } from "../../api/monitoring";
import { StatusBadge } from "../../components/StatusBadge";
import type { DashboardSummary } from "../../types/dashboard";
import type { MarketPrice } from "../../types/marketPrice";
import type { PlantingRecord, SymptomRecord } from "../../types/monitoring";
import { CommodityPriceTrend } from "./CommodityPriceTrend";

type DashboardPageProps = {
  token: string;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    healthy: "Sihat",
    watch: "Perlu Dipantau",
    risk: "Bermasalah",
    harvested: "Sudah dituai",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): "success" | "warning" | "danger" {
  if (status === "risk") return "danger";
  if (status === "watch") return "warning";
  return "success";
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    low: "Rendah",
    medium: "Sederhana",
    high: "Tinggi",
  };
  return labels[severity] ?? severity;
}

export function DashboardPage({ token }: DashboardPageProps) {
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
      .catch((err) => setError(err instanceof Error ? err.message : "Papan pemuka tidak dapat dimuatkan"))
      .finally(() => setIsLoading(false));
  }, [token]);

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
  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Memuatkan papan pemuka...</p>;
  if (error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!summary) return null;

  const profitLossAmount = Number(summary.profit_loss) || 0;
  const revenueAmount = Number(summary.total_revenue) || 0;
  const profitMargin = revenueAmount > 0 ? (profitLossAmount / revenueAmount) * 100 : 0;
  const latestRecordDate = getLatestRecordDate(records, symptomRecords, marketPrices);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Plot" value={summary.total_planting_records.toString()} />
        <SummaryCard label="Risiko Tinggi" value={summary.high_risk_alerts.toString()} tone="warning" />
        <SummaryCard label="Harga Terkini" value={summary.latest_market_prices.toString()} />
        <SummaryCard label="Untung/Rugi" value={formatMoney(summary.profit_loss)} tone={Number(summary.profit_loss) >= 0 ? "success" : "warning"} />
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
        <CommodityPriceTrend prices={marketPrices} />

        <aside className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Status Tanaman</h2>
            <p className="mt-1 text-sm text-slate-600">Ringkasan keadaan tanaman, kos dan hasil semasa.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
            <StatusStat label="Jumlah tanaman" value={summary.total_planting_records.toString()} />
            <StatusStat label="Sihat" value={healthyPlotCount.toString()} tone="success" />
            <StatusStat label="Perlu Dipantau" value={watchPlotCount.toString()} tone={watchPlotCount > 0 ? "warning" : "default"} />
            <StatusStat label="Bermasalah" value={riskPlotCount.toString()} tone={riskPlotCount > 0 ? "danger" : "default"} />
          </div>
          <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-sm">
            <FinanceStat label="Jumlah Kos" value={formatMoney(summary.total_cost)} />
            <FinanceStat label="Jumlah Hasil" value={formatMoney(summary.total_revenue)} />
            <FinanceStat
              label="Untung / Rugi Bersih"
              value={formatMoney(summary.profit_loss)}
              tone={profitLossTone(profitLossAmount)}
            />
            <FinanceStat label="Margin Keuntungan" value={`${profitMargin.toFixed(1)}%`} tone={profitMarginTone(profitMargin)} />
            <FinanceStat label="Rekod Terakhir" value={latestRecordDate ? formatDisplayDate(latestRecordDate) : "Tiada rekod"} />
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Pemantauan plot</h2>
            <p className="mt-1 text-sm text-slate-600">Status plot ikut rekod tanaman: Sihat, Perlu Dipantau, atau Bermasalah.</p>
          </div>
          <div className="flex items-center gap-2"><StatusBadge label={`${healthyPlotCount} sihat`} tone="success" /><StatusBadge label={`${watchPlotCount} perlu dipantau`} tone={watchPlotCount > 0 || riskPlotCount > 0 ? "warning" : "info"} /></div>
        </div>
        {plotMonitoring.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Belum ada plot direkodkan.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {plotMonitoring.map(({ record, activeSymptoms, latestActiveSymptom }) => (
              <article key={record.id} className="rounded-lg border border-field-100 bg-field-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{record.field_name} - {record.crop.name}</p>
                    {latestActiveSymptom ? (
                      <p className="mt-1 text-slate-700">{latestActiveSymptom.symptom.name} <span className="text-xs text-slate-500">({severityLabel(latestActiveSymptom.severity)})</span></p>
                    ) : (
                      <p className="mt-1 text-slate-700">Tiada simptom aktif</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{activeSymptoms.length} simptom aktif</p>
                  </div>
                  <StatusBadge label={statusLabel(record.status)} tone={statusTone(record.status)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, tone = "info" }: { label: string; value: string; tone?: "info" | "success" | "warning" }) {
  return (
    <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <StatusBadge label={summaryToneLabel(tone)} tone={tone} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}
function StatusStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = {
    default: "text-slate-950",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  }[tone];

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

function formatMoney(value: string | number) {
  const amount = Number(value) || 0;
  const formatted = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount));
  return amount < 0 ? `-RM ${formatted}` : `RM ${formatted}`;
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

function formatDisplayDate(dateValue: string) {
  if (!dateValue) return "";
  const date = parseDateValue(dateValue);
  if (Number.isNaN(date.getTime())) return "Tiada rekod";
  return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function parseDateValue(dateValue: string) {
  return new Date(dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00`);
}

function summaryToneLabel(tone: "info" | "success" | "warning") {
  const labels = { info: "Info", success: "Baik", warning: "Perhatian" };
  return labels[tone];
}
