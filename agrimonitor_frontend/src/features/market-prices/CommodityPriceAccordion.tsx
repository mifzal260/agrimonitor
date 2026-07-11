import { StatusBadge } from "../../components/StatusBadge";
import {
  calculateLevelDifference,
  selectPrimaryPrice,
  type CommodityPriceGroup,
  type PriceHighlight,
  type PriceLevel,
} from "./priceTrendUtils";

type CommodityPriceAccordionProps = {
  group: CommodityPriceGroup;
  isOpen: boolean;
  selectedPriceType: string;
  onToggle: () => void;
};

const PRICE_LEVELS: Array<{ key: PriceLevel; label: string }> = [
  { key: "farm", label: "Harga Ladang" },
  { key: "wholesale", label: "Harga Borong" },
  { key: "retail", label: "Harga Runcit" },
];

export function CommodityPriceAccordion({ group, isOpen, selectedPriceType, onToggle }: CommodityPriceAccordionProps) {
  const primary = selectPrimaryPrice(group, selectedPriceType);
  const panelId = "commodity-price-" + slugify(group.commodityName);
  const articleClass = "overflow-hidden rounded-lg border bg-white shadow-sm transition-colors " + (isOpen ? "border-field-700" : "border-field-100");
  const panelClass = "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out " + (isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0");

  return (
    <article className={articleClass}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-field-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-field-700"
        type="button"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold text-slate-950">{group.commodityName}</h3>
          {primary ? (
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-2xl font-bold text-slate-950">
                RM {formatMoney(primary.current.price)}
                <span className="ml-1 text-sm font-medium text-slate-600">/ {primary.current.unit}</span>
              </p>
              <StatusBadge label={trendSymbol(primary.trend) + " " + trendLabel(primary.trend)} tone={trendTone(primary.trend)} />
              <p className="w-full text-xs text-slate-500">
                {priceTypeLabel(primary.current.price_type)} · Dikemas kini {formatMalayDate(primary.current.recorded_date)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Data belum tersedia</p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-field-700">
          <span className="text-xs sm:text-sm">{isOpen ? "Tutup harga" : "Lihat semua harga"}</span>
          <span aria-hidden="true" className={"text-xl transition-transform duration-300 " + (isOpen ? "rotate-180" : "")}>⌄</span>
        </span>
      </button>

      <div className={panelClass} id={panelId}>
        <div className="overflow-hidden">
          <div className="border-t border-field-100 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              {PRICE_LEVELS.map((level) => (
                <PriceLevelPanel highlight={group.levels[level.key]} key={level.key} label={level.label} />
              ))}
            </div>
            <PriceDifferences group={group} />
          </div>
        </div>
      </div>
    </article>
  );
}

function PriceLevelPanel({ highlight, label }: { highlight: PriceHighlight | null; label: string }) {
  return (
    <section className="rounded-lg border border-field-100 bg-field-50 p-4">
      <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
      {!highlight ? (
        <p className="mt-4 text-sm text-slate-500">Data belum tersedia</p>
      ) : (
        <>
          <p className="mt-3 text-xl font-bold text-slate-950">
            RM {formatMoney(highlight.current.price)}
            <span className="ml-1 text-xs font-medium text-slate-600">/ {highlight.current.unit}</span>
          </p>
          <p className={"mt-2 text-sm font-semibold " + trendTextClass(highlight.trend)}>
            {trendSymbol(highlight.trend)} {formatChange(highlight)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatMalayDate(highlight.current.recorded_date)}</p>
        </>
      )}
    </section>
  );
}

function PriceDifferences({ group }: { group: CommodityPriceGroup }) {
  const comparisons = [
    { label: "Ladang → Borong", value: calculateLevelDifference(group.levels.farm, group.levels.wholesale) },
    { label: "Borong → Runcit", value: calculateLevelDifference(group.levels.wholesale, group.levels.retail) },
    { label: "Ladang → Runcit", value: calculateLevelDifference(group.levels.farm, group.levels.retail) },
  ];

  return (
    <section className="mt-4 border-t border-slate-200 pt-4">
      <h4 className="font-semibold text-slate-950">Perbezaan Harga</h4>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {comparisons.map((comparison) => (
          <div className="rounded-lg border border-slate-200 px-3 py-3" key={comparison.label}>
            <p className="text-xs font-medium text-slate-600">{comparison.label}</p>
            {comparison.value ? (
              <p className="mt-1 font-semibold text-slate-950">
                RM {formatSigned(comparison.value.amount, 2)}
                <span className="ml-1 text-xs font-medium text-slate-600">
                  ({comparison.value.percent === null ? "peratus tidak tersedia" : formatSigned(comparison.value.percent, 1) + "%"})
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Data belum tersedia</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatChange(highlight: PriceHighlight) {
  if (highlight.changeAmount === null) return "Tiada harga terdahulu";
  const percent = highlight.changePercent === null ? "peratus tidak tersedia" : formatSigned(highlight.changePercent, 1) + "%";
  return "RM " + formatSigned(highlight.changeAmount, 2) + " · " + percent;
}

function formatMoney(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function formatSigned(value: number, digits: number) {
  return (value > 0 ? "+" : "") + value.toFixed(digits);
}

function formatMalayDate(dateValue: string) {
  return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(dateValue + "T00:00:00"));
}

function priceTypeLabel(priceType: string) {
  return ({ farm: "Ladang", wholesale: "Borong", retail: "Runcit" } as Record<string, string>)[priceType] ?? priceType;
}

function trendLabel(trend: PriceHighlight["trend"]) {
  return ({ up: "Naik", down: "Turun", stable: "Stabil", unavailable: "Tiada perbandingan" } as const)[trend];
}

function trendSymbol(trend: PriceHighlight["trend"]) {
  return ({ up: "↑", down: "↓", stable: "−", unavailable: "−" } as const)[trend];
}

function trendTone(trend: PriceHighlight["trend"]): "info" | "success" | "warning" {
  if (trend === "up") return "success";
  if (trend === "down") return "warning";
  return "info";
}

function trendTextClass(trend: PriceHighlight["trend"]) {
  if (trend === "up") return "text-emerald-700";
  if (trend === "down") return "text-amber-700";
  if (trend === "stable") return "text-sky-700";
  return "text-slate-600";
}

function slugify(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
