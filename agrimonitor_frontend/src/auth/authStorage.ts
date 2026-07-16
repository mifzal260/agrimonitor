export const authTokenStorageKey = "agrimonitor_access_token";
export const authSessionExpiredEvent = "agrimonitor:session-expired";

export function getToken() {
  return sessionStorage.getItem(authTokenStorageKey);
}

export function setToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    clearToken();
    return;
  }
  sessionStorage.setItem(authTokenStorageKey, normalizedToken);
}

export function clearToken() {
  sessionStorage.removeItem(authTokenStorageKey);
}

export function isAuthenticated() {
  return Boolean(getToken()?.trim());
}

export function migrateLegacyToken() {
  const legacyToken = localStorage.getItem(authTokenStorageKey);
  if (!legacyToken) return getToken();

  localStorage.removeItem(authTokenStorageKey);
  if (!getToken()) setToken(legacyToken);
  return getToken();
}

export function notifySessionExpired() {
  window.dispatchEvent(new Event(authSessionExpiredEvent));
}
