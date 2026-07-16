import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { getMe } from "./api/auth";
import { resetUnauthorizedHandler } from "./api/client";
import { authSessionExpiredEvent, clearToken, migrateLegacyToken, setToken } from "./auth/authStorage";
import { LanguageSwitcher } from "./components/common/LanguageSwitcher";
import { StatusBadge } from "./components/StatusBadge";
import { AuthPage } from "./features/auth/AuthPage";
import type { AuthResponse, User } from "./types/auth";

const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const MonitoringPage = lazy(() => import("./features/monitoring/MonitoringPage").then((module) => ({ default: module.MonitoringPage })));
const MarketPricePage = lazy(() => import("./features/market-prices/MarketPricePage").then((module) => ({ default: module.MarketPricePage })));
const FinancePage = lazy(() => import("./features/finance/FinancePage").then((module) => ({ default: module.FinancePage })));

type AppRoute = "/dashboard" | "/monitoring" | "/market-prices" | "/finance";

type NavigationItem = {
  path: AppRoute;
  label: string;
  shortLabel: string;
  description: string;
  badge?: string;
};

const fallbackAuthenticatedPath: AppRoute = "/dashboard";

function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setTokenState] = useState(() => migrateLegacyToken());
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(token));
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navigationGroups = useMemo<Array<{ label: string; items: NavigationItem[] }>>(() => [
    {
      label: t("navigation.summary"),
      items: [{ path: "/dashboard", label: t("navigation.dashboard"), shortLabel: t("navigation.dashboardShort"), description: t("navigation.dashboardDescription") }],
    },
    {
      label: t("navigation.farm"),
      items: [{ path: "/monitoring", label: t("navigation.cropMonitoring"), shortLabel: t("navigation.cropMonitoringShort"), description: t("navigation.cropMonitoringDescription"), badge: t("navigation.dashboardShort") }],
    },
    {
      label: t("navigation.business"),
      items: [
        { path: "/market-prices", label: t("navigation.marketPrice"), shortLabel: t("navigation.marketPriceShort"), description: t("navigation.marketPriceDescription") },
        { path: "/finance", label: t("navigation.finance"), shortLabel: t("navigation.financeShort"), description: t("navigation.financeDescription") },
      ],
    },
  ], [t]);

  const navigationItems = useMemo(() => navigationGroups.flatMap((group) => group.items), [navigationGroups]);
  const activeItem = useMemo(() => navigationItems.find((item) => item.path === location.pathname) ?? navigationItems[0], [location.pathname, navigationItems]);

  useEffect(() => {
    if (!token) {
      setIsCheckingSession(false);
      setUser(null);
      return;
    }

    let isCurrent = true;
    setIsCheckingSession(true);
    getMe().then((currentUser) => {
      if (isCurrent) setUser(currentUser);
    }).catch(() => {
      clearToken();
      if (isCurrent) {
        setTokenState(null);
        setUser(null);
      }
    }).finally(() => {
      if (isCurrent) setIsCheckingSession(false);
    });

    return () => { isCurrent = false; };
  }, [token]);

  useEffect(() => {
    function handleSessionExpired() {
      clearToken();
      setTokenState(null);
      setUser(null);
      setIsUserMenuOpen(false);
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }

    window.addEventListener(authSessionExpiredEvent, handleSessionExpired);
    return () => window.removeEventListener(authSessionExpiredEvent, handleSessionExpired);
  }, [location.pathname, navigate]);

  function handleAuthenticated(response: AuthResponse) {
    if (!response.access_token || !response.user) {
      clearToken();
      setTokenState(null);
      setUser(null);
      throw new Error(t("auth.authenticationFailed"));
    }

    setToken(response.access_token);
    resetUnauthorizedHandler();
    setTokenState(response.access_token);
    setUser(response.user);
    const nextPath = getRedirectPath(location.state);
    navigate(nextPath, { replace: true });
  }

  function handleLogout() {
    clearToken();
    resetUnauthorizedHandler();
    setTokenState(null);
    setUser(null);
    setIsUserMenuOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={token && user ? <Navigate to={fallbackAuthenticatedPath} replace /> : <AuthPage onAuthenticated={handleAuthenticated} />}
      />
      <Route
        path="/"
        element={<Navigate to={token ? fallbackAuthenticatedPath : "/login"} replace />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedAppShell activeItem={activeItem} isCheckingSession={isCheckingSession} navigationGroups={navigationGroups} navigationItems={navigationItems} onLogout={handleLogout} token={token} user={user} isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen}>
            <DashboardPage token={token ?? ""} />
          </ProtectedAppShell>
        }
      />
      <Route
        path="/monitoring"
        element={
          <ProtectedAppShell activeItem={activeItem} isCheckingSession={isCheckingSession} navigationGroups={navigationGroups} navigationItems={navigationItems} onLogout={handleLogout} token={token} user={user} isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen}>
            <MonitoringPage token={token ?? ""} />
          </ProtectedAppShell>
        }
      />
      <Route
        path="/market-prices"
        element={
          <ProtectedAppShell activeItem={activeItem} isCheckingSession={isCheckingSession} navigationGroups={navigationGroups} navigationItems={navigationItems} onLogout={handleLogout} token={token} user={user} isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen}>
            <MarketPricePage token={token ?? ""} user={user as User} />
          </ProtectedAppShell>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedAppShell activeItem={activeItem} isCheckingSession={isCheckingSession} navigationGroups={navigationGroups} navigationItems={navigationItems} onLogout={handleLogout} token={token} user={user} isUserMenuOpen={isUserMenuOpen} setIsUserMenuOpen={setIsUserMenuOpen}>
            <FinancePage token={token ?? ""} />
          </ProtectedAppShell>
        }
      />
      <Route path="*" element={<Navigate to={fallbackAuthenticatedPath} replace />} />
    </Routes>
  );
}

