import { useEffect, useState } from "react";

import { createCost, createHarvest, getFinanceSummary, listCosts, listHarvests } from "../../api/finance";
import { listPlantingRecords } from "../../api/monitoring";
import { StatusBadge } from "../../components/StatusBadge";
import type { Cost, Harvest, ProfitLossSummary } from "../../types/finance";
import type { PlantingRecord } from "../../types/monitoring";

type FinancePageProps = { token: string };

export function FinancePage({ token }: FinancePageProps) {
  const [records, setRecords] = useState<PlantingRecord[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [summary, setSummary] = useState<ProfitLossSummary | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [isSavingHarvest, setIsSavingHarvest] = useState(false);
  const [costForm, setCostForm] = useState({ planting_record_id: "", cost_type: "", amount: "", cost_date: "", notes: "" });
  const [harvestForm, setHarvestForm] = useState({ planting_record_id: "", harvest_date: "", quantity: "", unit: "kg", selling_price_per_unit: "", notes: "" });

  async function loadData() {
    setError("");
    setIsLoading(true);
    try {
      const [recordData, costData, harvestData, summaryData] = await Promise.all([
        listPlantingRecords(token), listCosts(token), listHarvests(token), getFinanceSummary(token),
      ]);
      setRecords(recordData);
      setCosts(costData);
      setHarvests(harvestData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load finance data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);

  async function submitCost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSavingCost(true);
    try {
      const savedCost = await createCost(token, { ...costForm, planting_record_id: Number(costForm.planting_record_id) });
      setCosts((currentCosts) => [savedCost, ...currentCosts.filter((cost) => cost.id !== savedCost.id)]);
      setCostForm({ planting_record_id: "", cost_type: "", amount: "", cost_date: "", notes: "" });
      setSummary(await getFinanceSummary(token));
      setSuccessMessage("Kos berjaya disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kos gagal disimpan.");
    } finally {
      setIsSavingCost(false);
    }
  }

  async function submitHarvest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSavingHarvest(true);
    try {
      const savedHarvest = await createHarvest(token, { ...harvestForm, planting_record_id: Number(harvestForm.planting_record_id) });
      setHarvests((currentHarvests) => [savedHarvest, ...currentHarvests.filter((harvest) => harvest.id !== savedHarvest.id)]);
      setHarvestForm({ planting_record_id: "", harvest_date: "", quantity: "", unit: "kg", selling_price_per_unit: "", notes: "" });
      setSummary(await getFinanceSummary(token));
      setSuccessMessage("Hasil tuaian berjaya disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hasil tuaian gagal disimpan.");
    } finally {
      setIsSavingHarvest(false);
    }
  }

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Loading finance data...</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {successMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>}
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Cost" value={`RM ${summary?.total_cost ?? "0"}`} tone="warning" />
        <SummaryCard label="Revenue" value={`RM ${summary?.total_revenue ?? "0"}`} tone="success" />
        <SummaryCard label="Profit/Loss" value={`RM ${summary?.profit_loss ?? "0"}`} tone={Number(summary?.profit_loss ?? 0) >= 0 ? "success" : "warning"} />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <form onSubmit={submitCost} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Record cost</h2>
          <PlotSelect records={records} value={costForm.planting_record_id} onChange={(value) => setCostForm({ ...costForm, planting_record_id: value })} />
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Cost type" value={costForm.cost_type} onChange={(event) => setCostForm({ ...costForm, cost_type: event.target.value })} required />
          <div className="grid grid-cols-2 gap-3"><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Amount" value={costForm.amount} onChange={(event) => setCostForm({ ...costForm, amount: event.target.value })} required /><input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={costForm.cost_date} onChange={(event) => setCostForm({ ...costForm, cost_date: event.target.value })} required /></div>
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Notes" value={costForm.notes} onChange={(event) => setCostForm({ ...costForm, notes: event.target.value })} />
          <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingCost}>{isSavingCost ? "Saving..." : "Save cost"}</button>
        </form>

        <form onSubmit={submitHarvest} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Record harvest</h2>
          <PlotSelect records={records} value={harvestForm.planting_record_id} onChange={(value) => setHarvestForm({ ...harvestForm, planting_record_id: value })} />
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={harvestForm.harvest_date} onChange={(event) => setHarvestForm({ ...harvestForm, harvest_date: event.target.value })} required />
          <div className="grid grid-cols-3 gap-3"><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Quantity" value={harvestForm.quantity} onChange={(event) => setHarvestForm({ ...harvestForm, quantity: event.target.value })} required /><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Unit" value={harvestForm.unit} onChange={(event) => setHarvestForm({ ...harvestForm, unit: event.target.value })} required /><input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Price/unit" value={harvestForm.selling_price_per_unit} onChange={(event) => setHarvestForm({ ...harvestForm, selling_price_per_unit: event.target.value })} required /></div>
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Notes" value={harvestForm.notes} onChange={(event) => setHarvestForm({ ...harvestForm, notes: event.target.value })} />
          <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingHarvest}>{isSavingHarvest ? "Saving..." : "Save harvest"}</button>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <List title="Recent costs" items={costs.map((item) => `${item.cost_date} - ${item.cost_type}: RM ${item.amount}`)} />
        <List title="Recent harvests" items={harvests.map((item) => `${item.harvest_date} - ${item.quantity} ${item.unit}: RM ${item.revenue}`)} />
      </section>
    </div>
  );
}

function PlotSelect({ records, value, onChange }: { records: PlantingRecord[]; value: string; onChange: (value: string) => void }) {
  return <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select plot</option>{records.map((record) => <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>)}</select>;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "info" | "success" | "warning" }) {
  return <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-600">{label}</p><StatusBadge label={tone} tone={tone} /></div><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p></article>;
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm"><h3 className="font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-2 text-sm text-slate-600">No records yet.</p> : <ul className="mt-3 space-y-2 text-sm text-slate-700">{items.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>}</div>;
}