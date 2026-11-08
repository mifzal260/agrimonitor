import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearToken, getRefreshToken, getToken, setAuthTokens, setToken } from "../../auth/authStorage";
import { ApiError, apiRequest, apiStreamRequest, resetUnauthorizedHandler } from "../client";

function mockFetch(status: number, body: unknown = { detail: "Request failed" }, headers = new Headers()) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
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

  it("exposes Retry-After for 429 responses", async () => {
    const headers = new Headers({ "Retry-After": "60" });
    mockFetch(429, { detail: "Too many attempts" }, headers);

    await expect(apiRequest("/auth/login")).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 60,
    } satisfies Partial<ApiError>);
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

  it("single-flights concurrent refreshes and stores rotated tokens", async () => {
    setAuthTokens("expired-access", "initial-refresh");
    let refreshCalls = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get("Authorization");
      if (String(input).endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return { ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue({ access_token: "rotated-access", refresh_token: "rotated-refresh", token_type: "bearer", expires_in: 900, refresh_expires_in: 1209600, user: { id: 1, name: "Farmer", email: "farmer@example.com", role: "user" } }) } as unknown as Response;
      }
      if (authorization === "Bearer expired-access") {
        return { ok: false, status: 401, headers: new Headers(), json: vi.fn().mockResolvedValue({ detail: "Expired" }) } as unknown as Response;
      }
      return { ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue({ ok: true }) } as unknown as Response;
    });

    await Promise.all([apiRequest("/private-a"), apiRequest("/private-b")]);
    expect(refreshCalls).toBe(1);
    expect(getToken()).toBe("rotated-access");
    expect(getRefreshToken()).toBe("rotated-refresh");
  });

  it("clears both tokens when refresh is rejected", async () => {
    setAuthTokens("expired-access", "replayed-refresh");
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers(), json: vi.fn().mockResolvedValue({ detail: "Expired" }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers(), json: vi.fn().mockResolvedValue({ detail: "Sesi tidak sah" }) } as unknown as Response);
    await expect(apiRequest("/private")).rejects.toThrow("Sesi tidak sah");
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
  it("does not restore a stale refresh response after local logout", async () => {
    setAuthTokens("expired-access", "refresh-before-logout");
    let resolveRefresh: (response: Response) => void = () => undefined;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers(), json: vi.fn().mockResolvedValue({ detail: "Expired" }) } as unknown as Response)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRefresh = resolve; }));

    const pending = apiRequest("/private");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    clearToken();
    resolveRefresh({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ access_token: "stale-access", refresh_token: "stale-refresh" }),
    } as unknown as Response);

    await expect(pending).rejects.toThrow("Session changed during refresh");
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });});

describe("streaming API requests", () => {
  beforeEach(() => {
    clearToken();
    resetUnauthorizedHandler();
    vi.unstubAllGlobals();
  });

  it("adds the current bearer token to a streaming request", async () => {
    setToken("stream-token");
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: {} as ReadableStream<Uint8Array>,
    } as Response;
    globalThis.fetch = vi.fn().mockResolvedValue(response);

    await expect(apiStreamRequest("/agri-chat/chat", { method: "POST" })).resolves.toBe(response);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer stream-token");
  });
});
