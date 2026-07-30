import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRefreshToken, getToken, setAuthTokens, setToken } from "../auth/authStorage";
import { getMe, login } from "../api/auth";
import App from "../App";
import type { User } from "../types/auth";

const mockUser: User = { id: 1, name: "Mifzal", email: "mifzal@example.com", role: "admin" };

vi.mock("../api/auth", () => ({
  getMe: vi.fn(() => Promise.resolve(mockUser)),
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../features/dashboard/DashboardPage", () => ({
  DashboardPage: () => <div>Dashboard page mock</div>,
}));

vi.mock("../features/monitoring/MonitoringPage", () => ({
  MonitoringPage: () => <div>Monitoring page mock</div>,
}));

vi.mock("../features/market-prices/MarketPricePage", () => ({
  MarketPricePage: () => <div>Market prices page mock</div>,
}));

vi.mock("../features/iot-monitoring/IotMonitoringPage", () => ({
  IotMonitoringPage: () => <div>IoT monitoring page mock</div>,
}));

vi.mock("../features/finance/FinancePage", () => ({
  FinancePage: () => <div>Finance page mock</div>,
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routing", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("redirects protected dashboard to login without token", async () => {
    renderRoute("/dashboard");

    expect(await screen.findByRole("heading", { name: /login|log masuk/i })).toBeInTheDocument();
  });

  it("allows dashboard with a valid token", async () => {
    setToken("valid-token");
    renderRoute("/dashboard");

    expect(await screen.findByText("Dashboard page mock")).toBeInTheDocument();
  });

  it("redirects authenticated login route to dashboard", async () => {
    setToken("valid-token");
    renderRoute("/login");

    expect(await screen.findByText("Dashboard page mock")).toBeInTheDocument();
  });

  it.each([
    ["/monitoring", "Monitoring page mock"],
    ["/market-prices", "Market prices page mock"],
    ["/iot-monitoring", "IoT monitoring page mock"],
    ["/finance", "Finance page mock"],
  ])("opens protected route %s with token", async (route, expectedText) => {
    setToken("valid-token");
    renderRoute(route);

    expect(await screen.findByText(expectedText)).toBeInTheDocument();
  });


  it("stores login tokens and redirects to dashboard after HTTP 200", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockResolvedValueOnce({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
      expires_in: 900,
      refresh_expires_in: 1209600,
      user: mockUser,
    });

    renderRoute("/login");
    await user.type(await screen.findByLabelText(/emel|email/i), "mifzal@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login|log masuk/i }));

    expect(await screen.findByText("Dashboard page mock")).toBeInTheDocument();
    expect(getToken()).toBe("access-token");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("accepts legacy production login response without optional refresh fields", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockResolvedValueOnce({
      access_token: "legacy-access-token",
      token_type: "bearer",
      user: mockUser,
    });

    renderRoute("/login");
    await user.type(await screen.findByLabelText(/emel|email/i), "mifzal@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login|log masuk/i }));

    expect(await screen.findByText("Dashboard page mock")).toBeInTheDocument();
    expect(getToken()).toBe("legacy-access-token");
    expect(getRefreshToken()).toBeNull();
    expect(screen.queryByText(/Authentication failed|Pengesahan gagal/i)).not.toBeInTheDocument();
  });

  it("removes an old refresh token when the new login response is legacy", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("agrimonitor_refresh_token", "old-refresh-token");
    vi.mocked(login).mockResolvedValueOnce({
      access_token: "legacy-access-token",
      token_type: "bearer",
      user: mockUser,
    });

    renderRoute("/login");
    await user.type(await screen.findByLabelText(/emel|email/i), "mifzal@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login|log masuk/i }));

    expect(await screen.findByText("Dashboard page mock")).toBeInTheDocument();
    expect(getToken()).toBe("legacy-access-token");
    expect(getRefreshToken()).toBeNull();
  });

  it("rejects login responses without access_token", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockResolvedValueOnce({
      token_type: "bearer",
      user: mockUser,
    } as Awaited<ReturnType<typeof login>>);

    renderRoute("/login");
    await user.type(await screen.findByLabelText(/emel|email/i), "mifzal@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login|log masuk/i }));

    expect(await screen.findByText(/Authentication failed|Pengesahan gagal/i)).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("rejects login responses without user", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockResolvedValueOnce({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
    } as Awaited<ReturnType<typeof login>>);

    renderRoute("/login");
    await user.type(await screen.findByLabelText(/emel|email/i), "mifzal@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login|log masuk/i }));

    expect(await screen.findByText(/Authentication failed|Pengesahan gagal/i)).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("clears legacy access auth and returns to login after a protected 401", async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new Error("Expired"));
    setAuthTokens("legacy-access-token", "stale-refresh-token");
    sessionStorage.removeItem("agrimonitor_refresh_token");

    renderRoute("/dashboard");

    expect(await screen.findByRole("heading", { name: /login|log masuk/i })).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(vi.mocked(getMe)).toHaveBeenCalledTimes(1);
  });
  it("uses dashboard fallback for an unknown route when authenticated", async () => {
    setToken("valid-token");
    renderRoute("/unknown-route");

    await waitFor(() => expect(screen.getByText("Dashboard page mock")).toBeInTheDocument());
  });
});
