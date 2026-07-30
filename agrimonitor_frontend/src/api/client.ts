import {
  clearToken,
  getRefreshToken,
  getToken,
  notifySessionExpired,
  setAuthTokens,
} from "../auth/authStorage";
import { buildApiUrl } from "../config/api";
import type { AuthResponse } from "../types/auth";

let hasHandledUnauthorized = false;
let refreshPromise: Promise<string> | null = null;

export class ApiError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function handleUnauthorized() {
  if (hasHandledUnauthorized) return;
  hasHandledUnauthorized = true;
  clearToken();
  notifySessionExpired();
}

export function resetUnauthorizedHandler() {
  hasHandledUnauthorized = false;
}

function formatApiError(errorBody: unknown) {
  if (!errorBody || typeof errorBody !== "object") return "Request failed";

  const detail = (errorBody as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const errorItem = item as { loc?: unknown[]; msg?: string };
        const field = Array.isArray(errorItem.loc) ? errorItem.loc.slice(1).join(".") : "field";
        return errorItem.msg ? `${field}: ${errorItem.msg}` : JSON.stringify(item);
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "Request failed";
}

function parseRetryAfter(headers: Headers) {
  const value = headers.get("Retry-After");
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);

  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate)) return null;
  return Math.max(1, Math.ceil((retryDate - Date.now()) / 1000));
}

function canRefresh(path: string) {
  return !["/auth/login", "/auth/register", "/auth/refresh"].includes(path);
}

async function performRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError("Session refresh unavailable", 401);

  const response = await fetch(buildApiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(formatApiError(body), response.status, parseRetryAfter(response.headers));
  }

  if (getRefreshToken() !== refreshToken) {
    throw new ApiError("Session changed during refresh", 401);
  }

  const refreshed = body as Partial<AuthResponse>;
  if (!refreshed.access_token || !refreshed.refresh_token) {
    throw new ApiError("Invalid refresh response", 401);
  }
  setAuthTokens(refreshed.access_token, refreshed.refresh_token);
  hasHandledUnauthorized = false;
  return refreshed.access_token;
}

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  hasRetried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const requestError = new ApiError(
      formatApiError(errorBody),
      response.status,
      parseRetryAfter(response.headers),
    );

    if (response.status === 401 && !hasRetried && canRefresh(path) && getRefreshToken()) {
      try {
        const newAccessToken = await refreshAccessToken();
        const retryHeaders = new Headers(options.headers);
        retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);
        return apiRequest<T>(path, { ...options, headers: retryHeaders }, true);
      } catch (refreshError) {
        if (!(refreshError instanceof ApiError) || refreshError.status !== 401) throw refreshError;
        handleUnauthorized();
        throw refreshError;
      }
    }

    if (response.status === 401 && canRefresh(path)) handleUnauthorized();
    throw requestError;
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export async function getHealthStatus() {
  return apiRequest<{ status: string }>("/health");
}
