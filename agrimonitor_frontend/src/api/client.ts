const defaultApiBaseUrl = window.location.hostname.includes("onrender.com")
  ? "https://agrimonitor-backend.onrender.com/api/v1"
  : "http://localhost:8000/api/v1";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl;

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

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(formatApiError(errorBody));
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export async function getHealthStatus() {
  return apiRequest<{ status: string }>("/health");
}
