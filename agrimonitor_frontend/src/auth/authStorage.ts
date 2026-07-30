export const authTokenStorageKey = "agrimonitor_access_token";
export const authRefreshTokenStorageKey = "agrimonitor_refresh_token";
export const authSessionExpiredEvent = "agrimonitor:session-expired";

export function getToken() {
  return sessionStorage.getItem(authTokenStorageKey);
}

export function getRefreshToken() {
  return sessionStorage.getItem(authRefreshTokenStorageKey);
}

export function setToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    clearToken();
    return;
  }
  sessionStorage.setItem(authTokenStorageKey, normalizedToken);
}

export function setRefreshToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    clearToken();
    return;
  }
  sessionStorage.setItem(authRefreshTokenStorageKey, normalizedToken);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  if (!accessToken.trim() || !refreshToken.trim()) {
    clearToken();
    return;
  }
  sessionStorage.setItem(authTokenStorageKey, accessToken.trim());
  sessionStorage.setItem(authRefreshTokenStorageKey, refreshToken.trim());
}

export function clearToken() {
  sessionStorage.removeItem(authTokenStorageKey);
  sessionStorage.removeItem(authRefreshTokenStorageKey);
}

export function isAuthenticated() {
  return Boolean(getToken()?.trim());
}

export function migrateLegacyToken() {
  const legacyToken = localStorage.getItem(authTokenStorageKey);
  localStorage.removeItem(authTokenStorageKey);
  localStorage.removeItem(authRefreshTokenStorageKey);
  if (legacyToken && !getToken()) setToken(legacyToken);
  return getToken();
}

export function notifySessionExpired() {
  window.dispatchEvent(new Event(authSessionExpiredEvent));
}
