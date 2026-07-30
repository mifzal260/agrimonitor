import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IotMonitoringPage } from "./IotMonitoringPage";

const mocks = vi.hoisted(() => ({
  generateSimulationReading: vi.fn(),
  getLatestSensorReading: vi.fn(),
  listSensorHistory: vi.fn(),
}));

vi.mock("../../api/iotMonitoring", () => mocks);

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div data-testid="chart-line" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const latestResponse = {
  mode: "simulation",
  device: {
    id: 1,
    device_code: "IOT-DEMO-001",
    device_name: "AgriMonitor Demo Sensor",
    location: "Plot A",
    data_source: "simulation",
    status: "online",
    is_active: true,
  },
  reading: {
    id: 1,
    device_id: 1,
    temperature: 29.5,
    humidity: 70,
    soil_moisture: 55,
    light_intensity: 650,
    battery_level: 86,
    recorded_at: "2026-07-30T08:00:00Z",
  },
  alerts: [],
  thresholds: {
    temperature_warning_celsius: 35,
    soil_moisture_warning_percent: 30,
    battery_warning_percent: 20,
    online_after_seconds: 600,
    offline_after_seconds: 3600,
  },
};

function mockSuccessfulLoad() {
  mocks.generateSimulationReading.mockResolvedValue(latestResponse);
  mocks.getLatestSensorReading.mockResolvedValue(latestResponse);
  mocks.listSensorHistory.mockResolvedValue({ ...latestResponse, readings: [latestResponse.reading] });
}

describe("IotMonitoringPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a loading state while sensor data is requested", () => {
    mocks.generateSimulationReading.mockReturnValue(new Promise(() => undefined));

    render(<IotMonitoringPage token="token" />);

    expect(screen.getByText(/memuatkan data sensor simulasi/i)).toBeInTheDocument();
  });

  it("renders simulation mode, sensor cards, device info, and charts after loading", async () => {
    mockSuccessfulLoad();

    render(<IotMonitoringPage token="token" />);

    expect(await screen.findByText("Mod Simulasi")).toBeInTheDocument();
    expect(screen.getAllByText("Suhu").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kelembapan tanah").length).toBeGreaterThan(0);
    expect(screen.getByText("AgriMonitor Demo Sensor")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart-line")).toHaveLength(4);
  });

  it("shows a controlled error state when initial loading fails", async () => {
    mocks.generateSimulationReading.mockRejectedValue(new Error("network failed"));

    render(<IotMonitoringPage token="token" />);

    expect(await screen.findByText(/data sensor tidak dapat dimuatkan/i)).toBeInTheDocument();
    expect(screen.getByText(/network failed/i)).toBeInTheDocument();
  });

  it("cleans polling timer after unmount", async () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    mockSuccessfulLoad();

    const view = render(<IotMonitoringPage token="token" />);
    await screen.findByText("Mod Simulasi");

    view.unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("does not start overlapping refresh requests", () => {
    vi.useFakeTimers();
    mocks.generateSimulationReading.mockReturnValue(new Promise(() => undefined));

    const view = render(<IotMonitoringPage token="token" />);
    vi.advanceTimersByTime(20_000);

    expect(mocks.generateSimulationReading).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
