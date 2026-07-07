import { useEffect, useMemo, useState } from "react";

import { getMe } from "./api/auth";
import { StatusBadge } from "./components/StatusBadge";
import { AuthPage } from "./features/auth/AuthPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { FinancePage } from "./features/finance/FinancePage";
import { MarketPricePage } from "./features/market-prices/MarketPricePage";
import { MonitoringPage } from "./features/monitoring/MonitoringPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import type { AuthResponse, User } from "./types/auth";

const tokenStorageKey = "agrimonitor_access_token";
type AppView = "dashboard" | "monitoring" | "market" | "finance";

const navigationItems: Array<{ view: AppView; label: string; shortLabel: string; description: string }> = [
  { view: "dashboard", label: "Dashboard", shortLabel: "Home", description: "Summary, alerts, and price trend" },
  { view: "monitoring", label: "Monitoring", shortLabel: "Monitor", description: "Plots, activities, symptoms, and risk" },
  { view: "market", label: "Market Prices", shortLabel: "Market", description: "Commodity prices and CSV import" },
  { view: "finance", label: "Finance", shortLabel: "Finance", description: "Costs, harvests, and profit/loss" },
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>("dashboard");
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(token));

  const activeItem = useMemo(() => navigationItems.find((item) => item.view === view) ?? navigationItems[0], [view]);

  useEffect(() => {
    if (!token) { setIsCheckingSession(false); return; }
    getMe(token).then(setUser).catch(() => {
      localStorage.removeItem(tokenStorageKey);
      setToken(null);
      setUser(null);
    }).finally(() => setIsCheckingSession(false));
  }, [token]);

  function handleAuthenticated(response: AuthResponse) {
    localStorage.setItem(tokenStorageKey, response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  }

  function handleLogout() {
    localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
    setView("dashboard");
  }

  if (isCheckingSession) return <main className="flex min-h-screen items-center justify-center bg-field-50 px-5 text-slate-700">Checking session...</main>;

  return (
    <ProtectedRoute user={user} fallback={<AuthPage onAuthenticated={handleAuthenticated} />}>
      <main className="min-h-screen bg-field-50 text-slate-950">
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-field-100 bg-white px-4 py-5 shadow-sm md:flex">
            <div className="border-b border-field-100 pb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-field-700">AgriMonitor MVP</p>
              <h1 className="mt-2 text-xl font-bold leading-tight">Farm monitoring workspace</h1>
            </div>

            <nav className="mt-5 flex flex-1 flex-col gap-2" aria-label="Main navigation">
              {navigationItems.map((item) => (
                <SidebarButton key={item.view} item={item} active={view === item.view} onClick={() => setView(item.view)} />
              ))}
            </nav>

            <div className="space-y-3 border-t border-field-100 pt-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">{user?.name}</p>
                <div className="mt-2"><StatusBadge label={user?.role ?? "user"} tone={user?.role === "admin" ? "success" : "info"} /></div>
              </div>
              <button className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={handleLogout}>Logout</button>
            </div>
          </aside>

          <section className="flex min-h-screen flex-1 flex-col md:pl-72">
            <header className="sticky top-0 z-20 border-b border-field-100 bg-white/95 px-4 py-4 shadow-sm backdrop-blur md:px-8">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-field-700 md:hidden">AgriMonitor</p>
                  <h2 className="text-xl font-bold md:text-2xl">{activeItem.label}</h2>
                  <p className="mt-1 hidden text-sm text-slate-600 sm:block">{activeItem.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden text-right text-sm sm:block">
                    <p className="font-semibold text-slate-950">{user?.name}</p>
                    <p className="text-slate-500">{user?.role}</p>
                  </div>
                  <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:hidden" type="button" onClick={handleLogout}>Logout</button>
                </div>
              </div>
            </header>

            <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">
              {token && user && view === "dashboard" && <DashboardPage token={token} />}
              {token && user && view === "monitoring" && <MonitoringPage token={token} />}
              {token && user && view === "market" && <MarketPricePage token={token} user={user} />}
              {token && user && view === "finance" && <FinancePage token={token} />}
            </div>
          </section>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t border-field-100 bg-white p-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:hidden" aria-label="Mobile navigation">
          {navigationItems.map((item) => (
            <MobileNavButton key={item.view} item={item} active={view === item.view} onClick={() => setView(item.view)} />
          ))}
        </nav>
      </main>
    </ProtectedRoute>
  );
}

function SidebarButton({ item, active, onClick }: { item: { label: string; description: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`rounded-md px-3 py-3 text-left transition ${active ? "bg-field-700 text-white shadow-sm" : "text-slate-700 hover:bg-field-50"}`}
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className="block text-sm font-semibold">{item.label}</span>
      <span className={`mt-1 block text-xs ${active ? "text-field-50" : "text-slate-500"}`}>{item.description}</span>
    </button>
  );
}

function MobileNavButton({ item, active, onClick }: { item: { shortLabel: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`rounded-md px-1 py-2 text-xs font-semibold ${active ? "bg-field-700 text-white" : "text-slate-600"}`}
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {item.shortLabel}
    </button>
  );
}

export default App;