function ProtectedAppShell({
  activeItem,
  children,
  isCheckingSession,
  isUserMenuOpen,
  navigationGroups,
  navigationItems,
  onLogout,
  setIsUserMenuOpen,
  token,
  user,
}: {
  activeItem: NavigationItem;
  children: React.ReactNode;
  isCheckingSession: boolean;
  isUserMenuOpen: boolean;
  navigationGroups: Array<{ label: string; items: NavigationItem[] }>;
  navigationItems: NavigationItem[];
  onLogout: () => void;
  setIsUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  token: string | null;
  user: User | null;
}) {
  const { t } = useTranslation();
  const location = useLocation();

  if (isCheckingSession) return <main className="flex min-h-screen items-center justify-center bg-field-50 px-5 text-slate-700">{t("header.checkingSession")}</main>;
  if (!token || !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <main className="min-h-screen bg-[#f7faf5] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-sm md:flex">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-field-700 text-lg font-bold text-white">AM</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-field-700">{t("common.appName")}</p>
              <h1 className="text-lg font-bold leading-tight">{t("common.platform")}</h1>
            </div>
          </div>

          <nav className="mt-5 flex flex-1 flex-col gap-5 overflow-y-auto" aria-label={t("navigation.mainNavigation")}>
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => (
                    <SidebarLink key={item.path} item={item} onNavigate={() => setIsUserMenuOpen(false)} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="rounded-lg border border-field-100 bg-field-50 p-4 text-center">
            <p className="text-sm font-bold text-slate-950">{t("header.systemReady")}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{t("header.systemReadyDescription")}</p>
          </div>
        </aside>

        <section className="flex min-h-screen flex-1 flex-col md:pl-72">
          <header className="soft-glass-header sticky top-0 z-20 px-4 py-4 md:px-8">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500"><span className="text-field-700">{t("common.appName")}</span> / {activeItem.label}</p>
                <h2 className="mt-1 text-xl font-bold md:text-2xl">{activeItem.label}</h2>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <LanguageSwitcher />
                <div className="relative">
                  <button
                    className="soft-glass-pill flex items-center gap-3 rounded-full py-1.5 pl-2 pr-3 text-left transition hover:bg-white/90"
                    type="button"
                    onClick={() => setIsUserMenuOpen((open) => !open)}
                    aria-expanded={isUserMenuOpen}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-field-700 text-sm font-bold text-white">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
                    <span className="hidden sm:block">
                      <span className="block text-sm font-semibold text-slate-950">{user.name}</span>
                      <span className="block text-xs text-slate-500">{user.role === "admin" ? t("header.admin") : t("header.user")}</span>
                    </span>
                    <span className="text-slate-400">⌄</span>
                  </button>

                  {isUserMenuOpen && (
                    <div className="soft-glass-menu absolute right-0 mt-2 w-64 p-3">
                      <div className="border-b border-slate-100 pb-3">
                        <p className="text-sm font-semibold text-slate-950">{user.name}</p>
                        <div className="mt-2"><StatusBadge label={user.role === "admin" ? t("header.admin") : t("header.user")} tone={user.role === "admin" ? "success" : "info"} /></div>
                      </div>
                      <button className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50" type="button" onClick={onLogout}>{t("header.logout")}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <Suspense fallback={<PageLoadingFallback />}>
            <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">
              {children}
            </div>
          </Suspense>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t border-slate-200 bg-white p-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:hidden" aria-label={t("navigation.mobileNavigation")}>
        {navigationItems.map((item) => (
          <MobileNavLink key={item.path} item={item} />
        ))}
      </nav>
    </main>
  );
}

function PageLoadingFallback() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8">
      <p className="rounded-lg border border-field-100 bg-white p-4 text-sm text-slate-700">{t("common.loading")}...</p>
    </div>
  );
}

function SidebarLink({ item, onNavigate }: { item: NavigationItem; onNavigate: () => void }) {
  return (
    <NavLink
      className={({ isActive }) => `block w-full rounded-md px-3 py-3 text-left transition ${isActive ? "bg-field-700 text-white shadow-sm" : "text-slate-700 hover:bg-field-50"}`}
      to={item.path}
      onClick={onNavigate}
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{item.label}</span>
            {item.badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-field-100 text-field-700"}`}>{item.badge}</span>}
          </span>
          <span className={`mt-1 block text-xs ${isActive ? "text-field-50" : "text-slate-500"}`}>{item.description}</span>
        </>
      )}
    </NavLink>
  );
}

function MobileNavLink({ item }: { item: NavigationItem }) {
  return (
    <NavLink
      className={({ isActive }) => `rounded-md px-1 py-2 text-center text-xs font-semibold ${isActive ? "bg-field-700 text-white" : "text-slate-600"}`}
      to={item.path}
    >
      {item.shortLabel}
    </NavLink>
  );
}

function getRedirectPath(state: unknown): AppRoute {
  if (!state || typeof state !== "object") return fallbackAuthenticatedPath;
  const from = (state as { from?: unknown }).from;
  return isAppRoute(from) ? from : fallbackAuthenticatedPath;
}

function isAppRoute(value: unknown): value is AppRoute {
  return value === "/dashboard" || value === "/monitoring" || value === "/market-prices" || value === "/finance";
}

export default App;

