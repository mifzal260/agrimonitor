import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { createActivity, createPlantingRecord, createSymptomRecord, deleteActivity, deletePlantingRecord, deleteSymptomRecord, listActivities, listCrops, listPlantingRecords, listSymptoms, listSymptomRecords, updateActivity, updatePlantingRecord, updateSymptomRecord } from "../../api/monitoring";
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

function plantStatusLabel(status: string, t: (key: string) => string) {
  return t(`status.${status}`) || status;
}

function plantStatusTone(status: string): "success" | "warning" {
  return status === "risk" || status === "watch" ? "warning" : "success";
}

function severityLabel(severity: string, t: (key: string) => string) {
  return t(`status.${severity}`) || severity;
}

function severityTone(severity: string): "info" | "success" | "warning" {
  if (severity === "high" || severity === "medium") return "warning";
  return "info";
}

function symptomActionText(severity: string, t: (key: string) => string) {
  if (severity === "high") return t("cropMonitoring.symptomActionHigh");
  if (severity === "medium") return t("cropMonitoring.symptomActionMedium");
  return t("cropMonitoring.symptomActionLow");
}
function toCurrency(value: string | null) {
  const amount = Number(value ?? 0);
  return `RM ${amount.toFixed(2)}`;
}

function getActivityTotalCost(activity: Activity) {
  return Number(activity.cost_amount ?? 0) + Number(activity.labor_cost_amount ?? 0);
}

function totalActivityCost(activities: Activity[]) {
  return activities.reduce((total, activity) => total + getActivityTotalCost(activity), 0);
}

function capitalizeFirst(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ").toLowerCase();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
}

