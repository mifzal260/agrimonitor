import type { Crop } from "../../types/monitoring";

export function capitalizeCropWords(value: string) {
  return value.replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) =>
    separator + letter.toLocaleUpperCase(),
  );
}

export function getPlantingCropName(record: { custom_crop_name: string | null; crop: Crop | null }) {
  return record.custom_crop_name ?? record.crop?.name ?? "";
}

export function isSelectableCropName(name: string) {
  return !["nanas", "nenas"].includes(name.trim().toLocaleLowerCase());
}
