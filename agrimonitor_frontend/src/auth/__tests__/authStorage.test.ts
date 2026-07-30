import { beforeEach, describe, expect, it } from "vitest";

import { clearToken, getRefreshToken, getToken, isAuthenticated, setAuthTokens, setToken } from "../authStorage";

const tokenKey = "agrimonitor_access_token";

describe("authStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("stores and reads token from sessionStorage", () => {
    setToken("token-123");

    expect(getToken()).toBe("token-123");
    expect(sessionStorage.getItem(tokenKey)).toBe("token-123");
    expect(localStorage.getItem(tokenKey)).toBeNull();
    expect(isAuthenticated()).toBe(true);
  });

  it("clears token from sessionStorage", () => {
    setToken("token-123");
    clearToken();

    expect(getToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("does not treat an empty token as authenticated", () => {
    setToken("");

    expect(getToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("does not treat whitespace tokens as authenticated", () => {
    setToken("   ");

    expect(getToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
    expect(localStorage.getItem(tokenKey)).toBeNull();
  });

  it("stores both tokens only in sessionStorage and clears them together", () => {
    setAuthTokens("access-123", "refresh-456");
    expect(getToken()).toBe("access-123");
    expect(getRefreshToken()).toBe("refresh-456");
    expect(localStorage.length).toBe(0);
    clearToken();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });});
