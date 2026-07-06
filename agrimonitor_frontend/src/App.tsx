import { useEffect, useState } from "react";

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

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>("dashboard");
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(token));

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
  }

  if (isCheckingSession) return <main className="flex min-h-screen items-center justify-center bg-field-50 px-5 text-slate-700">Checking session...</main>;

  return (
    <ProtectedRoute user={user} fallback={<AuthPage onAuthenticated={handleAuthenticated} />}>
      <main className="min-h-screen bg-field-50 text-slate-950">
        <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase text-field-700">AgriMonitor MVP</p>
              <h1 className="mt-2 text-3xl font-bold">Farm monitoring workspace</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span>{user?.name}</span>
                <StatusBadge label={user?.role ?? "user"} tone={user?.role === "admin" ? "success" : "info"} />
              </div>
            </div>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" type="button" onClick={handleLogout}>Logout</button>
          </header>

          <nav className="mb-5 grid grid-cols-4 gap-2 rounded-lg border border-field-100 bg-white p-2 shadow-sm">
            <TabButton label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
            <TabButton label="Monitoring" active={view === "monitoring"} onClick={() => setView("monitoring")} />
            <TabButton label="Market" active={view === "market"} onClick={() => setView("market")} />
            <TabButton label="Finance" active={view === "finance"} onClick={() => setView("finance")} />
          </nav>

          {token && user && view === "dashboard" && <DashboardPage token={token} />}
          {token && user && view === "monitoring" && <MonitoringPage token={token} />}
          {token && user && view === "market" && <MarketPricePage token={token} user={user} />}
          {token && user && view === "finance" && <FinancePage token={token} />}
        </section>
      </main>
    </ProtectedRoute>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button className={`rounded-md px-2 py-2 text-sm font-semibold ${active ? "bg-field-700 text-white" : "text-slate-700"}`} type="button" onClick={onClick}>{label}</button>;
}

export default App;