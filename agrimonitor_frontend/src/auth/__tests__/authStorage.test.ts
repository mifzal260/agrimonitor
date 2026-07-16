import { beforeEach, describe, expect, it } from "vitest";

import { clearToken, getToken, isAuthenticated, setToken } from "../authStorage";

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
});
