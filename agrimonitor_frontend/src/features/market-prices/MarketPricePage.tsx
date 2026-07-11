import { useEffect, useMemo, useState } from "react";

import { createMarketPrice, importMarketPricesCsv, listMarketPrices } from "../../api/marketPrices";
import { StatusBadge } from "../../components/StatusBadge";
import type { User } from "../../types/auth";
import type { MarketPrice } from "../../types/marketPrice";
import { DailyPriceSummary } from "./DailyPriceSummary";
import { buildPriceSummary } from "./priceTrendUtils";

type MarketPricePageProps = {
  token: string;
  user: User;
};

const emptyFilters = { commodity_name: "", location: "", price_type: "", date_from: "", date_to: "" };
const INITIAL_RECORD_LIMIT = 30;

export function MarketPricePage({ token, user }: MarketPricePageProps) {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [allPrices, setAllPrices] = useState<MarketPrice[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [form, setForm] = useState({ commodity_name: "", location: "", price_type: "retail", price: "", unit: "kg", recorded_date: "", trend: "stable" });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [recordLimit, setRecordLimit] = useState(INITIAL_RECORD_LIMIT);

  const hasActiveFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);
  const visiblePrices = useMemo(() => prices.slice(0, recordLimit), [prices, recordLimit]);
  const commodityOptions = useMemo(() => uniqueOptions(allPrices.map((price) => price.commodity_name)), [allPrices]);
  const weekOptions = useMemo(() => buildWeekOptions(allPrices.map((price) => price.recorded_date)), [allPrices]);
  const selectedWeekValue = filters.date_from && filters.date_to ? `${filters.date_from}|${filters.date_to}` : "";
  const priceSummary = useMemo(() => buildPriceSummary(allPrices), [allPrices]);

  async function loadData() {
    setError("");
    setIsLoading(true);
    try {
      const priceData = await listMarketPrices(token, emptyFilters);
      setPrices(priceData);
      setAllPrices(priceData);
      setRecordLimit(INITIAL_RECORD_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load market prices");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsFiltering(true);
    try {
      const priceData = await listMarketPrices(token, filters);
      setPrices(priceData);
      setRecordLimit(INITIAL_RECORD_LIMIT);
      setMessage(priceData.length === 0 ? "Tiada harga pasaran dijumpai untuk filter ini." : `${priceData.length} rekod harga pasaran dijumpai.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Filter harga pasaran gagal.");
    } finally {
      setIsFiltering(false);
    }
  }

  async function resetFilters() {
    setFilters(emptyFilters);
    setError("");
    setMessage("");
    setIsFiltering(true);
    try {
      const priceData = await listMarketPrices(token, emptyFilters);
      setPrices(priceData);
      setAllPrices(priceData);
      setRecordLimit(INITIAL_RECORD_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset filter harga pasaran.");
    } finally {
      setIsFiltering(false);
    }
  }

  async function submitPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSavingPrice(true);
    try {
      const savedPrice = await createMarketPrice(token, form);
      setPrices((currentPrices) => [savedPrice, ...currentPrices.filter((price) => price.id !== savedPrice.id)]);
      setAllPrices((currentPrices) => [savedPrice, ...currentPrices.filter((price) => price.id !== savedPrice.id)]);
      setRecordLimit(INITIAL_RECORD_LIMIT);
      setForm({ commodity_name: "", location: "", price_type: "retail", price: "", unit: "kg", recorded_date: "", trend: "stable" });
      setMessage("Harga pasaran berjaya disimpan dan sudah muncul dalam senarai.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harga pasaran gagal disimpan.");
    } finally {
      setIsSavingPrice(false);
    }
  }

  async function submitCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csvFile) {
      setError("Pilih fail CSV dahulu.");
      return;
    }
    setMessage("");
    setError("");
    setIsImportingCsv(true);
    try {
      const result = await importMarketPricesCsv(token, csvFile);
      setCsvFile(null);
      setMessage(`CSV berjaya diimport: ${result.imported} baris, ${result.skipped} dilangkau.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV gagal diimport.");
    } finally {
      setIsImportingCsv(false);
    }
  }

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Loading market prices...</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      <DailyPriceSummary summary={priceSummary} onViewAll={() => document.getElementById("senarai-harga-pasaran")?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      <form onSubmit={applyFilters} className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">          <PriceTypeButton label="Semua" description="Semua jenis harga" value="" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
          <PriceTypeButton label="Ladang" description="Harga di peringkat ladang" value="farm" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
          <PriceTypeButton label="Borong" description="Harga pemborong" value="wholesale" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
          <PriceTypeButton label="Runcit" description="Harga pengguna" value="retail" currentValue={filters.price_type} onSelect={(value) => setFilters({ ...filters, price_type: value })} />
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-field-100 bg-field-50 p-4 md:grid-cols-[1.2fr_1fr_auto]">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Komoditi</span>
            <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={filters.commodity_name} onChange={(event) => setFilters({ ...filters, commodity_name: event.target.value })}>
              <option value="">Semua komoditi</option>
              {commodityOptions.map((commodity) => <option key={commodity} value={commodity}>{commodity}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Minggu harga</span>
            <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={selectedWeekValue} onChange={(event) => {
              const [date_from, date_to] = event.target.value.split("|");
              setFilters({ ...filters, date_from: date_from ?? "", date_to: date_to ?? "", location: "" });
            }}>
              <option value="">Semua minggu</option>
              {weekOptions.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="min-h-10 flex-1 rounded-md bg-field-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:min-w-28" type="submit" disabled={isFiltering}>{isFiltering ? "Menapis..." : "Tapis"}</button>
            <button className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60" type="button" disabled={isFiltering || !hasActiveFilters} onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </form>

      {user.role === "admin" && (
        <div className="grid gap-5 md:grid-cols-2">
          <form onSubmit={submitPrice} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Tambah harga pasaran</h3>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Komoditi" value={form.commodity_name} onChange={(event) => setForm({ ...form, commodity_name: event.target.value })} required />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Lokasi" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required />
            <div className="grid grid-cols-2 gap-3"><select className="rounded-md border border-slate-300 px-3 py-2" value={form.price_type} onChange={(event) => setForm({ ...form, price_type: event.target.value })}><option value="farm">Ladang</option><option value="retail">Runcit</option><option value="wholesale">Borong</option></select><select className="rounded-md border border-slate-300 px-3 py-2" value={form.trend} onChange={(event) => setForm({ ...form, trend: event.target.value })}><option value="stable">Stabil</option><option value="up">Naik</option><option value="down">Turun</option></select></div>
            <div className="grid grid-cols-3 gap-3"><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Harga" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /><input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={form.recorded_date} onChange={(event) => setForm({ ...form, recorded_date: event.target.value })} required /></div>
            <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingPrice}>{isSavingPrice ? "Menyimpan..." : "Simpan harga"}</button>
          </form>
          <form onSubmit={submitCsv} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Import CSV</h3>
            <p className="text-sm text-slate-600">Required columns: commodity_name, location, price_type, price, unit, recorded_date. Optional: trend. Price type boleh guna farm, wholesale, atau retail.</p>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} required />
            <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isImportingCsv}>{isImportingCsv ? "Mengimport..." : "Import CSV"}</button>
          </form>
        </div>
      )}

      <section className="scroll-mt-24 rounded-lg border border-field-100 bg-white p-4 shadow-sm" id="senarai-harga-pasaran">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Senarai harga pasaran</h3>
            <p className="mt-1 text-sm text-slate-600">Paparan jadual lebih padat untuk semak banyak rekod harga.</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={`${visiblePrices.length} dipaparkan`} tone="success" />
            <StatusBadge label={`${prices.length} rekod`} tone="info" />
          </div>
        </div>
        {prices.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Tiada harga pasaran sepadan dengan filter ini. Kosongkan medan atau tekan Reset.</p>
        ) : (
          <>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="max-h-[560px] overflow-auto">
                <table className="min-w-[760px] w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-field-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Komoditi</th>
                      <th className="px-4 py-3 font-semibold">Jenis harga</th>
                      <th className="px-4 py-3 text-right font-semibold">Harga</th>
                      <th className="px-4 py-3 font-semibold">Lokasi</th>
                      <th className="px-4 py-3 font-semibold">Tarikh</th>
                      <th className="px-4 py-3 font-semibold">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {visiblePrices.map((price) => <PriceRow key={price.id} price={price} />)}
                  </tbody>
                </table>
              </div>
            </div>
            {recordLimit < prices.length && (
              <button className="mt-4 w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => setRecordLimit((currentLimit) => currentLimit + INITIAL_RECORD_LIMIT)}>
                Papar lebih banyak rekod
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function PriceTypeButton({ label, description, value, currentValue, onSelect }: { label: string; description: string; value: string; currentValue: string; onSelect: (value: string) => void }) {
  const isActive = currentValue === value;
  return (
    <button className={`rounded-lg border p-4 text-left transition ${isActive ? "border-field-700 bg-field-700 text-white shadow-sm" : "border-field-100 bg-field-50 text-slate-900 hover:border-field-300"}`} type="button" onClick={() => onSelect(value)}>
      <span className="block text-base font-semibold">{label}</span>
      <span className={`mt-1 block text-sm ${isActive ? "text-field-50" : "text-slate-600"}`}>{description}</span>
    </button>
  );
}

function PriceRow({ price }: { price: MarketPrice }) {
  return (
    <tr className="hover:bg-field-50/60">
      <td className="px-4 py-3 font-semibold text-slate-950">{price.commodity_name}</td>
      <td className="px-4 py-3 text-slate-700">{priceTypeLabel(price.price_type)}</td>
      <td className="px-4 py-3 text-right font-bold text-slate-950">RM {price.price}</td>
      <td className="px-4 py-3 text-slate-700">{price.location}</td>
      <td className="px-4 py-3 text-slate-600">{price.recorded_date}</td>
      <td className="px-4 py-3"><StatusBadge label={trendLabel(price.trend)} tone={price.trend === "up" ? "success" : price.trend === "down" ? "warning" : "info"} /></td>
    </tr>
  );
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function buildWeekOptions(dates: string[]) {
  const weekMap = new Map<string, { from: string; to: string }>();

  dates.filter(Boolean).forEach((dateValue) => {
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;

    const day = date.getDay() === 0 ? 7 : date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const from = formatDateInput(monday);
    const to = formatDateInput(sunday);
    weekMap.set(`${from}|${to}`, { from, to });
  });

  return Array.from(weekMap.entries())
    .sort((left, right) => right[1].from.localeCompare(left[1].from))
    .map(([value, week]) => ({ value, label: `${formatDisplayDate(week.from)} - ${formatDisplayDate(week.to)}` }));
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function priceTypeLabel(priceType: string) {
  const labels: Record<string, string> = {
    farm: "Ladang",
    wholesale: "Borong",
    retail: "Runcit",
  };
  return labels[priceType] ?? priceType;
}

function trendLabel(trend: string) {
  const labels: Record<string, string> = {
    up: "Naik",
    down: "Turun",
    stable: "Stabil",
  };
  return labels[trend] ?? trend;
}
