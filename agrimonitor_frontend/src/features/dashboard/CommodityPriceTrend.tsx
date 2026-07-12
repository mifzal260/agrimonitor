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

type TooltipEntry = {
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

      <div className="mt-4 h-80 w-full">
        {!selectedCommodity || !hasVisibleData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-600">
            Tiada rekod harga untuk komoditi ini.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 24, left: 18 }}>
              <XAxis
                dataKey="date"
                height={50}
                tick={{ fontSize: 11 }}
                tickFormatter={formatShortDate}
                label={{ value: "Tarikh", position: "insideBottom", offset: -8 }}
              />
              <YAxis
                width={64}
                tick={{ fontSize: 11 }}
                label={{ value: "Harga (RM/kg)", angle: -90, position: "insideLeft", offset: 4 }}
              />
              <Tooltip content={<PriceTooltip commodity={selectedCommodity} />} />
              {visibleLines.map((line) => (
                <Line
                  connectNulls={false}
                  dataKey={line.key}
                  dot={{ r: 3 }}
                  key={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={2}
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
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-950">{commodity}</p>
      <p className="mt-1 text-slate-600">{formatDisplayDate(date)}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p className="text-slate-700" key={String(entry.dataKey)}>
            <span className="font-medium">{priceTypeLabel(String(entry.dataKey))}:</span>{" "}
            RM {Number(entry.value ?? 0).toFixed(2)}/kg
          </p>
        ))}
      </div>
    </div>
  );
}

function priceTypeLabel(priceType: string) {
  return ({ farm: "Harga Ladang", wholesale: "Harga Borong", retail: "Harga Runcit" } as Record<string, string>)[priceType] ?? priceType;
}

function formatShortDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function formatDisplayDate(dateValue: string) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}
