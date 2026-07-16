import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearToken, getToken, setToken } from "../../auth/authStorage";
import { apiRequest, resetUnauthorizedHandler } from "../client";

function mockFetch(status: number, body: unknown = { detail: "Request failed" }) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe("api client 401 handling", () => {
  beforeEach(() => {
    clearToken();
    resetUnauthorizedHandler();
    vi.unstubAllGlobals();
  });

  it("adds bearer token centrally", async () => {
    setToken("central-token");
    mockFetch(200, { ok: true });

    await apiRequest("/health");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Headers).get("Authorization")).toBe("Bearer central-token");
  });

  it("clears token and dispatches one session-expired event for repeated 401 responses", async () => {
    setToken("expired-token");
    mockFetch(401, { detail: "Expired" });
    const listener = vi.fn();
    window.addEventListener("agrimonitor:session-expired", listener);

    await expect(apiRequest("/private")).rejects.toThrow("Expired");
    await expect(apiRequest("/private-again")).rejects.toThrow("Expired");

    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("agrimonitor:session-expired", listener);
  });

  it.each([403, 404, 500])("does not clear session for %s", async (status) => {
    setToken("still-valid");
    mockFetch(status, { detail: `HTTP ${status}` });
    const listener = vi.fn();
    window.addEventListener("agrimonitor:session-expired", listener);

    await expect(apiRequest("/not-session-error")).rejects.toThrow(`HTTP ${status}`);

    expect(getToken()).toBe("still-valid");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener("agrimonitor:session-expired", listener);
  });

  it("can handle 401 again after reset", async () => {
    setToken("expired-token");
    mockFetch(401, { detail: "Expired" });
    const listener = vi.fn();
    window.addEventListener("agrimonitor:session-expired", listener);

    await expect(apiRequest("/private")).rejects.toThrow("Expired");
    resetUnauthorizedHandler();
    setToken("expired-token-2");
    await expect(apiRequest("/private-again")).rejects.toThrow("Expired");

    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener("agrimonitor:session-expired", listener);
  });
});
