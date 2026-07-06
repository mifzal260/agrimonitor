import { useEffect, useState } from "react";

import { createMarketPrice, importMarketPricesCsv, listLatestMarketPrices, listMarketPrices } from "../../api/marketPrices";
import { StatusBadge } from "../../components/StatusBadge";
import type { User } from "../../types/auth";
import type { MarketPrice } from "../../types/marketPrice";

type MarketPricePageProps = {
  token: string;
  user: User;
};

export function MarketPricePage({ token, user }: MarketPricePageProps) {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [latestPrices, setLatestPrices] = useState<MarketPrice[]>([]);
  const [filters, setFilters] = useState({ commodity_name: "", location: "", price_type: "", date_from: "", date_to: "" });
  const [form, setForm] = useState({ commodity_name: "", location: "", price_type: "retail", price: "", unit: "kg", recorded_date: "", trend: "stable" });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    setError("");
    setIsLoading(true);
    try {
      const [priceData, latestData] = await Promise.all([listMarketPrices(token, filters), listLatestMarketPrices(token)]);
      setPrices(priceData);
      setLatestPrices(latestData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load market prices");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadData();
  }

  async function submitPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    await createMarketPrice(token, form);
    setForm({ commodity_name: "", location: "", price_type: "retail", price: "", unit: "kg", recorded_date: "", trend: "stable" });
    setMessage("Market price saved.");
    await loadData();
  }

  async function submitCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csvFile) return;
    const result = await importMarketPricesCsv(token, csvFile);
    setCsvFile(null);
    setMessage(`CSV imported: ${result.imported} rows, skipped ${result.skipped}.`);
    await loadData();
  }

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Loading market prices...</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Market prices</h2>
            <p className="mt-1 text-sm text-slate-600">Review demo commodity prices and filter by commodity, location, type, and date.</p>
          </div>
          <StatusBadge label={`${latestPrices.length} latest`} tone="info" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {latestPrices.slice(0, 3).map((price) => <PriceCard key={price.id} price={price} />)}
        </div>
      </section>

      <form onSubmit={applyFilters} className="grid gap-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm md:grid-cols-5">
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Commodity" value={filters.commodity_name} onChange={(event) => setFilters({ ...filters, commodity_name: event.target.value })} />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Location" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
        <select className="rounded-md border border-slate-300 px-3 py-2" value={filters.price_type} onChange={(event) => setFilters({ ...filters, price_type: event.target.value })}>
          <option value="">All types</option><option value="retail">Retail</option><option value="wholesale">Wholesale</option>
        </select>
        <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} />
        <button className="rounded-md bg-field-700 px-4 py-2 text-sm font-semibold text-white" type="submit">Filter</button>
      </form>

      {user.role === "admin" && (
        <div className="grid gap-5 md:grid-cols-2">
          <form onSubmit={submitPrice} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Add market price</h3>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Commodity" value={form.commodity_name} onChange={(event) => setForm({ ...form, commodity_name: event.target.value })} required />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required />
            <div className="grid grid-cols-2 gap-3"><select className="rounded-md border border-slate-300 px-3 py-2" value={form.price_type} onChange={(event) => setForm({ ...form, price_type: event.target.value })}><option value="retail">Retail</option><option value="wholesale">Wholesale</option></select><select className="rounded-md border border-slate-300 px-3 py-2" value={form.trend} onChange={(event) => setForm({ ...form, trend: event.target.value })}><option value="stable">Stable</option><option value="up">Up</option><option value="down">Down</option></select></div>
            <div className="grid grid-cols-3 gap-3"><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Price" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /><input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={form.recorded_date} onChange={(event) => setForm({ ...form, recorded_date: event.target.value })} required /></div>
            <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white" type="submit">Save price</button>
          </form>
          <form onSubmit={submitCsv} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Import CSV</h3>
            <p className="text-sm text-slate-600">Required columns: commodity_name, location, price_type, price, unit, recorded_date. Optional: trend.</p>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} required />
            <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white" type="submit">Import CSV</button>
          </form>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {prices.map((price) => <PriceCard key={price.id} price={price} />)}
      </section>
    </div>
  );
}

function PriceCard({ price }: { price: MarketPrice }) {
  return (
    <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{price.commodity_name}</h3><StatusBadge label={price.trend} tone={price.trend === "up" ? "success" : price.trend === "down" ? "warning" : "info"} /></div>
      <p className="mt-2 text-2xl font-bold">RM {price.price}</p>
      <p className="text-sm text-slate-600">per {price.unit} - {price.price_type}</p>
      <p className="mt-2 text-sm text-slate-700">{price.location}</p>
      <p className="text-xs text-slate-500">{price.recorded_date}</p>
    </article>
  );
}