export function MonitoringPage({ token }: MonitoringPageProps) {
  const { t } = useTranslation();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [records, setRecords] = useState<PlantingRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [symptomRecords, setSymptomRecords] = useState<SymptomRecord[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsEvaluating] = useState(false);
  const [isSavingPlanting, setIsSavingPlanting] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isSavingSymptom, setIsSavingSymptom] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [activitySaveMessage, setActivitySaveMessage] = useState("");
  const [symptomSaveMessage, setSymptomSaveMessage] = useState("");

  const [plantingForm, setPlantingForm] = useState({ crop_id: "", field_name: "", planting_date: "", area_size: "", status: "healthy", notes: "" });
  const [activityForm, setActivityForm] = useState({ planting_record_id: "", activity_type: "", activity_date: "", description: "", cost_amount: "", labor_cost_amount: "" });
  const [symptomForm, setSymptomForm] = useState({ planting_record_id: "", symptom_id: "", severity: "low", observed_at: "", notes: "", image_url: "" });

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
      setError(err instanceof Error ? err.message : t("notifications.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);


  async function refreshPlantingRecords() {
    setRecords(await listPlantingRecords(token));
  }
  async function submitPlantingRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const areaSize = normalizeDecimalInput(plantingForm.area_size);
    if (!isValidDecimal(areaSize)) {
      setError(t("validation.invalidAreaSize"));
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
      setSuccessMessage(t("notifications.plantingSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.saveFailed"));
    } finally {
      setIsSavingPlanting(false);
    }
  }


  async function handleUpdatePlantingRecord(recordId: number, form: { crop_id: string; field_name: string; planting_date: string; area_size: string; status: string; notes: string }) {
    setError("");
    setSuccessMessage("");
    const areaSize = normalizeDecimalInput(form.area_size);
    if (!isValidDecimal(areaSize)) {
      setError(t("validation.invalidAreaSize"));
      return;
    }
    try {
      const updated = await updatePlantingRecord(token, recordId, {
        crop_id: Number(form.crop_id),
        field_name: form.field_name.trim(),
        planting_date: form.planting_date,
        area_size: areaSize,
        status: form.status,
        notes: form.notes.trim(),
      });
      setRecords((currentRecords) => currentRecords.map((record) => record.id === updated.id ? updated : record));
      setSuccessMessage(t("notifications.plantingUpdated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.updateFailed"));
    }
  }

  async function handleDeletePlantingRecord(recordId: number) {
    const confirmed = window.confirm(t("notifications.confirmDeletePlanting"));
    if (!confirmed) return;
    setError("");
    setSuccessMessage("");
    try {
      await deletePlantingRecord(token, recordId);
      setRecords((currentRecords) => currentRecords.filter((record) => record.id !== recordId));
      setActivities((currentActivities) => currentActivities.filter((activity) => activity.planting_record_id !== recordId));
      setSymptomRecords((currentRecords) => currentRecords.filter((record) => record.planting_record_id !== recordId));
      setSuccessMessage(t("notifications.plantingDeleted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.deleteFailed"));
    }
  }
  async function submitActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSavingActivity(true);
    try {
      const savedActivity = await createActivity(token, { ...activityForm, activity_type: capitalizeFirst(activityForm.activity_type), planting_record_id: Number(activityForm.planting_record_id) });
      setActivities((currentActivities) => [savedActivity, ...currentActivities.filter((activity) => activity.id !== savedActivity.id)]);
      setActivityForm({ planting_record_id: "", activity_type: "", activity_date: "", description: "", cost_amount: "", labor_cost_amount: "" });
      setActivitySaveMessage(t("notifications.activitySaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.saveFailed"));
    } finally {
      setIsSavingActivity(false);
    }
  }

  async function handleUpdateActivity(activityId: number, form: { activity_type: string; activity_date: string; description: string; cost_amount: string; labor_cost_amount: string }) {
    setError("");
    setSuccessMessage("");
    try {
      const updated = await updateActivity(token, activityId, { ...form, activity_type: capitalizeFirst(form.activity_type) });
      setActivities((currentActivities) => currentActivities.map((activity) => activity.id === updated.id ? updated : activity));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.updateFailed"));
      throw err;
    }
  }

  async function handleDeleteActivity(activityId: number) {
    const confirmed = window.confirm(t("notifications.confirmDeleteActivity"));
    if (!confirmed) return;
    setError("");
    setSuccessMessage("");
    try {
      await deleteActivity(token, activityId);
      setActivities((currentActivities) => currentActivities.filter((activity) => activity.id !== activityId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.deleteFailed"));
      throw err;
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
        observed_at: new Date(`${symptomForm.observed_at}T12:00:00`).toISOString(),
      });
      setSymptomRecords((currentRecords) => [saved, ...currentRecords.filter((record) => record.id !== saved.id)]);
      setSymptomForm({ planting_record_id: "", symptom_id: "", severity: "low", observed_at: "", notes: "", image_url: "" });
      setSymptomSaveMessage(t("notifications.symptomSaved"));
      await evaluate(saved.planting_record_id);
      await refreshPlantingRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.saveFailed"));
    } finally {
      setIsSavingSymptom(false);
    }
  }


  async function handleUpdateSymptomRecord(symptomRecordId: number, form: { severity: string; observed_at: string; notes: string; image_url: string; status: string; resolved_at?: string | null }) {
    setError("");
    setSuccessMessage("");
    try {
      const updated = await updateSymptomRecord(token, symptomRecordId, {
        severity: form.severity,
        observed_at: new Date(`${form.observed_at}T12:00:00`).toISOString(),
        notes: form.notes.trim(),
        image_url: form.image_url.trim(),
        status: form.status,
        resolved_at: form.resolved_at ?? null,
      });
      setSymptomRecords((currentRecords) => currentRecords.map((record) => record.id === updated.id ? updated : record));
      await refreshPlantingRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.updateFailed"));
      throw err;
    }
  }

  async function handleResolveSymptomRecord(symptomRecordId: number) {
    setError("");
    setSuccessMessage("");
    try {
      const updated = await updateSymptomRecord(token, symptomRecordId, { status: "resolved", resolved_at: new Date().toISOString() });
      setSymptomRecords((currentRecords) => currentRecords.map((record) => record.id === updated.id ? updated : record));
      await refreshPlantingRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.updateFailed"));
      throw err;
    }
  }

  async function handleDeleteSymptomRecord(symptomRecordId: number) {
    const confirmed = window.confirm(t("notifications.confirmDeleteSymptom"));
    if (!confirmed) return;
    setError("");
    setSuccessMessage("");
    try {
      await deleteSymptomRecord(token, symptomRecordId);
      setSymptomRecords((currentRecords) => currentRecords.filter((record) => record.id !== symptomRecordId));
      await refreshPlantingRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.deleteFailed"));
      throw err;
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
      setError(err instanceof Error ? err.message : t("notifications.updateFailed"));
    } finally {
      setIsEvaluating(false);
    }
  }

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">{t("common.loading")}...</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {successMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>}

      <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("cropMonitoring.summaryTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("cropMonitoring.summaryDescription")}</p>
          </div>
          <StatusBadge label={`${records.length} ${t("dashboard.plots").toLowerCase()}`} tone="success" />
        </div>
        {latestRecord && <p className="mt-3 text-sm text-slate-700">{t("cropMonitoring.latest")}: {latestRecord.crop.name} - {latestRecord.field_name}, {latestRecord.plant_age_days} HST.</p>}
      </section>

      {alerts.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">{t("cropMonitoring.highRiskAlerts")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {alerts.slice(0, 3).map((alert) => <li key={alert.id}>{alert.message}</li>)}
          </ul>
        </section>
      )}

      {recommendation && (
        <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{t("cropMonitoring.recommendationResult")}</h3>
            <StatusBadge label={recommendation.highest_risk_level} tone={recommendation.highest_risk_level === "high" ? "warning" : "info"} />
          </div>
          {recommendation.matches.length === 0 ? <p className="mt-2 text-sm text-slate-600">{t("cropMonitoring.noMatchingRule")}</p> : (
            <div className="mt-3 space-y-3">
              {recommendation.matches.map((match) => (
                <article key={match.disease_rule_id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{match.disease_name}</p>
                    <StatusBadge label={match.risk_level} tone={match.risk_level === "high" ? "warning" : "info"} />
                  </div>
                  <p className="mt-2 text-slate-700">{match.recommendation}</p>
                  <p className="mt-2 text-slate-500">{t("cropMonitoring.matched")}: {match.matched_symptoms.join(", ")}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <form onSubmit={submitPlantingRecord} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">{t("cropMonitoring.addPlantingRecord")}</h3>
        <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={plantingForm.crop_id} onChange={(event) => setPlantingForm({ ...plantingForm, crop_id: event.target.value })} required>
          <option value="">{t("cropMonitoring.selectCrop")}</option>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
        </select>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>{t("cropMonitoring.plotName")}</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.plotNamePlaceholder")} value={plantingForm.field_name} onChange={(event) => setPlantingForm({ ...plantingForm, field_name: event.target.value })} required />
        </label>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>{t("cropMonitoring.plantingDate")}</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={plantingForm.planting_date} onChange={(event) => setPlantingForm({ ...plantingForm, planting_date: event.target.value })} required />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>{t("cropMonitoring.areaSize")}</span>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" placeholder="0.25" value={plantingForm.area_size} onChange={(event) => setPlantingForm({ ...plantingForm, area_size: event.target.value })} />
            <span className="block text-xs font-normal text-slate-500">{t("cropMonitoring.areaSizeHelp")}</span>
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>{t("cropMonitoring.plantStatus")}</span>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={plantingForm.status} onChange={(event) => setPlantingForm({ ...plantingForm, status: event.target.value })}><option value="healthy">{t("status.healthy")}</option><option value="watch">{t("status.watch")}</option><option value="risk">{t("status.risk")}</option><option value="harvested">{t("status.harvested")}</option></select>
            <span className="block text-xs font-normal text-slate-500">{t("cropMonitoring.plantStatusHelp")}</span>
          </label>
        </div>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>{t("cropMonitoring.notes")}</span>
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.notesPlaceholder")} value={plantingForm.notes} onChange={(event) => setPlantingForm({ ...plantingForm, notes: event.target.value })} />
        </label>
        <button className="w-full rounded-md bg-field-700 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-field-800 disabled:opacity-60" type="submit" disabled={isSavingPlanting}>{isSavingPlanting ? t("cropMonitoring.saving") : t("cropMonitoring.savePlantingRecord")}</button>
      </form>

      {hasRecords && <div className="grid gap-5 md:grid-cols-2"><ActivityForm records={records} form={activityForm} setForm={setActivityForm} onSubmit={submitActivity} isSaving={isSavingActivity} saveMessage={activitySaveMessage} /><SymptomForm records={records} symptoms={symptoms} form={symptomForm} setForm={setSymptomForm} onSubmit={submitSymptom} isSaving={isSavingSymptom} saveMessage={symptomSaveMessage} /></div>}

      <PlantingRecordList
        records={records}
        crops={crops}
        onUpdate={handleUpdatePlantingRecord}
        onDelete={handleDeletePlantingRecord}
      />

      <section className="grid gap-4 md:grid-cols-2"><ActivitySummary records={records} activities={activities} onUpdate={handleUpdateActivity} onDelete={handleDeleteActivity} /><SymptomSummary records={records} symptomRecords={symptomRecords} onUpdate={handleUpdateSymptomRecord} onResolve={handleResolveSymptomRecord} onDelete={handleDeleteSymptomRecord} /></section>
    </div>
  );
}

function PlantingRecordList({ records, crops, onUpdate, onDelete }: { records: PlantingRecord[]; crops: Crop[]; onUpdate: (recordId: number, form: { crop_id: string; field_name: string; planting_date: string; area_size: string; status: string; notes: string }) => Promise<void>; onDelete: (recordId: number) => Promise<void> }) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ crop_id: "", field_name: "", planting_date: "", area_size: "", status: "healthy", notes: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  function startEdit(record: PlantingRecord) {
    setOpenMenuId(null);
    setEditingId(record.id);
    setEditForm({ crop_id: String(record.crop_id), field_name: record.field_name, planting_date: record.planting_date, area_size: record.area_size ?? "", status: record.status, notes: record.notes ?? "" });
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const recordId = editingId;
    const nextForm = editForm;
    setEditingId(null);
    setOpenMenuId(null);
    setIsSavingEdit(true);
    try {
      await onUpdate(recordId, nextForm);
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t("cropMonitoring.plantingRecordList")}</h3>
        <StatusBadge label={`${records.length} rekod`} tone="info" />
      </div>
      {records.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{t("cropMonitoring.noPlantingRecords")}</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {records.map((record) => (
            <article key={record.id} className="rounded-lg border border-field-100 bg-field-50 p-4">
              {editingId === record.id ? (
                <form onSubmit={submitEdit} className="space-y-2">
                  <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.crop_id} onChange={(event) => setEditForm({ ...editForm, crop_id: event.target.value })} required>
                    <option value="">{t("cropMonitoring.selectCrop")}</option>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
                  </select>
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder={t("cropMonitoring.plotName")} value={editForm.field_name} onChange={(event) => setEditForm({ ...editForm, field_name: event.target.value })} required />
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={editForm.planting_date} onChange={(event) => setEditForm({ ...editForm, planting_date: event.target.value })} required />
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" inputMode="decimal" placeholder={t("cropMonitoring.areaSize")} value={editForm.area_size} onChange={(event) => setEditForm({ ...editForm, area_size: event.target.value })} />
                  <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                    <option value="healthy">{t("status.healthy")}</option><option value="watch">{t("status.watch")}</option><option value="risk">{t("status.risk")}</option><option value="harvested">{t("status.harvested")}</option>
                  </select>
                  <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder={t("cropMonitoring.notes")} value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
                  <div className="flex gap-2">
                    <button className="rounded-md bg-field-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingEdit}>{isSavingEdit ? t("cropMonitoring.saving") : t("common.save")}</button>
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" type="button" onClick={() => setEditingId(null)}>{t("common.cancel")}</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><h3 className="truncate font-semibold">{record.field_name}</h3><p className="mt-2 text-sm text-slate-700">{record.crop.name}</p></div>
                    <div className="relative flex shrink-0 items-center gap-2">
                      <StatusBadge label={plantStatusLabel(record.status, t)} tone={plantStatusTone(record.status)} />
                      <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-base font-bold leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900" type="button" aria-label={t("cropMonitoring.openPlantingMenu")} onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}>...</button>
                      {openMenuId === record.id && (
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-slate-100 bg-white p-1 text-left shadow-lg">
                          <button className="flex h-9 w-full items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-field-50" type="button" onClick={() => startEdit(record)}>{t("cropMonitoring.editRecord")}</button>
                          <button className="flex h-9 w-full items-center rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50" type="button" onClick={() => { setOpenMenuId(null); void onDelete(record.id); }}>{t("common.delete")}</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{t("cropMonitoring.plantAge")}: {record.plant_age_days} {t("cropMonitoring.days")}</p>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
function ActivityForm({ records, form, setForm, onSubmit, isSaving, saveMessage }: { records: PlantingRecord[]; form: { planting_record_id: string; activity_type: string; activity_date: string; description: string; cost_amount: string; labor_cost_amount: string }; setForm: (form: { planting_record_id: string; activity_type: string; activity_date: string; description: string; cost_amount: string; labor_cost_amount: string }) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; isSaving: boolean; saveMessage: string }) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">{t("cropMonitoring.recordActivity")}</h3>
      <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.planting_record_id} onChange={(event) => setForm({ ...form, planting_record_id: event.target.value })} required>
        <option value="">{t("cropMonitoring.selectPlot")}</option>{records.map((record) => <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>)}
      </select>
      <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.activityType")} value={form.activity_type} onChange={(event) => setForm({ ...form, activity_type: event.target.value })} required />
      <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={form.activity_date} onChange={(event) => setForm({ ...form, activity_date: event.target.value })} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="w-full rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" placeholder={t("cropMonitoring.materialCost")} value={form.cost_amount} onChange={(event) => setForm({ ...form, cost_amount: event.target.value })} />
        <input className="w-full rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" placeholder={t("cropMonitoring.laborCost")} value={form.labor_cost_amount} onChange={(event) => setForm({ ...form, labor_cost_amount: event.target.value })} />
      </div>
      <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.description")} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSaving}>{isSaving ? t("cropMonitoring.saving") : t("cropMonitoring.saveActivity")}</button>
      {saveMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{saveMessage}</p>}
    </form>
  );
}
function SymptomForm({ records, symptoms, form, setForm, onSubmit, isSaving, saveMessage }: { records: PlantingRecord[]; symptoms: Symptom[]; form: { planting_record_id: string; symptom_id: string; severity: string; observed_at: string; notes: string; image_url: string }; setForm: (form: { planting_record_id: string; symptom_id: string; severity: string; observed_at: string; notes: string; image_url: string }) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; isSaving: boolean; saveMessage: string }) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">{t("cropMonitoring.recordSymptom")}</h3>
      <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.planting_record_id} onChange={(event) => setForm({ ...form, planting_record_id: event.target.value })} required>
        <option value="">{t("cropMonitoring.selectPlot")}</option>{records.map((record) => <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>)}
      </select>
      <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.symptom_id} onChange={(event) => setForm({ ...form, symptom_id: event.target.value })} required>
        <option value="">{t("cropMonitoring.selectSymptom")}</option>{symptoms.map((symptom) => <option key={symptom.id} value={symptom.id}>{symptom.name}</option>)}
      </select>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>{t("cropMonitoring.symptomDate")}</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={form.observed_at} onChange={(event) => setForm({ ...form, observed_at: event.target.value })} required />
        </label>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>{t("cropMonitoring.symptomLevel")}</span>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
            <option value="low">{t("status.low")}</option><option value="medium">{t("status.medium")}</option><option value="high">{t("status.high")}</option>
          </select>
        </label>
      </div>
      <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.imageUrlOptional")} value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
      <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.notes")} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      <button className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={isSaving}>{isSaving ? t("cropMonitoring.saving") : t("cropMonitoring.saveSymptom")}</button>
      {saveMessage && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{saveMessage}</p>}
    </form>
  );
}

function ActivitySummary({ records, activities, onUpdate, onDelete }: { records: PlantingRecord[]; activities: Activity[]; onUpdate: (activityId: number, form: { activity_type: string; activity_date: string; description: string; cost_amount: string; labor_cost_amount: string }) => Promise<void>; onDelete: (activityId: number) => Promise<void> }) {
  const { t } = useTranslation();
  const totalCost = totalActivityCost(activities);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ activity_type: "", activity_date: "", description: "", cost_amount: "", labor_cost_amount: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState(() => records.find((record) => activities.some((activity) => activity.planting_record_id === record.id))?.id.toString() ?? "");

  const selectedRecord = records.find((record) => record.id.toString() === selectedRecordId);
  const selectedActivities = activities.filter((activity) => activity.planting_record_id.toString() === selectedRecordId);
  const selectedCost = totalActivityCost(selectedActivities);
  const recordsWithActivities = records.filter((record) => activities.some((activity) => activity.planting_record_id === record.id));

  function startEdit(activity: Activity) {
    setStatusMessage("");
    setOpenMenuId(null);
    setEditingId(activity.id);
    setEditForm({ activity_type: activity.activity_type, activity_date: activity.activity_date, description: activity.description ?? "", cost_amount: activity.cost_amount ?? "", labor_cost_amount: activity.labor_cost_amount ?? "" });
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const activityId = editingId;
    const nextForm = editForm;
    setEditingId(null);
    setOpenMenuId(null);
    setIsSavingEdit(true);
    try {
      await onUpdate(activityId, nextForm);
      setStatusMessage(t("notifications.activityUpdated"));
    } catch {
      setEditingId(activityId);
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("cropMonitoring.recentActivities")}</h3>
          <p className="mt-1 text-xs text-slate-500">{t("cropMonitoring.activitiesByPlotHelp")}</p>
        </div>
        <StatusBadge label={toCurrency(String(totalCost))} tone={totalCost > 0 ? "warning" : "info"} />
      </div>

      {statusMessage && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{statusMessage}</p>}

      {recordsWithActivities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{t("cropMonitoring.noActivitiesYet")}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={selectedRecordId} onChange={(event) => { setSelectedRecordId(event.target.value); setEditingId(null); setOpenMenuId(null); setStatusMessage(""); }}>
              {recordsWithActivities.map((record) => (
                <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <StatusBadge label={`${selectedActivities.length} ${t("cropMonitoring.activityCount")}`} tone="info" />
              <StatusBadge label={toCurrency(String(selectedCost))} tone={selectedCost > 0 ? "warning" : "success"} />
            </div>
          </div>

          {selectedRecord && <p className="mt-3 text-sm font-semibold text-slate-950">{selectedRecord.field_name} <span className="font-normal text-slate-500">({selectedRecord.crop.name})</span></p>}

          {selectedActivities.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">{t("cropMonitoring.noActivitiesForPlot")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm text-slate-700">
              {selectedActivities.slice(0, 8).map((activity) => (
                <li key={activity.id} className="py-3">
                  {editingId === activity.id ? (
                    <form onSubmit={submitEdit} className="space-y-2 rounded-md bg-field-50 p-3">
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={editForm.activity_type} onChange={(event) => setEditForm({ ...editForm, activity_type: event.target.value })} required />
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={editForm.activity_date} onChange={(event) => setEditForm({ ...editForm, activity_date: event.target.value })} required />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" placeholder={t("cropMonitoring.materialCost")} value={editForm.cost_amount} onChange={(event) => setEditForm({ ...editForm, cost_amount: event.target.value })} />
                        <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" placeholder={t("cropMonitoring.laborCost")} value={editForm.labor_cost_amount} onChange={(event) => setEditForm({ ...editForm, labor_cost_amount: event.target.value })} />
                      </div>
                      <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.notes")} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
                      <div className="flex gap-2">
                        <button className="rounded-md bg-field-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingEdit}>{isSavingEdit ? t("cropMonitoring.saving") : t("common.save")}</button>
                        <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" type="button" onClick={() => setEditingId(null)}>{t("common.cancel")}</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="truncate">{activity.activity_date} - {activity.activity_type}</p>{activity.description && <p className="mt-1 truncate text-xs text-slate-500">{activity.description}</p>}</div>
                      <div className="relative flex shrink-0 items-center gap-2 text-right">
                        <div className="text-right text-xs text-slate-500">
                          <p>{t("cropMonitoring.material")}: {toCurrency(activity.cost_amount ?? "0")}</p>
                          <p>{t("cropMonitoring.labor")}: {toCurrency(activity.labor_cost_amount ?? "0")}</p>
                          <p className="mt-1 whitespace-nowrap text-sm font-semibold text-slate-950">{t("cropMonitoring.total")}: {toCurrency(String(getActivityTotalCost(activity)))}</p>
                        </div>
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-base font-bold leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          type="button"
                          aria-label={t("cropMonitoring.openActivityMenu")}
                          onClick={() => setOpenMenuId(openMenuId === activity.id ? null : activity.id)}
                        >
                          ...
                        </button>
                        {openMenuId === activity.id && (
                          <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-slate-100 bg-white p-1 text-left shadow-lg">
                            <button className="flex h-9 w-full items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-field-50" type="button" onClick={() => startEdit(activity)}>{t("cropMonitoring.editActivity")}</button>
                            <button className="flex h-9 w-full items-center rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50" type="button" onClick={async () => { setOpenMenuId(null); setStatusMessage(""); try { await onDelete(activity.id); setStatusMessage(t("notifications.activityDeleted")); } catch { /* error banner is handled by parent */ } }}>{t("common.delete")}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="mt-3 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-950">{t("cropMonitoring.totalAllActivityCost")}: {toCurrency(String(totalCost))}</p>
    </div>
  );
}
function SymptomSummary({ records, symptomRecords, onUpdate, onResolve, onDelete }: { records: PlantingRecord[]; symptomRecords: SymptomRecord[]; onUpdate: (symptomRecordId: number, form: { severity: string; observed_at: string; notes: string; image_url: string; status: string; resolved_at?: string | null }) => Promise<void>; onResolve: (symptomRecordId: number) => Promise<void>; onDelete: (symptomRecordId: number) => Promise<void> }) {
  const { t } = useTranslation();
  const [selectedRecordId, setSelectedRecordId] = useState(() => records.find((record) => symptomRecords.some((symptom) => symptom.planting_record_id === record.id))?.id.toString() ?? "");
  const [statusFilter, setStatusFilter] = useState<"active" | "resolved">("active");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [editForm, setEditForm] = useState({ severity: "low", observed_at: "", notes: "", image_url: "", status: "active", resolved_at: null as string | null });

  const recordsWithSymptoms = records.filter((record) => symptomRecords.some((symptom) => symptom.planting_record_id === record.id));
  const selectedRecord = records.find((record) => record.id.toString() === selectedRecordId);
  const activeSymptoms = symptomRecords.filter((symptom) => symptom.status !== "resolved");
  const resolvedSymptoms = symptomRecords.filter((symptom) => symptom.status === "resolved");
  const selectedSymptoms = symptomRecords.filter((symptom) => symptom.planting_record_id.toString() === selectedRecordId && (statusFilter === "resolved" ? symptom.status === "resolved" : symptom.status !== "resolved"));
  const highCount = activeSymptoms.filter((symptom) => symptom.severity === "high").length;
  const mediumCount = activeSymptoms.filter((symptom) => symptom.severity === "medium").length;

  useEffect(() => {
    if (!selectedRecordId && recordsWithSymptoms.length > 0) setSelectedRecordId(recordsWithSymptoms[0].id.toString());
  }, [recordsWithSymptoms, selectedRecordId]);

  function toDateInput(value: string) {
    return value ? value.slice(0, 10) : "";
  }

  function startEdit(record: SymptomRecord) {
    setStatusMessage("");
    setOpenMenuId(null);
    setEditingId(record.id);
    setEditForm({
      severity: record.severity,
      observed_at: toDateInput(record.observed_at),
      notes: record.notes ?? "",
      image_url: record.image_url ?? "",
      status: record.status,
      resolved_at: record.resolved_at,
    });
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const symptomRecordId = editingId;
    const nextForm = editForm;
    setEditingId(null);
    setOpenMenuId(null);
    setIsSavingEdit(true);
    try {
      await onUpdate(symptomRecordId, nextForm);
      setStatusMessage(t("notifications.symptomUpdated"));
    } catch {
      setEditingId(symptomRecordId);
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("cropMonitoring.plantProblemsByPlot")}</h3>
          <p className="mt-1 text-xs text-slate-500">{t("cropMonitoring.plantProblemsHelp")}</p>
        </div>
        <StatusBadge label={`${activeSymptoms.length} ${t("cropMonitoring.active")}`} tone={highCount > 0 || mediumCount > 0 ? "warning" : "info"} />
      </div>

      {statusMessage && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{statusMessage}</p>}

      {recordsWithSymptoms.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{t("cropMonitoring.noSymptomsYet")}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={selectedRecordId} onChange={(event) => { setSelectedRecordId(event.target.value); setEditingId(null); setOpenMenuId(null); setStatusMessage(""); }}>
              {recordsWithSymptoms.map((record) => (
                <option key={record.id} value={record.id}>{record.field_name} - {record.crop.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 rounded-md border border-slate-200 p-1 text-xs font-semibold">
              <button className={`rounded px-3 py-1.5 ${statusFilter === "active" ? "bg-field-700 text-white" : "text-slate-600"}`} type="button" onClick={() => { setStatusFilter("active"); setStatusMessage(""); }}>{t("cropMonitoring.active")}</button>
              <button className={`rounded px-3 py-1.5 ${statusFilter === "resolved" ? "bg-field-700 text-white" : "text-slate-600"}`} type="button" onClick={() => { setStatusFilter("resolved"); setStatusMessage(""); }}>{t("cropMonitoring.resolved")}</button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge label={`${activeSymptoms.length} ${t("cropMonitoring.active")}`} tone={activeSymptoms.length > 0 ? "warning" : "success"} />
            <StatusBadge label={`${resolvedSymptoms.length} ${t("cropMonitoring.resolved")}`} tone="success" />
            <StatusBadge label={`${highCount} ${t("status.high")}`} tone={highCount > 0 ? "warning" : "success"} />
          </div>

          {selectedRecord && <p className="mt-3 text-sm font-semibold text-slate-950">{selectedRecord.field_name} <span className="font-normal text-slate-500">({selectedRecord.crop.name})</span></p>}

          {selectedSymptoms.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Tiada rekod {statusFilter === "active" ? t("cropMonitoring.active") : t("cropMonitoring.resolved")} untuk plot ini.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm text-slate-700">
              {selectedSymptoms.slice(0, 8).map((record) => (
                <li key={record.id} className="py-3">
                  {editingId === record.id ? (
                    <form onSubmit={submitEdit} className="space-y-2 rounded-md bg-field-50 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={editForm.observed_at} onChange={(event) => setEditForm({ ...editForm, observed_at: event.target.value })} required />
                        <select className="rounded-md border border-slate-300 px-3 py-2" value={editForm.severity} onChange={(event) => setEditForm({ ...editForm, severity: event.target.value })}>
                          <option value="low">{t("status.low")}</option><option value="medium">{t("status.medium")}</option><option value="high">{t("status.high")}</option>
                        </select>
                      </div>
                      <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value, resolved_at: event.target.value === "resolved" ? (editForm.resolved_at ?? new Date().toISOString()) : null })}>
                        <option value="active">{t("cropMonitoring.active")}</option><option value="monitoring">{t("cropMonitoring.monitoring")}</option><option value="resolved">{t("cropMonitoring.resolved")}</option>
                      </select>
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.imageUrlOptional")} value={editForm.image_url} onChange={(event) => setEditForm({ ...editForm, image_url: event.target.value })} />
                      <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder={t("cropMonitoring.notes")} value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
                      <div className="flex gap-2">
                        <button className="rounded-md bg-field-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" type="submit" disabled={isSavingEdit}>{isSavingEdit ? t("cropMonitoring.saving") : t("common.save")}</button>
                        <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" type="button" onClick={() => setEditingId(null)}>{t("common.cancel")}</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">{record.symptom.name}</p>
                          <StatusBadge label={record.status === "resolved" ? t("cropMonitoring.resolved") : record.status === "monitoring" ? t("cropMonitoring.monitoring") : t("cropMonitoring.active")} tone={record.status === "resolved" ? "success" : "warning"} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{new Date(record.observed_at).toLocaleDateString()} - {record.status === "resolved" ? `${t("cropMonitoring.resolvedOn")} ${record.resolved_at ? new Date(record.resolved_at).toLocaleDateString() : t("cropMonitoring.dateNotRecorded")}` : symptomActionText(record.severity, t)}</p>
                        {record.notes && <p className="mt-1 text-xs text-slate-500">{t("cropMonitoring.notes")}: {record.notes}</p>}
                      </div>
                      <div className="relative flex shrink-0 items-center gap-2">
                        <StatusBadge label={severityLabel(record.severity, t)} tone={severityTone(record.severity)} />
                        <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-base font-bold leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900" type="button" aria-label={t("cropMonitoring.openSymptomMenu")} onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}>...</button>
                        {openMenuId === record.id && (
                          <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-slate-100 bg-white p-1 text-left shadow-lg">
                            {record.status !== "resolved" && <button className="flex h-9 w-full items-center rounded-md px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50" type="button" onClick={async () => { setOpenMenuId(null); setStatusMessage(""); try { await onResolve(record.id); setStatusMessage(t("notifications.symptomResolved")); } catch { /* error banner is handled by parent */ } }}>{t("cropMonitoring.markResolved")}</button>}
                            <button className="flex h-9 w-full items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-field-50" type="button" onClick={() => startEdit(record)}>{t("cropMonitoring.editRecord")}</button>
                            <button className="flex h-9 w-full items-center rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50" type="button" onClick={async () => { setOpenMenuId(null); setStatusMessage(""); try { await onDelete(record.id); setStatusMessage(t("notifications.symptomDeleted")); } catch { /* error banner is handled by parent */ } }}>{t("common.delete")}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}




