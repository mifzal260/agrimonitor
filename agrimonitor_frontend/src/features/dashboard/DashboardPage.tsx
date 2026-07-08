import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getDashboardSummary } from "../../api/dashboard";
import { listPlantingRecords, listSymptomRecords } from "../../api/monitoring";
import { StatusBadge } from "../../components/StatusBadge";
import type { DashboardSummary } from "../../types/dashboard";
import type { PlantingRecord, SymptomRecord } from "../../types/monitoring";

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

function severityTone(severity: string): "info" | "warning" {
  return severity === "high" || severity === "medium" ? "warning" : "info";
}

export function DashboardPage({ token }: DashboardPageProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [records, setRecords] = useState<PlantingRecord[]>([]);
  const [symptomRecords, setSymptomRecords] = useState<SymptomRecord[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardSummary(token), listPlantingRecords(token), listSymptomRecords(token)])
      .then(([summaryData, recordData, symptomData]) => {
        setSummary(summaryData);
        setRecords(recordData);
        setSymptomRecords(symptomData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load dashboard"))
      .finally(() => setIsLoading(false));
  }, [token]);

  const chartData = useMemo(() => {
    return (summary?.price_trend ?? []).map((point) => ({
      label: `${point.commodity_name} ${point.recorded_date}`,
      date: point.recorded_date,
      commodity: point.commodity_name,
      price: Number(point.price),
    }));
  }, [summary]);

  const recentSymptoms = useMemo(() => {
    return symptomRecords.filter((symptom) => symptom.status !== "resolved").slice(0, 5).map((symptom) => {
      const record = records.find((item) => item.id === symptom.planting_record_id);
      return {
        ...symptom,
        plotName: record?.field_name ?? "Plot tidak dijumpai",
        cropName: record?.crop.name ?? "Tanaman",
      };
    });
  }, [records, symptomRecords]);

  const activeSymptomCount = symptomRecords.filter((item) => item.status !== "resolved").length;
  const resolvedSymptomCount = symptomRecords.filter((item) => item.status === "resolved").length;

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
        <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Price trend</h2>
              <p className="mt-1 text-sm text-slate-600">Demo market prices from seeded/admin data.</p>
            </div>
            <StatusBadge label="Recharts" tone="info" />
          </div>
          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-600">No market price data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={45} />
                  <Tooltip formatter={(value, name, item) => [`RM ${value}`, item.payload.commodity]} />
                  <Line type="monotone" dataKey="price" stroke="#3f6f2a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Crop status</h2>
          <div className="mt-4 space-y-3">
            {summary.crop_status.length === 0 ? <p className="text-sm text-slate-600">No planting records yet.</p> : summary.crop_status.map((item) => (
              <div key={item.status} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{statusLabel(item.status)}</span>
                <StatusBadge label={item.count.toString()} tone={statusTone(item.status)} />
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-700">
            <p>Total cost: RM {summary.total_cost}</p>
            <p>Total revenue: RM {summary.total_revenue}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Simptom terbaru</h2>
            <p className="mt-1 text-sm text-slate-600">Ringkasan masalah tanaman yang baru direkodkan.</p>
          </div>
          <div className="flex items-center gap-2"><StatusBadge label={`${activeSymptomCount} aktif`} tone={symptomRecords.some((item) => item.status !== "resolved" && item.severity === "high") ? "warning" : "info"} /><StatusBadge label={`${resolvedSymptomCount} selesai`} tone="success" /></div>
        </div>
        {recentSymptoms.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Tiada simptom aktif direkodkan.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recentSymptoms.map((item) => (
              <article key={item.id} className="rounded-lg border border-field-100 bg-field-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{item.plotName} - {item.cropName}</p>
                    <p className="mt-1 text-slate-700">{item.symptom.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(item.observed_at).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge label={severityLabel(item.severity)} tone={severityTone(item.severity)} />
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