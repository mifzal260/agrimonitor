export type IotDevice = {
  id: number;
  device_code: string;
  device_name: string;
  location: string;
  data_source: "simulation" | "iot" | "manual" | string;
  status: "online" | "offline" | "warning" | string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SensorReading = {
  id: number;
  device_id: number;
  temperature: string | number;
  humidity: string | number;
  soil_moisture: string | number;
  light_intensity: string | number;
  battery_level: string | number;
  recorded_at: string;
};

export type MonitoringAlert = {
  metric: string;
  level: "info" | "warning" | "danger" | string;
  message: string;
};

export type SensorThresholds = {
  temperature_warning_celsius: number;
  soil_moisture_warning_percent: number;
  battery_warning_percent: number;
  online_after_seconds: number;
  offline_after_seconds: number;
};

export type LatestSensorResponse = {
  mode: "simulation" | "iot" | string;
  device: IotDevice | null;
  reading: SensorReading | null;
  alerts: MonitoringAlert[];
  thresholds: SensorThresholds;
};

export type SensorHistoryResponse = {
  mode: "simulation" | "iot" | string;
  device: IotDevice | null;
  readings: SensorReading[];
  limit: number;
};
