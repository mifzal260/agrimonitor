import { clearToken, getToken, notifySessionExpired } from "../auth/authStorage";
import { buildApiUrl } from "../config/api";

let hasHandledUnauthorized = false;

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

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    if (response.status === 401) handleUnauthorized();
    throw new ApiError(formatApiError(errorBody), response.status, parseRetryAfter(response.headers));
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export async function getHealthStatus() {
  return apiRequest<{ status: string }>("/health");
}
