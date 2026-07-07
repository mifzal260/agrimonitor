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

type NavigationItem = { view: AppView; label: string; shortLabel: string; description: string; badge?: string };

const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "Overview",
    items: [{ view: "dashboard", label: "Dashboard", shortLabel: "Home", description: "Summary, alerts, and price trend" }],
  },
  {
    label: "Farm",
    items: [{ view: "monitoring", label: "Crop Monitoring", shortLabel: "Monitor", description: "Plots, activities, symptoms, and risk", badge: "Core" }],
  },
  {
    label: "Business",
    items: [
      { view: "market", label: "Market Prices", shortLabel: "Market", description: "Commodity prices and CSV import" },
      { view: "finance", label: "Finance", shortLabel: "Finance", description: "Costs, harvests, and profit/loss" },
    ],
  },
];

const navigationItems = navigationGroups.flatMap((group) => group.items);

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>("dashboard");
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(token));
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
    setIsUserMenuOpen(false);
  }

  function handleNavigate(nextView: AppView) {
    setView(nextView);
    setIsUserMenuOpen(false);
  }

  if (isCheckingSession) return <main className="flex min-h-screen items-center justify-center bg-field-50 px-5 text-slate-700">Checking session...</main>;

  return (
    <ProtectedRoute user={user} fallback={<AuthPage onAuthenticated={handleAuthenticated} />}>
      <main className="min-h-screen bg-[#f7faf5] text-slate-950">
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-sm md:flex">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-field-700 text-lg font-bold text-white">AM</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-field-700">AgriMonitor</p>
                <h1 className="text-lg font-bold leading-tight">Platform</h1>
              </div>
            </div>

            <nav className="mt-5 flex flex-1 flex-col gap-5 overflow-y-auto" aria-label="Main navigation">
              {navigationGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => (
                      <SidebarButton key={item.view} item={item} active={view === item.view} onClick={() => handleNavigate(item.view)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="rounded-lg border border-field-100 bg-field-50 p-4 text-center">
              <p className="text-sm font-bold text-slate-950">MVP Ready</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Monitor crops, prices, costs, and harvests from one workspace.</p>
            </div>
          </aside>

          <section className="flex min-h-screen flex-1 flex-col md:pl-72">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-8">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500"><span className="text-field-700">AgriMonitor</span> / {activeItem.label}</p>
                  <h2 className="mt-1 text-xl font-bold md:text-2xl">{activeItem.label}</h2>
                </div>

                <div className="relative">
                  <button
                    className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-3 text-left shadow-sm hover:bg-slate-50"
                    type="button"
                    onClick={() => setIsUserMenuOpen((open) => !open)}
                    aria-expanded={isUserMenuOpen}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-field-700 text-sm font-bold text-white">{user?.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
                    <span className="hidden sm:block">
                      <span className="block text-sm font-semibold text-slate-950">{user?.name}</span>
                      <span className="block text-xs text-slate-500">{user?.role}</span>
                    </span>
                    <span className="text-slate-400">⌄</span>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                      <div className="border-b border-slate-100 pb-3">
                        <p className="text-sm font-semibold text-slate-950">{user?.name}</p>
                        <div className="mt-2"><StatusBadge label={user?.role ?? "user"} tone={user?.role === "admin" ? "success" : "info"} /></div>
                      </div>
                      <button className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50" type="button" onClick={handleLogout}>Sign out</button>
                    </div>
                  )}
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

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t border-slate-200 bg-white p-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:hidden" aria-label="Mobile navigation">
          {navigationItems.map((item) => (
            <MobileNavButton key={item.view} item={item} active={view === item.view} onClick={() => handleNavigate(item.view)} />
          ))}
        </nav>
      </main>
    </ProtectedRoute>
  );
}

function SidebarButton({ item, active, onClick }: { item: NavigationItem; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`w-full rounded-md px-3 py-3 text-left transition ${active ? "bg-field-700 text-white shadow-sm" : "text-slate-700 hover:bg-field-50"}`}
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{item.label}</span>
        {item.badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-field-100 text-field-700"}`}>{item.badge}</span>}
      </span>
      <span className={`mt-1 block text-xs ${active ? "text-field-50" : "text-slate-500"}`}>{item.description}</span>
    </button>
  );
}

function MobileNavButton({ item, active, onClick }: { item: NavigationItem; active: boolean; onClick: () => void }) {
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