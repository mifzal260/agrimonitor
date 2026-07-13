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

const MONEY_FORMATTER = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
  const chartSummary = useMemo(
    () => buildChartSummary(chartData, visibleLines.map((line) => line.key)),
    [chartData, visibleLines],
  );
  const yAxis = useMemo(
    () => buildYAxis(chartData, visibleLines.map((line) => line.key)),
    [chartData, visibleLines],
  );

  return (
    <section className="min-w-0 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
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

      <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${selectedPriceType === "all" ? "lg:grid-cols-3" : ""}`}>
        {visibleLines.map((line) => {
          const summary = summaries[line.key];
          const change = summary?.changePercent ?? 0;
          const changeTone = change > 0 ? "text-emerald-700" : change < 0 ? "text-red-700" : "text-slate-500";

          return (
            <div className="flex min-h-24 flex-col justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5" key={line.key}>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: line.color }} />
                <span>{line.label} terkini</span>
              </div>
              <p className="mt-1 whitespace-nowrap text-lg font-semibold text-slate-950">
                {summary ? formatPrice(summary.price) : "Data belum tersedia"}
              </p>
              {summary && (
                <p className={`mt-0.5 whitespace-nowrap text-xs font-medium ${changeTone}`}>
                  {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(1)}% berbanding sebelumnya
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700" aria-label="Petunjuk jenis harga">
          {visibleLines.map((line) => (
            <div className="flex items-center gap-2" key={line.key}>
              <span className="h-0.5 w-6" style={{ backgroundColor: line.color }} />
              <span>{line.label}</span>
            </div>
          ))}
        </div>
        {chartSummary && (
          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <MiniSummary label="Tertinggi" value={formatPrice(chartSummary.highest)} />
            <MiniSummary label="Terendah" value={formatPrice(chartSummary.lowest)} />
            <MiniSummary label="Perubahan" value={formatSignedMoney(chartSummary.change)} tone={chartSummary.change > 0 ? "success" : chartSummary.change < 0 ? "danger" : "default"} />
            <MiniSummary label="Dikemas kini" value={formatShortDate(chartSummary.updatedAt)} />
          </div>
        )}
      </div>

      <div className="mt-1 h-[285px] min-w-0 w-full sm:h-[295px]">
        {!selectedCommodity || !hasVisibleData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600">
            Tiada rekod harga untuk komoditi ini.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 6, bottom: 4, left: 14 }}>
              <XAxis
                dataKey="date"
                height={34}
                interval="preserveStartEnd"
                minTickGap={56}
                tick={{ fontSize: 11 }}
                tickFormatter={formatShortDate}
                label={{ value: "Tarikh", position: "insideBottom", offset: -1 }}
              />
              <YAxis
                domain={yAxis.domain}
                ticks={yAxis.ticks}
                tickFormatter={(value) => `RM ${formatAxisValue(Number(value))}`}
                width={78}
                tick={{ fontSize: 11 }}
                tickMargin={10}
                label={{ value: "Harga (RM/kg)", angle: -90, position: "insideLeft", offset: -8 }}
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
                  strokeWidth={2.25}
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

function MiniSummary({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-700" : "text-slate-950";
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-0.5 whitespace-nowrap text-xs font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function formatSignedMoney(value: number) {
  if (value === 0) return "RM 0.00";
  const prefix = value < 0 ? "-" : "+";
  return `${prefix}RM ${MONEY_FORMATTER.format(Math.abs(value))}`;
}

function buildChartSummary(rows: CommodityPriceChartRow[], keys: PriceKey[]) {
  const points = rows.flatMap((row) => keys.flatMap((key) => row[key] === null ? [] : [{ price: row[key] as number, date: row.date }]));
  if (points.length === 0) return null;
  const prices = points.map((point) => point.price);
  const first = points[0].price;
  const last = points[points.length - 1].price;
  const updatedAt = points.reduce((latest, point) => point.date > latest ? point.date : latest, points[0].date);
  return { highest: Math.max(...prices), lowest: Math.min(...prices), change: last - first, updatedAt };
}
function PriceTooltip({ active, payload, commodity }: { active?: boolean; payload?: TooltipEntry[]; commodity: string }) {
  if (!active || !payload?.length) return null;
  const date = payload[0].payload?.date ?? "";

  return (
    <div className="w-56 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="text-sm font-semibold text-slate-950">{commodity}</p>
      <p className="mt-1 text-slate-600">{formatDisplayDate(date)}</p>
      <div className="mt-3 space-y-2">
        {payload.map((entry) => (
          <div className="flex items-center justify-between gap-3 text-slate-700" key={String(entry.dataKey)}>
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="truncate">{priceTypeLabel(String(entry.dataKey))}</span>
            </span>
            <span className="shrink-0">{formatPrice(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function priceTypeLabel(priceType: string) {
  return ({ farm: "Harga Ladang", wholesale: "Harga Borong", retail: "Harga Runcit" } as Record<string, string>)[priceType] ?? priceType;
}

function formatPrice(value: number) {
  return `RM ${MONEY_FORMATTER.format(value)} / kg`;
}

function formatAxisValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
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
  const spread = Math.max(maximum - minimum, Math.max(maximum * 0.08, 0.5));
  const rawStep = spread / 5;
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
