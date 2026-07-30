import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { generateSimulationReading, getLatestSensorReading, listSensorHistory } from "../../api/iotMonitoring";
import { StatusBadge } from "../../components/StatusBadge";
import type { LatestSensorResponse, SensorReading } from "../../types/iotMonitoring";
import { formatDateLong, formatDateShort, toFiniteNumber } from "../../utils/localeFormat";

type IotMonitoringPageProps = { token: string };
type MetricKey = "temperature" | "humidity" | "soil_moisture" | "light_intensity" | "battery_level";
type ChartMetricKey = Exclude<MetricKey, "battery_level">;
type ChartRow = { recorded_at: string } & Record<ChartMetricKey, number | null>;

const POLLING_INTERVAL_MS = 10_000;

const METRICS: Array<{ key: MetricKey; labelKey: string; unit: string; icon: string; warning: (value: number, data: LatestSensorResponse | null) => boolean }> = [
  { key: "temperature", labelKey: "iot.temperature", unit: "°C", icon: "SU", warning: (value, data) => value > (data?.thresholds.temperature_warning_celsius ?? 35) },
  { key: "humidity", labelKey: "iot.humidity", unit: "%", icon: "KU", warning: () => false },
  { key: "soil_moisture", labelKey: "iot.soilMoisture", unit: "%", icon: "KT", warning: (value, data) => value < (data?.thresholds.soil_moisture_warning_percent ?? 30) },
  { key: "light_intensity", labelKey: "iot.lightIntensity", unit: "lux", icon: "CH", warning: () => false },
  { key: "battery_level", labelKey: "iot.batteryLevel", unit: "%", icon: "BT", warning: (value, data) => value < (data?.thresholds.battery_warning_percent ?? 20) },
];

const CHARTS: Array<{ key: ChartMetricKey; labelKey: string; unit: string; color: string }> = [
  { key: "temperature", labelKey: "iot.temperature", unit: "°C", color: "#dc2626" },
  { key: "humidity", labelKey: "iot.humidity", unit: "%", color: "#2563eb" },
  { key: "soil_moisture", labelKey: "iot.soilMoisture", unit: "%", color: "#3f6f2a" },
  { key: "light_intensity", labelKey: "iot.lightIntensity", unit: "lux", color: "#d97706" },
];

export function IotMonitoringPage({ token }: IotMonitoringPageProps) {
  const { t } = useTranslation();
  const [latestData, setLatestData] = useState<LatestSensorResponse | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);
  const isMounted = useRef(false);
  const deviceIdRef = useRef<number | undefined>(undefined);

  const loadData = useCallback(async ({ initial = false }: { initial?: boolean } = {}) => {
    if (requestInFlight.current || !isMounted.current) return;
    requestInFlight.current = true;
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const generated = await generateSimulationReading(token, deviceIdRef.current);
      const [latest, historyData] = await Promise.all([
        getLatestSensorReading(token, generated.device?.id),
        listSensorHistory(token, { deviceId: generated.device?.id, limit: 48, interval: "raw" }),
      ]);
      if (!isMounted.current) return;
      deviceIdRef.current = latest.device?.id ?? generated.device?.id ?? deviceIdRef.current;
      setLatestData(latest);
      setHistory(historyData.readings);
      setError("");
    } catch (err) {
      if (isMounted.current) setError(err instanceof Error ? err.message : t("iot.errorState"));
    } finally {
      requestInFlight.current = false;
      if (isMounted.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [t, token]);

  useEffect(() => {
    isMounted.current = true;
    void loadData({ initial: true });
    const timer = window.setInterval(() => { void loadData(); }, POLLING_INTERVAL_MS);
    return () => {
      isMounted.current = false;
      window.clearInterval(timer);
    };
  }, [loadData]);

  const chartData = useMemo(() => {
    return history
      .map((reading) => ({
        recorded_at: reading.recorded_at,
        temperature: toFiniteNumber(reading.temperature),
        humidity: toFiniteNumber(reading.humidity),
        soil_moisture: toFiniteNumber(reading.soil_moisture),
        light_intensity: toFiniteNumber(reading.light_intensity),
      }))
      .sort((left, right) => Date.parse(left.recorded_at) - Date.parse(right.recorded_at));
  }, [history]);

  if (isLoading) return <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">{t("iot.loading")}</p>;

  const reading = latestData?.reading ?? null;
  const device = latestData?.device ?? null;
  const hasReading = Boolean(reading);

  return (
    <div className="space-y-5">
      {error && latestData === null && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{t("iot.errorState")}: {error}</p>}
      {error && latestData !== null && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("iot.refreshError")}</p>}

      <section className="soft-glass-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-950">{t("iot.title")}</h2>
              <StatusBadge label={t("iot.simulationMode")} tone="info" />
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("iot.simulationDescription")}</p>
          </div>
          <div className="rounded-lg border border-field-100 bg-white px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">{t("iot.updatedAt")}: </span>{reading ? formatDateLong(reading.recorded_at) : t("iot.noReading")}
            {isRefreshing && <span className="ml-2 text-xs text-field-700">{t("iot.refreshing")}</span>}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {METRICS.map((metric) => (
          <MetricCard key={metric.key} metric={metric} data={latestData} reading={reading} />
        ))}
        <ConnectionCard status={device?.status ?? "offline"} recordedAt={reading?.recorded_at ?? null} />
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <div className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{t("iot.historyTitle")}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("iot.historyDescription")}</p>
            </div>
            <StatusBadge label={hasReading ? t("iot.simulatedRealtime") : t("iot.noReading")} tone={hasReading ? "info" : "warning"} />
          </div>
          {chartData.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">{t("iot.emptyState")}</div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {CHARTS.map((chart) => <SensorChart chart={chart} data={chartData} key={chart.key} />)}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <DevicePanel data={latestData} />
          <AlertPanel data={latestData} hasReading={hasReading} />
        </aside>
      </section>
    </div>
  );
}

