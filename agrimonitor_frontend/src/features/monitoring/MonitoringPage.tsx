import { useEffect, useMemo, useState } from "react";

import { createActivity, createPlantingRecord, createSymptomRecord, listActivities, listCrops, listPlantingRecords, listSymptoms, listSymptomRecords } from "../../api/monitoring";
import { evaluatePlantingRecord, listAlerts } from "../../api/recommendations";
import { StatusBadge } from "../../components/StatusBadge";
import type { Activity, Crop, PlantingRecord, Symptom, SymptomRecord } from "../../types/monitoring";
import type { Alert, RecommendationResult } from "../../types/recommendation";

type MonitoringPageProps = { token: string };

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
    await createPlantingRecord(token, { ...plantingForm, crop_id: Number(plantingForm.crop_id) });
    setPlantingForm({ crop_id: "", field_name: "", planting_date: "", area_size: "", status: "healthy", notes: "" });
    await loadData();
  }

  async function submitActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createActivity(token, { ...activityForm, planting_record_id: Number(activityForm.planting_record_id) });
    setActivityForm({ planting_record_id: "", activity_type: "", activity_date: "", description: "", cost_amount: "" });
    await loadData();
  }

  async function submitSymptom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await createSymptomRecord(token, {
      ...symptomForm,
      planting_record_id: Number(symptomForm.planting_record_id),
      symptom_id: Number(symptomForm.symptom_id),
    });
    setSymptomForm({ planting_record_id: "", symptom_id: "", severity: "low", notes: "", image_url: "" });
    await evaluate(saved.planting_record_id);
    await loadData();
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

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Crop monitoring</h2>
            <p className="mt-1 text-sm text-slate-600">Track planting age, field status, activities, symptoms, and rule-based risk.</p>
          </div>
          <StatusBadge label={`${records.length} plots`} tone="success" />
        </div>
        {latestRecord && <p className="mt-3 text-sm text-slate-700">Latest: {latestRecord.crop.name} at {latestRecord.field_name}, age {latestRecord.plant_age_days} days.</p>}
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
        <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Field name" value={plantingForm.field_name} onChange={(event) => setPlantingForm({ ...plantingForm, field_name: event.target.value })} required />
        <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={plantingForm.planting_date} onChange={(event) => setPlantingForm({ ...plantingForm, planting_date: event.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Area" value={plantingForm.area_size} onChange={(event) => setPlantingForm({ ...plantingForm, area_size: event.target.value })} />
          <select className="rounded-md border border-slate-300 px-3 py-2" value={plantingForm.status} onChange={(event) => setPlantingForm({ ...plantingForm, status: event.target.value })}><option value="healthy">Healthy</option><option value="watch">Watch</option><option value="risk">Risk</option><option value="harvested">Harvested</option></select>
        </div>
        <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Notes" value={plantingForm.notes} onChange={(event) => setPlantingForm({ ...plantingForm, notes: event.target.value })} />
        <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white" type="submit">Save planting record</button>
      </form>

      {hasRecords && <div className="grid gap-5 md:grid-cols-2"><ActivityForm records={records} form={activityForm} setForm={setActivityForm} onSubmit={submitActivity} /><SymptomForm records={records} symptoms={symptoms} form={symptomForm} setForm={setSymptomForm} onSubmit={submitSymptom} /></div>}

      <section className="grid gap-4 md:grid-cols-3">
        {records.map((record) => (
          <article key={record.id} className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{record.field_name}</h3><StatusBadge label={record.status} tone={record.status === "risk" ? "warning" : "success"} /></div>
            <p className="mt-2 text-sm text-slate-700">{record.crop.name}</p><p className="text-sm text-slate-600">Age: {record.plant_age_days} days</p>
            <button className="mt-3 w-full rounded-md border border-field-700 px-3 py-2 text-sm font-semibold text-field-700 disabled:opacity-60" type="button" disabled={isEvaluating} onClick={() => evaluate(record.id)}>{isEvaluating ? "Evaluating..." : "Evaluate risk"}</button>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2"><List title="Recent activities" items={activities.map((item) => `${item.activity_date} - ${item.activity_type}`)} /><List title="Recent symptoms" items={symptomRecords.map((item) => `${item.symptom.name} - ${item.severity}`)} /></section>
    </div>
  );
}

function ActivityForm({ records, form, setForm, onSubmit }: { records: PlantingRecord[]; form: { planting_record_id: string; activity_type: string; activity_date: string; description: string; cost_amount: string }; setForm: (form: { planting_record_id: string; activity_type: string; activity_date: string; description: string; cost_amount: string }) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm"><h3 className="font-semibold">Record activity</h3><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.planting_record_id} onChange={(event) => setForm({ ...form, planting_record_id: event.target.value })} required><option value="">Select plot</option>{records.map((record) => <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>)}</select><input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Activity type" value={form.activity_type} onChange={(event) => setForm({ ...form, activity_type: event.target.value })} required /><input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={form.activity_date} onChange={(event) => setForm({ ...form, activity_date: event.target.value })} required /><input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Cost amount" value={form.cost_amount} onChange={(event) => setForm({ ...form, cost_amount: event.target.value })} /><textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white" type="submit">Save activity</button></form>;
}

function SymptomForm({ records, symptoms, form, setForm, onSubmit }: { records: PlantingRecord[]; symptoms: Symptom[]; form: { planting_record_id: string; symptom_id: string; severity: string; notes: string; image_url: string }; setForm: (form: { planting_record_id: string; symptom_id: string; severity: string; notes: string; image_url: string }) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm"><h3 className="font-semibold">Record symptom</h3><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.planting_record_id} onChange={(event) => setForm({ ...form, planting_record_id: event.target.value })} required><option value="">Select plot</option>{records.map((record) => <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>)}</select><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.symptom_id} onChange={(event) => setForm({ ...form, symptom_id: event.target.value })} required><option value="">Select symptom</option>{symptoms.map((symptom) => <option key={symptom.id} value={symptom.id}>{symptom.name}</option>)}</select><select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Image URL optional" value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} /><textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /><button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white" type="submit">Save symptom</button></form>;
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm"><h3 className="font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-2 text-sm text-slate-600">No records yet.</p> : <ul className="mt-3 space-y-2 text-sm text-slate-700">{items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>}</div>;
}