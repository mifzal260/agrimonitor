import { apiRequest } from "./client";
import type { IotDevice, LatestSensorResponse, SensorHistoryResponse } from "../types/iotMonitoring";

type HistoryParams = {
  deviceId?: number;
  from?: string;
  to?: string;
  limit?: number;
  interval?: "raw" | "hourly";
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export function listIotDevices(_token: string) {
  return apiRequest<IotDevice[]>("/monitoring/devices");
}

export function getIotDevice(_token: string, deviceId: number) {
  return apiRequest<IotDevice>(`/monitoring/devices/${deviceId}`);
}

export function getLatestSensorReading(_token: string, deviceId?: number) {
  return apiRequest<LatestSensorResponse>(`/monitoring/sensors/latest${buildQuery({ device_id: deviceId })}`);
}

export function listSensorHistory(_token: string, params: HistoryParams = {}) {
  return apiRequest<SensorHistoryResponse>(`/monitoring/sensors/history${buildQuery({
    device_id: params.deviceId,
    from: params.from,
    to: params.to,
    limit: params.limit,
    interval: params.interval,
  })}`);
}

export function generateSimulationReading(_token: string, deviceId?: number) {
  return apiRequest<LatestSensorResponse>(`/monitoring/simulation/generate${buildQuery({ device_id: deviceId })}`, {
    method: "POST",
  });
}
