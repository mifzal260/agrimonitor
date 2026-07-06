export type RecommendationMatch = {
  disease_rule_id: number;
  disease_name: string;
  risk_level: "low" | "medium" | "high";
  recommendation: string;
  matched_symptoms: string[];
};

export type RecommendationResult = {
  planting_record_id: number;
  highest_risk_level: "none" | "low" | "medium" | "high";
  matches: RecommendationMatch[];
};

export type Alert = {
  id: number;
  planting_record_id: number;
  symptom_record_id: number | null;
  risk_level: string;
  message: string;
  is_read: boolean;
};