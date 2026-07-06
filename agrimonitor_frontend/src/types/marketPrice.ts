export type MarketPrice = {
  id: number;
  crop_id: number | null;
  commodity_name: string;
  location: string;
  price_type: string;
  price: string;
  unit: string;
  recorded_date: string;
  trend: "up" | "down" | "stable" | string;
};

export type CsvImportResult = {
  imported: number;
  skipped: number;
};