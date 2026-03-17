import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockSmsProvider,
  ZenviaSmsProvider,
  getSmsProvider,
} from "../provider";

describe("MockSmsProvider", () => {
  it("isConfigured retorna true", () => {
    const p = new MockSmsProvider();
    expect(p.isConfigured()).toBe(true);
  });

  it("send retorna success e providerMessageId fake", async () => {
    const p = new MockSmsProvider();
    const r = await p.send("5511999998888", "Olá");
    expect(r.success).toBe(true);
    expect(r.providerMessageId).toMatch(/^mock-/);
    expect(r.providerResponse).toEqual({ mock: true, bodyLength: 3 });
  });
});

describe("ZenviaSmsProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("isConfigured retorna false sem ZENVIA_API_KEY", () => {
    delete process.env.ZENVIA_API_KEY;
    delete process.env.ZENVIA_API_TOKEN;
    process.env.ZENVIA_FROM = "alias";
    const p = new ZenviaSmsProvider();
    expect(p.isConfigured()).toBe(false);
  });

  it("isConfigured retorna false sem ZENVIA_FROM", () => {
    process.env.ZENVIA_API_KEY = "key";
    delete process.env.ZENVIA_FROM;
    delete process.env.SMS_FROM;
    const p = new ZenviaSmsProvider();
    expect(p.isConfigured()).toBe(false);
  });

  it("isConfigured retorna true com ZENVIA_API_KEY e ZENVIA_FROM", () => {
    process.env.ZENVIA_API_KEY = "key";
    process.env.ZENVIA_FROM = "alias";
    const p = new ZenviaSmsProvider();
    expect(p.isConfigured()).toBe(true);
  });

  it("send sem api key retorna success false e errorMessage", async () => {
    delete process.env.ZENVIA_API_KEY;
    process.env.ZENVIA_FROM = "alias";
    const p = new ZenviaSmsProvider();
    const r = await p.send("11999998888", "Teste");
    expect(r.success).toBe(false);
    expect(r.errorMessage).toContain("ZENVIA_API_KEY");
  });

  it("send sem from retorna success false", async () => {
    process.env.ZENVIA_API_KEY = "key";
    delete process.env.ZENVIA_FROM;
    const p = new ZenviaSmsProvider();
    const r = await p.send("11999998888", "Teste");
    expect(r.success).toBe(false);
    expect(r.errorMessage).toContain("ZENVIA_FROM");
  });

  it("send com fetch 200 e id mapeia para SmsSendResult", async () => {
    process.env.ZENVIA_API_KEY = "key";
    process.env.ZENVIA_FROM = "meu-alias";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ id: "msg-123" })),
    });
    vi.stubGlobal("fetch", fetchMock);

    const p = new ZenviaSmsProvider();
    const r = await p.send("11999998888", "Olá");

    expect(r.success).toBe(true);
    expect(r.providerMessageId).toBe("msg-123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.zenvia.com/v2/channels/sms/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-API-TOKEN": "key",
          "Content-Type": "application/json",
        }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe("meu-alias");
    expect(body.to).toBe("5511999998888");
    expect(body.contents).toEqual([{ type: "text", text: "Olá" }]);

    vi.unstubAllGlobals();
  });

  it("send com fetch 401 retorna success false e errorMessage amigável", async () => {
    process.env.ZENVIA_API_KEY = "key";
    process.env.ZENVIA_FROM = "alias";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () =>
          Promise.resolve(
            JSON.stringify({ code: "AUTHENTICATION_ERROR", message: "No token" })
          ),
      })
    );

    const p = new ZenviaSmsProvider();
    const r = await p.send("11999998888", "Teste");

    expect(r.success).toBe(false);
    expect(r.errorMessage).toContain("ZENVIA_API_KEY inválida");

    vi.unstubAllGlobals();
  });

  it("send com timeout retorna success false", async () => {
    process.env.ZENVIA_API_KEY = "key";
    process.env.ZENVIA_FROM = "alias";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            const e = new Error("Aborted");
            (e as Error & { name: string }).name = "AbortError";
            reject(e);
          })
      )
    );

    const p = new ZenviaSmsProvider();
    const r = await p.send("11999998888", "Teste");

    expect(r.success).toBe(false);
    expect(r.errorMessage).toMatch(/Timeout|Abort/);

    vi.unstubAllGlobals();
  });
});

describe("getSmsProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("SMS_PROVIDER=mock retorna MockSmsProvider", async () => {
    process.env.SMS_PROVIDER = "mock";
    const { getSmsProvider: getProvider } = await import("../provider");
    const p = getProvider();
    expect(p.name).toBe("mock");
    const r = await p.send("11999998888", "x");
    expect(r.success).toBe(true);
  });

  it("SMS_PROVIDER=zenvia sem key retorna mock (fallback)", async () => {
    process.env.SMS_PROVIDER = "zenvia";
    delete process.env.ZENVIA_API_KEY;
    process.env.ZENVIA_FROM = "alias";
    const { getSmsProvider: getProvider } = await import("../provider");
    const p = getProvider();
    expect(p.name).toBe("mock");
  });

  it("SMS_PROVIDER=zenvia com key e from retorna ZenviaSmsProvider", async () => {
    process.env.SMS_PROVIDER = "zenvia";
    process.env.ZENVIA_API_KEY = "key";
    process.env.ZENVIA_FROM = "alias";
    const { getSmsProvider: getProvider } = await import("../provider");
    const p = getProvider();
    expect(p.name).toBe("zenvia");
  });
});
