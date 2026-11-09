import type { SymptomRecord } from "../../types/monitoring";
import { capitalizeCropWords } from "./cropName";

export function getSymptomRecordName(record: Pick<SymptomRecord, "custom_symptom_name" | "symptom">) {
  return record.custom_symptom_name ?? record.symptom?.name ?? "";
}

export function capitalizeSymptomWords(value: string) {
  return capitalizeCropWords(value);
}
