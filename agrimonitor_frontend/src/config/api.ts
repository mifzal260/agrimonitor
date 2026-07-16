const developmentApiBaseUrl = "http://localhost:8000/api/v1";

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function getConfiguredApiBaseUrl() {
  const explicitUrl = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;
  if (explicitUrl) return stripTrailingSlash(explicitUrl);

  if (import.meta.env.DEV || ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return developmentApiBaseUrl;
  }

  return "";
}

export const apiBaseUrl = getConfiguredApiBaseUrl();

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}
