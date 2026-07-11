import { StatusBadge } from "../../components/StatusBadge";
import type { PriceHighlight } from "./priceTrendUtils";

export function PriceHighlightCard({ item }: { item: PriceHighlight }) {
  const { current, changeAmount, changePercent, trend } = item;
  const details = getTrendDetails(trend);

  return (
    <article className="min-w-0 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-slate-950">{current.commodity_name}</h3>
          <p className="mt-1 text-sm text-slate-600">{priceTypeLabel(current.price_type)} · {current.location}</p>
        </div>
        <StatusBadge label={`${details.symbol} ${details.label}`} tone={details.tone} />
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-950">
        <span className="sr-only">Harga semasa: </span>RM {formatMoney(Number(current.price))}
        <span className="ml-1 text-sm font-medium text-slate-600">/ {current.unit}</span>
      </p>
      <p className={`mt-3 text-sm font-semibold ${details.textClass}`}>
        <span aria-hidden="true">{details.symbol}</span>{" "}
        {changeAmount === null ? "Tiada harga terdahulu" : `RM${formatSigned(changeAmount, 2)}`}
        {changeAmount !== null && <span> · {changePercent === null ? "Peratus tidak tersedia" : `${formatSigned(changePercent, 1)}%`}</span>}
      </p>
      <p className="mt-1 text-xs text-slate-500">Dikemas kini {formatMalayDate(current.recorded_date)}</p>
    </article>
  );
}

function getTrendDetails(trend: PriceHighlight["trend"]): { label: string; symbol: string; tone: "info" | "success" | "warning"; textClass: string } {
  if (trend === "up") return { label: "Naik", symbol: "↑", tone: "success", textClass: "text-emerald-700" };
  if (trend === "down") return { label: "Turun", symbol: "↓", tone: "warning", textClass: "text-amber-700" };
  if (trend === "stable") return { label: "Stabil", symbol: "−", tone: "info", textClass: "text-sky-700" };
  return { label: "Tiada perbandingan", symbol: "−", tone: "info", textClass: "text-slate-600" };
}

function priceTypeLabel(priceType: string) {
  return ({ farm: "Ladang", wholesale: "Borong", retail: "Runcit" } as Record<string, string>)[priceType] ?? priceType;
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatSigned(value: number, digits: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatMalayDate(dateValue: string) {
  return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${dateValue}T00:00:00`));
}
