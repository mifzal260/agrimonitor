import { useEffect, useMemo, useState } from "react";

import { createActivity, createPlantingRecord, createSymptomRecord, listActivities, listCrops, listPlantingRecords, listSymptoms, listSymptomRecords } from "../../api/monitoring";
import { evaluatePlantingRecord, listAlerts } from "../../api/recommendations";
import { StatusBadge } from "../../components/StatusBadge";
import type { Activity, Crop, PlantingRecord, Symptom, SymptomRecord } from "../../types/monitoring";
import type { Alert, RecommendationResult } from "../../types/recommendation";

type MonitoringPageProps = { token: string };

function normalizeDecimalInput(value: string) {
  return value.trim().replace(",", ".");
}

function isValidDecimal(value: string) {
  return value === "" || /^\d+(\.\d+)?$/.test(value);
}

function plantStatusLabel(status: string) {
  const labels: Record<string, string> = {
    healthy: "Sihat",
    watch: "Perlu pantau",
    risk: "Bermasalah",
    harvested: "Sudah dituai",
  };
  return labels[status] ?? status;
}

function plantStatusTone(status: string): "success" | "warning" {
  return status === "risk" || status === "watch" ? "warning" : "success";
}

function toCurrency(value: string | null) {
  const amount = Number(value ?? 0);
  return `RM ${amount.toFixed(2)}`;
}

function totalActivityCost(activities: Activity[]) {
  return activities.reduce((total, activity) => total + Number(activity.cost_amount ?? 0), 0);
}

