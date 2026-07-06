import { apiRequest } from "./client";
import type { Activity, Crop, PlantingRecord, Symptom, SymptomRecord } from "../types/monitoring";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function listCrops(token: string) {
  return apiRequest<Crop[]>("/monitoring/crops", { headers: authHeaders(token) });
}

export function listSymptoms(token: string) {
  return apiRequest<Symptom[]>("/monitoring/symptoms", { headers: authHeaders(token) });
}

export function listPlantingRecords(token: string) {
  return apiRequest<PlantingRecord[]>("/monitoring/planting-records", { headers: authHeaders(token) });
}

export function createPlantingRecord(token: string, payload: {
  crop_id: number;
  field_name: string;
  planting_date: string;
  area_size?: string;
  status: string;
  notes?: string;
}) {
  return apiRequest<PlantingRecord>("/monitoring/planting-records", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...payload, area_size: payload.area_size || null, notes: payload.notes || null }),
  });
}

export function listActivities(token: string) {
  return apiRequest<Activity[]>("/monitoring/activities", { headers: authHeaders(token) });
}

export function createActivity(token: string, payload: {
  planting_record_id: number;
  activity_type: string;
  activity_date: string;
  description?: string;
  cost_amount?: string;
}) {
  return apiRequest<Activity>("/monitoring/activities", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...payload, description: payload.description || null, cost_amount: payload.cost_amount || null }),
  });
}

export function listSymptomRecords(token: string) {
  return apiRequest<SymptomRecord[]>("/monitoring/symptom-records", { headers: authHeaders(token) });
}

export function createSymptomRecord(token: string, payload: {
  planting_record_id: number;
  symptom_id: number;
  severity: string;
  notes?: string;
  image_url?: string;
}) {
  return apiRequest<SymptomRecord>("/monitoring/symptom-records", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      ...payload,
      notes: payload.notes || null,
      image_url: payload.image_url || null,
      observed_at: new Date().toISOString(),
    }),
  });
}