import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MarketPrice } from "../../types/marketPrice";
import {
  buildCommodityPriceChartData,
  getCommodityOptions,
  getDefaultCommodity,
  type CommodityPriceChartRow,
} from "./commodityPriceChartUtils";

type PriceTypeFilter = "all" | "farm" | "wholesale" | "retail";
type PriceKey = Exclude<PriceTypeFilter, "all">;

type TooltipEntry = {
  color?: string;
  dataKey?: string | number;
  value?: number;
  payload?: CommodityPriceChartRow;
};

const PRICE_LINES = [
  { key: "farm", label: "Harga Ladang", color: "#3f6f2a" },
  { key: "wholesale", label: "Harga Borong", color: "#2563eb" },
  { key: "retail", label: "Harga Runcit", color: "#d97706" },
] as const;

export function CommodityPriceTrend({ prices }: { prices: MarketPrice[] }) {
  const commodityOptions = useMemo(() => getCommodityOptions(prices), [prices]);
  const [selectedCommodity, setSelectedCommodity] = useState("");
  const [selectedPriceType, setSelectedPriceType] = useState<PriceTypeFilter>("all");

  useEffect(() => {
    if (!selectedCommodity || !commodityOptions.includes(selectedCommodity)) {
      setSelectedCommodity(getDefaultCommodity(prices));
    }
  }, [commodityOptions, prices, selectedCommodity]);

  const chartData = useMemo(
    () => buildCommodityPriceChartData(prices, selectedCommodity),
    [prices, selectedCommodity],
  );
  const visibleLines = selectedPriceType === "all"
    ? PRICE_LINES
    : PRICE_LINES.filter((line) => line.key === selectedPriceType);
  const hasVisibleData = chartData.some((row) =>
    visibleLines.some((line) => row[line.key] !== null),
  );
  const summaries = useMemo(() => buildLatestSummaries(chartData), [chartData]);
  const yAxis = useMemo(
    () => buildYAxis(chartData, visibleLines.map((line) => line.key)),
    [chartData, visibleLines],
  );

  return (
    <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Trend Harga Komoditi</h2>
        <p className="mt-1 text-sm text-slate-600">Perbandingan harga ladang, borong dan runcit mengikut komoditi.</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Pilih Komoditi</span>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={selectedCommodity}
            onChange={(event) => setSelectedCommodity(event.target.value)}
          >
            {commodityOptions.length === 0 && <option value="">Tiada komoditi</option>}
            {commodityOptions.map((commodity) => <option key={commodity} value={commodity}>{commodity}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Jenis Harga</span>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={selectedPriceType}
            onChange={(event) => setSelectedPriceType(event.target.value as PriceTypeFilter)}
          >
            <option value="all">Paparkan Semua</option>
            <option value="farm">Harga Ladang</option>
            <option value="wholesale">Harga Borong</option>
            <option value="retail">Harga Runcit</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PRICE_LINES.map((line) => {
          const summary = summaries[line.key];
          const isUp = (summary?.changePercent ?? 0) > 0;
          const isDown = (summary?.changePercent ?? 0) < 0;

          return (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={line.key}>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: line.color }} />
                <span>{line.label} terkini</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {summary ? `RM${summary.price.toFixed(2)}/kg` : "Data belum tersedia"}
              </p>
              {summary && (
                <p className={`mt-1 text-sm font-medium ${isUp ? "text-emerald-700" : isDown ? "text-amber-700" : "text-slate-500"}`}>
                  {isUp ? "↑" : isDown ? "↓" : "→"} {Math.abs(summary.changePercent).toFixed(1)}% daripada rekod sebelumnya
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700" aria-label="Petunjuk jenis harga">
        {PRICE_LINES.map((line) => (
          <div className="flex items-center gap-2" key={line.key}>
            <span className="h-0.5 w-6" style={{ backgroundColor: line.color }} />
            <span>{line.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 h-[380px] w-full">
        {!selectedCommodity || !hasVisibleData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600">
            Tiada rekod harga untuk komoditi ini.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 8, bottom: 12, left: 4 }}>
              <XAxis
                dataKey="date"
                height={42}
                interval="preserveStartEnd"
                minTickGap={48}
                tick={{ fontSize: 11 }}
                tickFormatter={formatShortDate}
                label={{ value: "Tarikh", position: "insideBottom", offset: -4 }}
              />
              <YAxis
                domain={yAxis.domain}
                ticks={yAxis.ticks}
                tickFormatter={(value) => `RM${value}`}
                width={54}
                tick={{ fontSize: 11 }}
                label={{ value: "Harga (RM/kg)", angle: -90, position: "insideLeft", offset: 10 }}
              />
              <Tooltip content={<PriceTooltip commodity={selectedCommodity} />} />
              {visibleLines.map((line) => (
                <Line
                  connectNulls={false}
                  dataKey={line.key}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#ffffff" }}
                  key={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={2.5}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function PriceTooltip({ active, payload, commodity }: { active?: boolean; payload?: TooltipEntry[]; commodity: string }) {
  if (!active || !payload?.length) return null;
  const date = payload[0].payload?.date ?? "";

  return (
    <div className="min-w-48 rounded-md border border-slate-200 bg-white p-4 text-xs shadow-lg">
      <p className="text-sm font-semibold text-slate-950">{commodity}</p>
      <p className="mt-1 text-slate-600">{formatDisplayDate(date)}</p>
      <div className="mt-3 space-y-2">
        {payload.map((entry) => (
          <div className="flex items-center justify-between gap-5 text-slate-700" key={String(entry.dataKey)}>
            <span className="flex items-center gap-2 font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {priceTypeLabel(String(entry.dataKey))}
            </span>
            <span>RM {Number(entry.value ?? 0).toFixed(2)}/kg</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function priceTypeLabel(priceType: string) {
  return ({ farm: "Harga Ladang", wholesale: "Harga Borong", retail: "Harga Runcit" } as Record<string, string>)[priceType] ?? priceType;
}

function formatShortDate(dateValue: string) {
  const [, month, day] = dateValue.split("-");
  const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  return `${Number(day)} ${months[Number(month) - 1]}`;
}

function formatDisplayDate(dateValue: string) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}

function buildLatestSummaries(rows: CommodityPriceChartRow[]) {
  return Object.fromEntries(PRICE_LINES.map((line) => {
    const values = rows.flatMap((row) => row[line.key] === null ? [] : [row[line.key] as number]);
    if (values.length === 0) return [line.key, null];
    const price = values[values.length - 1];
    const previous = values.length > 1 ? values[values.length - 2] : undefined;
    const changePercent = previous && previous !== 0 ? ((price - previous) / previous) * 100 : 0;
    return [line.key, { price, changePercent }];
  })) as Record<PriceKey, { price: number; changePercent: number } | null>;
}

function buildYAxis(rows: CommodityPriceChartRow[], keys: PriceKey[]) {
  const values = rows.flatMap((row) => keys.flatMap((key) => row[key] === null ? [] : [row[key] as number]));
  if (values.length === 0) return { domain: [0, 10] as [number, number], ticks: [0, 2, 4, 6, 8, 10] };

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = Math.max(maximum - minimum, Math.max(maximum * 0.1, 1));
  const rawStep = spread / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const lower = Math.floor((minimum - spread * 0.12) / niceStep) * niceStep;
  const upper = Math.ceil((maximum + spread * 0.12) / niceStep) * niceStep;
  const ticks = Array.from({ length: Math.round((upper - lower) / niceStep) + 1 }, (_, index) =>
    Number((lower + index * niceStep).toFixed(2)),
  );
  return { domain: [lower, upper] as [number, number], ticks };
}
