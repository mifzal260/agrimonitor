export type Crop = {
  id: number;
  name: string;
  variety: string | null;
  description: string | null;
  expected_harvest_days: number | null;
};

export type Symptom = {
  id: number;
  name: string;
  description: string | null;
};

export type PlantingRecord = {
  id: number;
  user_id: number;
  crop_id: number | null;
  custom_crop_name: string | null;
  field_name: string;
  planting_date: string;
  area_size: string | null;
  status: string;
  notes: string | null;
  plant_age_days: number;
  crop: Crop | null;
};

export type Activity = {
  id: number;
  user_id: number;
  planting_record_id: number;
  activity_type: string;
  activity_date: string;
  description: string | null;
  cost_amount: string | null;
  labor_cost_amount: string | null;
};

export type SymptomRecord = {
  id: number;
  user_id: number;
  planting_record_id: number;
  symptom_id: number | null;
  custom_symptom_name: string | null;
  severity: string;
  notes: string | null;
  image_url: string | null;
  observed_at: string;
  status: string;
  resolved_at: string | null;
  symptom: Symptom | null;
};