function MetricCard({ metric, data, reading }: { metric: (typeof METRICS)[number]; data: LatestSensorResponse | null; reading: SensorReading | null }) {
  const { t } = useTranslation();
  const value = reading ? toFiniteNumber(reading[metric.key]) : null;
  const isWarning = value !== null && metric.warning(value, data);
  return (
    <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{t(metric.labelKey)}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value === null ? "--" : formatSensorValue(value)} <span className="text-sm font-semibold text-slate-500">{metric.unit}</span></p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold ${isWarning ? "bg-amber-100 text-amber-800" : "bg-field-100 text-field-700"}`}>{metric.icon}</span>
      </div>
      <div className="mt-3"><StatusBadge label={isWarning ? t("iot.warning") : t("iot.normal")} tone={isWarning ? "warning" : "success"} /></div>
    </article>
  );
}

function ConnectionCard({ status, recordedAt }: { status: string; recordedAt: string | null }) {
  const { t } = useTranslation();
  const tone = status === "online" ? "success" : status === "warning" ? "warning" : "danger";
  return (
    <article className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{t("iot.deviceStatus")}</p>
          <p className="mt-2 text-2xl font-bold capitalize text-slate-950">{t(`iot.status.${status}`, { defaultValue: status })}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700">CN</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{recordedAt ? formatDateLong(recordedAt) : t("iot.noReading")}</p>
      <div className="mt-2"><StatusBadge label={t(`iot.status.${status}`, { defaultValue: status })} tone={tone} /></div>
    </article>
  );
}

function SensorChart({ chart, data }: { chart: (typeof CHARTS)[number]; data: ChartRow[] }) {
  const { t } = useTranslation();
  const values = data.flatMap((row) => row[chart.key] === null ? [] : [row[chart.key] as number]);
  const domain = buildDomain(values);
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-950">{t(chart.labelKey)}</h3>
        <span className="text-xs font-medium text-slate-500">{chart.unit}</span>
      </div>
      <div className="mt-3 h-56 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <XAxis dataKey="recorded_at" interval="preserveStartEnd" minTickGap={36} tick={{ fontSize: 11 }} tickFormatter={formatDateShort} />
            <YAxis width={42} domain={domain} tick={{ fontSize: 11 }} tickFormatter={(value) => formatSensorValue(Number(value))} />
            <Tooltip content={<SensorTooltip label={t(chart.labelKey)} unit={chart.unit} />} />
            <Line dataKey={chart.key} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }} stroke={chart.color} strokeWidth={2} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function SensorTooltip({ active, payload, label, unit }: { active?: boolean; payload?: Array<{ value?: number; payload?: ChartRow; color?: string }>; label: string; unit: string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-slate-600">{formatDateLong(item.payload?.recorded_at)}</p>
      <p className="mt-2 font-semibold" style={{ color: item.color }}>{formatSensorValue(Number(item.value ?? 0))} {unit}</p>
    </div>
  );
}

function DevicePanel({ data }: { data: LatestSensorResponse | null }) {
  const { t } = useTranslation();
  const device = data?.device;
  const reading = data?.reading;
  return (
    <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{t("iot.deviceInfo")}</h2>
      <div className="mt-3 divide-y divide-slate-100 text-sm">
        <InfoRow label={t("iot.deviceId")} value={device?.device_code ?? "--"} />
        <InfoRow label={t("iot.deviceName")} value={device?.device_name ?? "--"} />
        <InfoRow label={t("iot.location")} value={device?.location ?? "--"} />
        <InfoRow label={t("iot.dataSource")} value={device?.data_source ? t(`iot.source.${device.data_source}`, { defaultValue: device.data_source }) : "--"} />
        <InfoRow label={t("iot.connectionStatus")} value={device?.status ? t(`iot.status.${device.status}`, { defaultValue: device.status }) : "--"} />
        <InfoRow label={t("iot.lastReading")} value={reading ? formatDateLong(reading.recorded_at) : t("iot.noReading")} />
      </div>
    </section>
  );
}

function AlertPanel({ data, hasReading }: { data: LatestSensorResponse | null; hasReading: boolean }) {
  const { t } = useTranslation();
  const alerts = data?.alerts ?? [];
  return (
    <section className="rounded-lg border border-field-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{t("iot.alerts")}</h2>
      {!hasReading ? (
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{t("iot.emptyState")}</p>
      ) : alerts.length === 0 ? (
        <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{t("iot.noAlerts")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {alerts.map((alert) => (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" key={`${alert.metric}-${alert.message}`}>
              <p className="font-semibold">{t(`iot.metric.${alert.metric}`, { defaultValue: alert.metric })}</p>
              <p className="mt-1 text-xs leading-5">{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="text-slate-600">{label}</span>
      <span className="text-right font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function buildDomain(values: number[]) {
  if (values.length === 0) return [0, 10] as [number, number];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, 1);
  return [Math.floor(min - padding), Math.ceil(max + padding)] as [number, number];
}

function formatSensorValue(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}