export function MonitoringPage({ token }: MonitoringPageProps) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [records, setRecords] = useState<PlantingRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [symptomRecords, setSymptomRecords] = useState<SymptomRecord[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSavingPlanting, setIsSavingPlanting] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isSavingSymptom, setIsSavingSymptom] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [plantingForm, setPlantingForm] = useState({ crop_id: "", field_name: "", planting_date: "", area_size: "", status: "healthy", notes: "" });
  const [activityForm, setActivityForm] = useState({ planting_record_id: "", activity_type: "", activity_date: "", description: "", cost_amount: "" });
  const [symptomForm, setSymptomForm] = useState({ planting_record_id: "", symptom_id: "", severity: "low", notes: "", image_url: "" });

  const hasRecords = records.length > 0;
  const latestRecord = useMemo(() => records[0], [records]);

  async function loadData() {
    setError("");
    setIsLoading(true);
    try {
      const [cropData, symptomData, recordData, activityData, symptomRecordData, alertData] = await Promise.all([
        listCrops(token), listSymptoms(token), listPlantingRecords(token), listActivities(token), listSymptomRecords(token), listAlerts(token),
      ]);
      setCrops(cropData);
      setSymptoms(symptomData);
      setRecords(recordData);
      setActivities(activityData);
      setSymptomRecords(symptomRecordData);
      setAlerts(alertData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load monitoring data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);

  async function submitPlantingRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const areaSize = normalizeDecimalInput(plantingForm.area_size);
    if (!isValidDecimal(areaSize)) {
      setError("Masukkan luas kawasan dalam nombor sahaja, contoh 0.5.");
      return;
    }

    setIsSavingPlanting(true);
    try {
      const savedRecord = await createPlantingRecord(token, {
        ...plantingForm,
        crop_id: Number(plantingForm.crop_id),
        field_name: plantingForm.field_name.trim(),
        area_size: areaSize,
        notes: plantingForm.notes.trim(),
      });
      setRecords((currentRecords) => [savedRecord, ...currentRecords.filter((record) => record.id !== savedRecord.id)]);
      setPlantingForm({ crop_id: "", field_name: "", planting_date: "", area_size: "", status: "healthy", notes: "" });
      setSuccessMessage(`Rekod ${savedRecord.field_name} berjaya disimpan dan sudah muncul di senarai bawah.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rekod tanaman gagal disimpan.");
    } finally {
      setIsSavingPlanting(false);
    }
  }

  async function submitActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSavingActivity(true);
    try {
      const savedActivity = await createActivity(token, { ...activityForm, planting_record_id: Number(activityForm.planting_record_id) });
      setActivities((currentActivities) => [savedActivity, ...currentActivities.filter((activity) => activity.id !== savedActivity.id)]);
      setActivityForm({ planting_record_id: "", activity_type: "", activity_date: "", description: "", cost_amount: "" });
      setSuccessMessage("Aktiviti ladang berjaya disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktiviti ladang gagal disimpan.");
    } finally {
      setIsSavingActivity(false);
    }
  }

  async function submitSymptom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSavingSymptom(true);
    try {
      const saved = await createSymptomRecord(token, {
        ...symptomForm,
        planting_record_id: Number(symptomForm.planting_record_id),
        symptom_id: Number(symptomForm.symptom_id),
      });
      setSymptomRecords((currentRecords) => [saved, ...currentRecords.filter((record) => record.id !== saved.id)]);
      setSymptomForm({ planting_record_id: "", symptom_id: "", severity: "low", notes: "", image_url: "" });
      setSuccessMessage("Pemerhatian simptom berjaya disimpan.");
      await evaluate(saved.planting_record_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pemerhatian simptom gagal disimpan.");
    } finally {
      setIsSavingSymptom(false);
    }
  }

  async function evaluate(recordId: number) {
    setError("");
    setIsEvaluating(true);
    try {
      const result = await evaluatePlantingRecord(token, recordId);
      setRecommendation(result);
      setAlerts(await listAlerts(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to evaluate risk");
    } finally {
      setIsEvaluating(false);
    }
  }

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">Loading monitoring data...</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {successMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>}

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Crop monitoring</h2>
            <p className="mt-1 text-sm text-slate-600">Track planting age, field status, activities, symptoms, and rule-based risk.</p>
          </div>
          <StatusBadge label={`${records.length} plots`} tone="success" />
        </div>
        {latestRecord && <p className="mt-3 text-sm text-slate-700">Latest: {latestRecord.crop.name} at {latestRecord.field_name}, {latestRecord.plant_age_days} HST.</p>}
      </section>

      {alerts.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">High risk alerts</h3>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {alerts.slice(0, 3).map((alert) => <li key={alert.id}>{alert.message}</li>)}
          </ul>
        </section>
      )}

      {recommendation && (
        <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Recommendation result</h3>
            <StatusBadge label={recommendation.highest_risk_level} tone={recommendation.highest_risk_level === "high" ? "warning" : "info"} />
          </div>
          {recommendation.matches.length === 0 ? <p className="mt-2 text-sm text-slate-600">No matching disease rule found from current symptoms.</p> : (
            <div className="mt-3 space-y-3">
              {recommendation.matches.map((match) => (
                <article key={match.disease_rule_id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{match.disease_name}</p>
                    <StatusBadge label={match.risk_level} tone={match.risk_level === "high" ? "warning" : "info"} />
                  </div>
                  <p className="mt-2 text-slate-700">{match.recommendation}</p>
                  <p className="mt-2 text-slate-500">Matched: {match.matched_symptoms.join(", ")}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <form onSubmit={submitPlantingRecord} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Add planting record</h3>
        <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={plantingForm.crop_id} onChange={(event) => setPlantingForm({ ...plantingForm, crop_id: event.target.value })} required>
          <option value="">Select crop</option>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
        </select>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>Nama petak / kawasan</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Contoh: Plot A atau Batas Cili 1" value={plantingForm.field_name} onChange={(event) => setPlantingForm({ ...plantingForm, field_name: event.target.value })} required />
        </label>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>Tarikh tanam (HST)</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={plantingForm.planting_date} onChange={(event) => setPlantingForm({ ...plantingForm, planting_date: event.target.value })} required />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Luas kawasan (hektar)</span>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" placeholder="Contoh: 0.25" value={plantingForm.area_size} onChange={(event) => setPlantingForm({ ...plantingForm, area_size: event.target.value })} />
            <span className="block text-xs font-normal text-slate-500">Masukkan nombor sahaja. Contoh: 0.25 = suku hektar.</span>
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Keadaan tanaman</span>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={plantingForm.status} onChange={(event) => setPlantingForm({ ...plantingForm, status: event.target.value })}><option value="healthy">Sihat</option><option value="watch">Perlu pantau</option><option value="risk">Bermasalah</option><option value="harvested">Sudah dituai</option></select>
            <span className="block text-xs font-normal text-slate-500">Pilih Sihat jika tiada masalah. Guna Perlu pantau jika kurang pasti.</span>
          </label>
        </div>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>Catatan</span>
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Contoh: Demo tanaman cili, 0.25 hektar" value={plantingForm.notes} onChange={(event) => setPlantingForm({ ...plantingForm, notes: event.target.value })} />
        </label>
        <button className="w-full rounded-md bg-field-700 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-field-800 disabled:opacity-60" type="submit" disabled={isSavingPlanting}>{isSavingPlanting ? "Sedang menyimpan..." : "Simpan rekod tanaman"}</button>
        {successMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{successMessage}</p>}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </form>

      {hasRecords && <div className="grid gap-5 md:grid-cols-2"><ActivityForm records={records} form={activityForm} setForm={setActivityForm} onSubmit={submitActivity} isSaving={isSavingActivity} /><SymptomForm records={records} symptoms={symptoms} form={symptomForm} setForm={setSymptomForm} onSubmit={submitSymptom} isSaving={isSavingSymptom} /></div>}

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Senarai rekod tanaman</h3>
          <StatusBadge label={`${records.length} rekod`} tone="info" />
        </div>
        {records.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Belum ada rekod tanaman. Isi borang di atas dan tekan Simpan rekod tanaman.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {records.map((record) => (
              <article key={record.id} className="rounded-lg border border-field-100 bg-field-50 p-4">
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{record.field_name}</h3><StatusBadge label={plantStatusLabel(record.status)} tone={plantStatusTone(record.status)} /></div>
                <p className="mt-2 text-sm text-slate-700">{record.crop.name}</p><p className="text-sm text-slate-600">Umur tanaman (HST): {record.plant_age_days} hari</p>
                <button className="mt-3 w-full rounded-md border border-field-700 px-3 py-2 text-sm font-semibold text-field-700 disabled:opacity-60" type="button" disabled={isEvaluating} onClick={() => evaluate(record.id)}>{isEvaluating ? "Sedang semak..." : "Semak risiko"}</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2"><ActivitySummary activities={activities} /><List title="Recent symptoms" items={symptomRecords.map((item) => `${item.symptom.name} - ${item.severity}`)} /></section>
    </div>
  );
}

function ActivityForm({ records, form, setForm, onSubmit, isSaving }: { records: PlantingRecord[]; form: { planting_record_id: string; activity_type: string; activity_date: string; description: string; cost_amount: string }; setForm: (form: { planting_record_id: string; activity_type: string; activity_date: string; description: string; cost_amount: string }) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; isSaving: boolean }) {
  return <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm"><h3 className="font-semibold">Record activity</h3><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.planting_record_id} onChange={(event) => setForm({ ...form, planting_record_id: event.target.value })} required><option value="">Select plot</option>{records.map((record) => <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>)}</select><input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Activity type" value={form.activity_type} onChange={(event) => setForm({ ...form, activity_type: event.target.value })} required /><input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={form.activity_date} onChange={(event) => setForm({ ...form, activity_date: event.target.value })} required /><input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Cost amount" value={form.cost_amount} onChange={(event) => setForm({ ...form, cost_amount: event.target.value })} /><textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save activity"}</button></form>;
}

function SymptomForm({ records, symptoms, form, setForm, onSubmit, isSaving }: { records: PlantingRecord[]; symptoms: Symptom[]; form: { planting_record_id: string; symptom_id: string; severity: string; notes: string; image_url: string }; setForm: (form: { planting_record_id: string; symptom_id: string; severity: string; notes: string; image_url: string }) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; isSaving: boolean }) {
  return <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm"><h3 className="font-semibold">Record symptom</h3><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.planting_record_id} onChange={(event) => setForm({ ...form, planting_record_id: event.target.value })} required><option value="">Select plot</option>{records.map((record) => <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>)}</select><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.symptom_id} onChange={(event) => setForm({ ...form, symptom_id: event.target.value })} required><option value="">Select symptom</option>{symptoms.map((symptom) => <option key={symptom.id} value={symptom.id}>{symptom.name}</option>)}</select><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Image URL optional" value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} /><textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /><button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save symptom"}</button></form>;
}

function ActivitySummary({ activities }: { activities: Activity[] }) {
  const totalCost = totalActivityCost(activities);
  return (
    <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Recent activities</h3>
        <StatusBadge label={toCurrency(String(totalCost))} tone={totalCost > 0 ? "warning" : "info"} />
      </div>
      {activities.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No records yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 text-sm text-slate-700">
          {activities.slice(0, 5).map((activity) => (
            <li key={activity.id} className="flex items-center justify-between gap-3 py-2">
              <span>{activity.activity_date} - {activity.activity_type}</span>
              <span className="shrink-0 font-semibold text-slate-950">{activity.cost_amount ? toCurrency(activity.cost_amount) : "RM 0.00"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-950">Total kos aktiviti: {toCurrency(String(totalCost))}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm"><h3 className="font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-2 text-sm text-slate-600">No records yet.</p> : <ul className="mt-3 space-y-2 text-sm text-slate-700">{items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>}</div>;
}
