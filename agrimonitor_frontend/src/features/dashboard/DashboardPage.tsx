import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getDashboardSummary } from "../../api/dashboard";
import { StatusBadge } from "../../components/StatusBadge";
import type { DashboardSummary, StatusCount } from "../../types/dashboard";

type DashboardPageProps = {
  token: string;
};

const statusLabels: Record<string, string> = {
  healthy: "Sihat",
  watch: "Perlu pantau",
  risk: "Bermasalah",
  harvested: "Dituai",
};

const farmTiles = [
  "col-span-2 row-span-2 bg-emerald-200",
  "bg-lime-200",
  "bg-amber-200",
  "bg-teal-200",
  "col-span-2 bg-green-200",
  "bg-orange-200",
  "bg-emerald-300",
  "bg-yellow-100",
  "col-span-2 bg-field-200",
  "bg-lime-300",
  "bg-emerald-100",
];

export function DashboardPage({ token }: DashboardPageProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDashboardSummary(token)
      .then(setSummary)
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

  const statusData = useMemo(() => {
    return (summary?.crop_status ?? []).map((item) => ({
      ...item,
      label: statusLabels[item.status] ?? item.status,
    }));
  }, [summary]);

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Loading dashboard...</p>;
  if (error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!summary) return null;

  const profitLoss = Number(summary.profit_loss);
  const riskRatio = summary.total_planting_records > 0 ? Math.round((summary.high_risk_alerts / summary.total_planting_records) * 100) : 0;
  const latestPrice = chartData.length > 0 ? chartData[chartData.length - 1] : undefined;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-field-700">Farm command center</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">AgriMonitor overview</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Monitor crop condition, market movement, and farm finance from one operational dashboard.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
              <MetricTile label="Petak" value={summary.total_planting_records.toString()} tone="green" />
              <MetricTile label="Risiko tinggi" value={summary.high_risk_alerts.toString()} tone="amber" />
              <MetricTile label="Harga" value={summary.latest_market_prices.toString()} tone="blue" />
              <MetricTile label="Untung/Rugi" value={`RM ${summary.profit_loss}`} tone={profitLoss >= 0 ? "green" : "amber"} />
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <FarmOverview statusData={statusData} totalPlots={summary.total_planting_records} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <SignalCard title="Plant risk level" value={`${riskRatio}%`} detail={`${summary.high_risk_alerts} high risk alert(s)`} tone={riskRatio > 0 ? "warning" : "success"} />
              <SignalCard title="Latest market signal" value={latestPrice ? `RM ${latestPrice.price.toFixed(2)}` : "No data"} detail={latestPrice ? `${latestPrice.commodity} on ${latestPrice.date}` : "Add market prices to see trend"} tone="info" />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg bg-[#12343b] p-4 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Financial position</p>
                <p className="mt-2 text-3xl font-bold">RM {summary.profit_loss}</p>
              </div>
              <StatusBadge label={profitLoss >= 0 ? "positive" : "loss"} tone={profitLoss >= 0 ? "success" : "warning"} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-white/10 p-3">
                <p className="text-emerald-100">Revenue</p>
                <p className="mt-1 font-bold">RM {summary.total_revenue}</p>
              </div>
              <div className="rounded-md bg-white/10 p-3">
                <p className="text-emerald-100">Cost</p>
                <p className="mt-1 font-bold">RM {summary.total_cost}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Crop status</h3>
              <StatusBadge label={`${statusData.length} status`} tone="info" />
            </div>
            <div className="mt-4 h-40">
              {statusData.length === 0 ? <p className="text-sm text-slate-600">No planting records yet.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3f6f2a" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Market price trend</h2>
              <p className="mt-1 text-sm text-slate-600">Latest seeded/admin prices visualized for quick comparison.</p>
            </div>
            <StatusBadge label="Live data" tone="success" />
          </div>
          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-600">No market price data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={45} />
                  <Tooltip formatter={(value, name, item) => [`RM ${value}`, item.payload.commodity]} />
                  <Line type="monotone" dataKey="price" stroke="#3f6f2a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Price watchlist</h2>
              <p className="mt-1 text-sm text-slate-600">Recent commodity records from market module.</p>
            </div>
            <StatusBadge label={`${chartData.length} rows`} tone="info" />
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-3">Commodity</th><th className="px-3 py-3">Date</th><th className="px-3 py-3 text-right">Price</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chartData.slice(-5).reverse().map((item) => (
                  <tr key={item.label} className="hover:bg-field-50/70">
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.commodity}</td>
                    <td className="px-3 py-3 text-slate-600">{item.date}</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-950">RM {item.price.toFixed(2)}</td>
                  </tr>
                ))}
                {chartData.length === 0 && <tr><td className="px-3 py-4 text-slate-600" colSpan={3}>No price records yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "blue" }) {
  const toneClass = tone === "green" ? "border-emerald-100 bg-emerald-50 text-emerald-900" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-900" : "border-sky-100 bg-sky-50 text-sky-900";
  return (
    <article className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </article>
  );
}

function FarmOverview({ statusData, totalPlots }: { statusData: Array<StatusCount & { label: string }>; totalPlots: number }) {
  return (
    <div className="rounded-lg border border-field-100 bg-[#d8ead0] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">Farm overview</h3>
          <p className="mt-1 text-xs text-slate-600">Visual plot map based on current records.</p>
        </div>
        <StatusBadge label={`${totalPlots} plots`} tone="success" />
      </div>
      <div className="mt-4 grid h-64 grid-cols-4 grid-rows-4 gap-2 rounded-lg bg-white/30 p-2">
        {farmTiles.map((tile, index) => <div key={tile + index} className={`rounded-md border border-white/60 ${tile}`} />)}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {statusData.length === 0 ? <p className="text-sm text-slate-600">No crop status yet.</p> : statusData.map((item) => (
          <div key={item.status} className="flex items-center justify-between rounded-md bg-white/70 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{item.label}</span>
            <span className="font-bold text-slate-950">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalCard({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: "info" | "success" | "warning" }) {
  return (
    <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <StatusBadge label={tone} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-slate-600">{detail}</p>
    </article>
  );
}