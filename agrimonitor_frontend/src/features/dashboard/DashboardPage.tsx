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
    watch: "Perlu pantau",
    risk: "Bermasalah",
    harvested: "Sudah dituai",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): "success" | "warning" {
  return status === "risk" || status === "watch" ? "warning" : "success";
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
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load dashboard"))
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
  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Loading dashboard...</p>;
  if (error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!summary) return null;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Plots" value={summary.total_planting_records.toString()} />
        <SummaryCard label="High Risk" value={summary.high_risk_alerts.toString()} tone="warning" />
        <SummaryCard label="Latest Prices" value={summary.latest_market_prices.toString()} />
        <SummaryCard label="Profit/Loss" value={`RM ${summary.profit_loss}`} tone={Number(summary.profit_loss) >= 0 ? "success" : "warning"} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <CommodityPriceTrend prices={marketPrices} />

        <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Status Tanaman</h2>
          <div className="mt-4 space-y-3">
            {summary.crop_status.length === 0 ? <p className="text-sm text-slate-600">No planting records yet.</p> : summary.crop_status.map((item) => (
              <div key={item.status} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{statusLabel(item.status)}</span>
                <StatusBadge label={item.count.toString()} tone={statusTone(item.status)} />
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-700">
            <p>Jumlah Kos: RM {summary.total_cost}</p>
            <p>Jumlah Hasil: RM {summary.total_revenue}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Pemantauan plot</h2>
            <p className="mt-1 text-sm text-slate-600">Status plot ikut rekod tanaman: Sihat, Perlu pantau, atau Bermasalah.</p>
          </div>
          <div className="flex items-center gap-2"><StatusBadge label={`${healthyPlotCount} sihat`} tone="success" /><StatusBadge label={`${watchPlotCount} pantau`} tone={watchPlotCount > 0 || riskPlotCount > 0 ? "warning" : "info"} /></div>
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
        <StatusBadge label={tone} tone={tone} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}
