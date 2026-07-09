import { useEffect, useMemo, useState } from "react";

import { createHarvest, deleteHarvest, listHarvests, updateHarvest } from "../../api/finance";
import { listActivities, listPlantingRecords } from "../../api/monitoring";
import { StatusBadge } from "../../components/StatusBadge";
import type { Harvest } from "../../types/finance";
import type { Activity, PlantingRecord } from "../../types/monitoring";

type FinancePageProps = { token: string };
type HarvestFormState = { harvest_date: string; quantity: string; unit: string; selling_price_per_unit: string; notes: string };

const emptyHarvestForm: HarvestFormState = { harvest_date: "", quantity: "", unit: "kg", selling_price_per_unit: "", notes: "" };

export function FinancePage({ token }: FinancePageProps) {
  const [records, setRecords] = useState<PlantingRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [editingHarvestId, setEditingHarvestId] = useState<number | null>(null);
  const [openHarvestMenuId, setOpenHarvestMenuId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [harvestFormMessage, setHarvestFormMessage] = useState("");
  const [harvestListMessage, setHarvestListMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHarvest, setIsSavingHarvest] = useState(false);
  const [isSavingHarvestEdit, setIsSavingHarvestEdit] = useState(false);
  const [harvestForm, setHarvestForm] = useState<HarvestFormState>(emptyHarvestForm);
  const [editHarvestForm, setEditHarvestForm] = useState<HarvestFormState>(emptyHarvestForm);

  async function loadData() {
    setError("");
    setIsLoading(true);
    try {
      const [recordData, activityData, harvestData] = await Promise.all([
        listPlantingRecords(token),
        listActivities(token),
        listHarvests(token),
      ]);
      setRecords(recordData);
      setActivities(activityData);
      setHarvests(harvestData);
      setSelectedRecordId((currentId) => currentId || String(recordData[0]?.id ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load finance data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const selectedRecord = records.find((record) => String(record.id) === selectedRecordId) ?? null;
  const selectedActivities = useMemo(
    () => activities.filter((activity) => String(activity.planting_record_id) === selectedRecordId),
    [activities, selectedRecordId],
  );
  const selectedHarvests = useMemo(
    () => harvests.filter((harvest) => String(harvest.planting_record_id) === selectedRecordId),
    [harvests, selectedRecordId],
  );

  const totalCost = selectedActivities.reduce((total, activity) => total + getActivityTotalCost(activity), 0);
  const totalRevenue = selectedHarvests.reduce((total, harvest) => total + toNumber(harvest.revenue), 0);
  const profitLoss = totalRevenue - totalCost;

  function resetInlineHarvestEdit() {
    setEditingHarvestId(null);
    setEditHarvestForm(emptyHarvestForm);
    setOpenHarvestMenuId(null);
  }

  async function submitHarvest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecordId) {
      setError("Pilih plot dahulu sebelum simpan hasil tuaian.");
      return;
    }

    setError("");
    setHarvestFormMessage("");
    setHarvestListMessage("");
    setIsSavingHarvest(true);
    try {
      const savedHarvest = await createHarvest(token, { ...harvestForm, planting_record_id: Number(selectedRecordId) });
      setHarvests((currentHarvests) => [savedHarvest, ...currentHarvests.filter((harvest) => harvest.id !== savedHarvest.id)]);
      setHarvestForm(emptyHarvestForm);
      setHarvestFormMessage("Hasil tuaian berjaya disimpan dan jumlah keuntungan sudah dikemas kini.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hasil tuaian gagal disimpan.");
    } finally {
      setIsSavingHarvest(false);
    }
  }

  function startEditHarvest(harvest: Harvest) {
    setEditingHarvestId(harvest.id);
    setEditHarvestForm({
      harvest_date: harvest.harvest_date,
      quantity: harvest.quantity,
      unit: harvest.unit,
      selling_price_per_unit: harvest.selling_price_per_unit,
      notes: harvest.notes ?? "",
    });
    setHarvestFormMessage("");
    setHarvestListMessage("");
    setError("");
    setOpenHarvestMenuId(null);
  }

  async function submitHarvestEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingHarvestId) return;

    const harvestId = editingHarvestId;
    setError("");
    setHarvestFormMessage("");
    setHarvestListMessage("");
    setIsSavingHarvestEdit(true);
    try {
      const savedHarvest = await updateHarvest(token, harvestId, editHarvestForm);
      setHarvests((currentHarvests) => [savedHarvest, ...currentHarvests.filter((harvest) => harvest.id !== savedHarvest.id)]);
      resetInlineHarvestEdit();
      setHarvestListMessage("Hasil tuaian berjaya dikemas kini.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hasil tuaian gagal dikemas kini.");
    } finally {
      setIsSavingHarvestEdit(false);
    }
  }

  async function removeHarvest(harvestId: number) {
    const shouldDelete = window.confirm("Padam rekod hasil tuaian ini?");
    if (!shouldDelete) return;

    setError("");
    setHarvestFormMessage("");
    setHarvestListMessage("");
    setOpenHarvestMenuId(null);
    try {
      await deleteHarvest(token, harvestId);
      setHarvests((currentHarvests) => currentHarvests.filter((harvest) => harvest.id !== harvestId));
      if (editingHarvestId === harvestId) resetInlineHarvestEdit();
      setHarvestListMessage("Rekod hasil tuaian berjaya dipadam.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hasil tuaian gagal dipadam.");
    }
  }

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Loading finance data...</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-1 text-sm font-semibold text-slate-800">
            <span>Pilih plot untuk kira kos dan hasil</span>
            <PlotSelect records={records} value={selectedRecordId} onChange={(value) => { setSelectedRecordId(value); resetInlineHarvestEdit(); }} />
          </label>
          <div className="rounded-md bg-field-50 px-3 py-2 text-sm text-slate-700">
            {selectedRecord ? `${selectedRecord.field_name} - ${selectedRecord.crop.name}` : "Tiada plot dipilih"}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Cost" value={formatCurrency(totalCost)} tone="warning" />
        <SummaryCard label="Revenue" value={formatCurrency(totalRevenue)} tone="success" />
        <SummaryCard label="Profit/Loss" value={formatCurrency(profitLoss)} tone={profitLoss >= 0 ? "success" : "warning"} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Kos aktiviti dari Crop Monitoring</h2>
              <p className="mt-1 text-sm text-slate-600">Kos diambil terus daripada aktiviti ladang untuk plot yang dipilih.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              {formatCurrency(totalCost)}
            </span>
          </div>

          {selectedActivities.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Belum ada aktiviti untuk plot ini.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {selectedActivities.slice(0, 8).map((activity) => (
                <li key={activity.id} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="font-medium text-slate-900">{activity.activity_date} - {activity.activity_type}</span>
                    {activity.description && <span className="block text-xs text-slate-500">{activity.description}</span>}
                  </span>
                  <span className="shrink-0 text-right text-xs text-slate-500">
                    <span className="block">Bahan: {formatCurrency(toNumber(activity.cost_amount))}</span>
                    <span className="block">Buruh: {formatCurrency(toNumber(activity.labor_cost_amount))}</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-950">Total: {formatCurrency(getActivityTotalCost(activity))}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={submitHarvest} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Rekod hasil tuaian</h2>
            <p className="mt-1 text-sm text-slate-600">Hasil ini akan dikira bersama kos aktiviti untuk untung/rugi plot yang dipilih.</p>
          </div>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={harvestForm.harvest_date} onChange={(event) => setHarvestForm({ ...harvestForm, harvest_date: event.target.value })} required />
          <div className="grid grid-cols-3 gap-3">
            <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Kuantiti" value={harvestForm.quantity} onChange={(event) => setHarvestForm({ ...harvestForm, quantity: event.target.value })} required />
            <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Unit" value={harvestForm.unit} onChange={(event) => setHarvestForm({ ...harvestForm, unit: event.target.value })} required />
            <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Harga/unit" value={harvestForm.selling_price_per_unit} onChange={(event) => setHarvestForm({ ...harvestForm, selling_price_per_unit: event.target.value })} required />
          </div>
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Catatan" value={harvestForm.notes} onChange={(event) => setHarvestForm({ ...harvestForm, notes: event.target.value })} />
          <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingHarvest || !selectedRecordId}>
            {isSavingHarvest ? "Saving..." : "Save harvest"}
          </button>
          {harvestFormMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{harvestFormMessage}</p>}
        </form>
      </div>

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Hasil tuaian plot dipilih</h3>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            {formatCurrency(totalRevenue)}
          </span>
        </div>
        {harvestListMessage && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{harvestListMessage}</p>}
        {selectedHarvests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Belum ada hasil tuaian untuk plot ini.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {selectedHarvests.slice(0, 8).map((harvest) => (
              <li key={harvest.id} className="relative py-3">
                {editingHarvestId === harvest.id ? (
                  <form onSubmit={submitHarvestEdit} className="space-y-2 rounded-md bg-field-50 p-3">
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={editHarvestForm.harvest_date} onChange={(event) => setEditHarvestForm({ ...editHarvestForm, harvest_date: event.target.value })} required />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Kuantiti" value={editHarvestForm.quantity} onChange={(event) => setEditHarvestForm({ ...editHarvestForm, quantity: event.target.value })} required />
                      <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Unit" value={editHarvestForm.unit} onChange={(event) => setEditHarvestForm({ ...editHarvestForm, unit: event.target.value })} required />
                      <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Harga/unit" value={editHarvestForm.selling_price_per_unit} onChange={(event) => setEditHarvestForm({ ...editHarvestForm, selling_price_per_unit: event.target.value })} required />
                    </div>
                    <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Catatan" value={editHarvestForm.notes} onChange={(event) => setEditHarvestForm({ ...editHarvestForm, notes: event.target.value })} />
                    <div className="flex gap-2">
                      <button className="rounded-md bg-field-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingHarvestEdit}>{isSavingHarvestEdit ? "Menyimpan..." : "Simpan"}</button>
                      <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" type="button" onClick={resetInlineHarvestEdit}>Batal</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      <span className="font-medium text-slate-900">{harvest.harvest_date} - {harvest.quantity} {harvest.unit}</span>
                      <span className="block text-xs text-slate-500">Harga/unit: RM {harvest.selling_price_per_unit}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-semibold text-slate-950">{formatCurrency(toNumber(harvest.revenue))}</span>
                      <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" type="button" onClick={() => setOpenHarvestMenuId(openHarvestMenuId === harvest.id ? null : harvest.id)} aria-label="Menu hasil tuaian">
                        ...
                      </button>
                    </span>
                    {openHarvestMenuId === harvest.id && (
                      <div className="absolute right-0 top-10 z-20 w-36 rounded-lg border border-slate-100 bg-white p-2 text-sm shadow-lg">
                        <button className="block w-full rounded-md px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => startEditHarvest(harvest)}>Edit</button>
                        <button className="block w-full rounded-md px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => void removeHarvest(harvest.id)}>Padam</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlotSelect({ records, value, onChange }: { records: PlantingRecord[]; value: string; onChange: (value: string) => void }) {
  return (
    <select className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Select plot</option>
      {records.map((record) => (
        <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>
      ))}
    </select>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "info" | "success" | "warning" }) {
  return <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-600">{label}</p><StatusBadge label={tone} tone={tone} /></div><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p></article>;
}

function getActivityTotalCost(activity: Activity) {
  return toNumber(activity.cost_amount) + toNumber(activity.labor_cost_amount);
}

function toNumber(value: string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return `RM ${value.toFixed(2)}`;
}


