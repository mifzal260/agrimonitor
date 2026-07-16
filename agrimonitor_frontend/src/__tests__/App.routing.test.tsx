import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setToken } from "../auth/authStorage";
import App from "../App";

const mockUser = { id: 1, name: "Mifzal", email: "mifzal@example.com", role: "admin" };

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
    ["/finance", "Finance page mock"],
  ])("opens protected route %s with token", async (route, expectedText) => {
    setToken("valid-token");
    renderRoute(route);

    expect(await screen.findByText(expectedText)).toBeInTheDocument();
  });

  it("uses dashboard fallback for an unknown route when authenticated", async () => {
    setToken("valid-token");
    renderRoute("/unknown-route");

    await waitFor(() => expect(screen.getByText("Dashboard page mock")).toBeInTheDocument());
  });
});
