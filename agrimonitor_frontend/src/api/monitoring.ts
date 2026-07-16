import { apiRequest } from "./client";
import type { Activity, Crop, PlantingRecord, Symptom, SymptomRecord } from "../types/monitoring";

export function listCrops(_token: string) {
  return apiRequest<Crop[]>("/monitoring/crops");
}

export function listSymptoms(_token: string) {
  return apiRequest<Symptom[]>("/monitoring/symptoms");
}

export function listPlantingRecords(_token: string) {
  return apiRequest<PlantingRecord[]>("/monitoring/planting-records");
}

export function createPlantingRecord(_token: string, payload: {
  crop_id: number;
  field_name: string;
  planting_date: string;
  area_size?: string;
  status: string;
  notes?: string;
}) {
  return apiRequest<PlantingRecord>("/monitoring/planting-records", {
    method: "POST",
    body: JSON.stringify({ ...payload, area_size: payload.area_size || null, notes: payload.notes || null }),
  });
}


export function updatePlantingRecord(_token: string, recordId: number, payload: {
  crop_id?: number;
  field_name?: string;
  planting_date?: string;
  area_size?: string;
  status?: string;
  notes?: string;
}) {
  return apiRequest<PlantingRecord>(`/monitoring/planting-records/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, area_size: payload.area_size || null, notes: payload.notes || null }),
  });
}

export function deletePlantingRecord(_token: string, recordId: number) {
  return apiRequest<null>(`/monitoring/planting-records/${recordId}`, {
    method: "DELETE",
  });
}
export function listActivities(_token: string) {
  return apiRequest<Activity[]>("/monitoring/activities");
}

export function createActivity(_token: string, payload: {
  planting_record_id: number;
  activity_type: string;
  activity_date: string;
  description?: string;
  cost_amount?: string;
  labor_cost_amount?: string;
}) {
  return apiRequest<Activity>("/monitoring/activities", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      description: payload.description || null,
      cost_amount: payload.cost_amount || null,
      labor_cost_amount: payload.labor_cost_amount || null,
    }),
  });
}


export function updateActivity(_token: string, activityId: number, payload: {
  activity_type?: string;
  activity_date?: string;
  description?: string;
  cost_amount?: string;
  labor_cost_amount?: string;
}) {
  return apiRequest<Activity>(`/monitoring/activities/${activityId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...payload,
      description: payload.description || null,
      cost_amount: payload.cost_amount || null,
      labor_cost_amount: payload.labor_cost_amount || null,
    }),
  });
}

export function deleteActivity(_token: string, activityId: number) {
  return apiRequest<null>(`/monitoring/activities/${activityId}`, {
    method: "DELETE",
  });
}
export function listSymptomRecords(_token: string) {
  return apiRequest<SymptomRecord[]>("/monitoring/symptom-records");
}

export function createSymptomRecord(_token: string, payload: {
  planting_record_id: number;
  symptom_id: number;
  severity: string;
  notes?: string;
  image_url?: string;
  observed_at: string;
}) {
  return apiRequest<SymptomRecord>("/monitoring/symptom-records", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      notes: payload.notes || null,
      image_url: payload.image_url || null,
      observed_at: payload.observed_at,
    }),
  });
}
export function updateSymptomRecord(_token: string, symptomRecordId: number, payload: {
  severity?: string;
  notes?: string;
  image_url?: string;
  observed_at?: string;
  status?: string;
  resolved_at?: string | null;
}) {
  return apiRequest<SymptomRecord>(`/monitoring/symptom-records/${symptomRecordId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, notes: payload.notes || null, image_url: payload.image_url || null }),
  });
}

export function deleteSymptomRecord(_token: string, symptomRecordId: number) {
  return apiRequest<null>(`/monitoring/symptom-records/${symptomRecordId}`, {
    method: "DELETE",
  });
}


