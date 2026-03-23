import { describe, it, expect } from "vitest";
import { classifyInvokeError } from "../lib/invoke-error";

// ── IMPORTANT-10: Differentiate error kinds from edge function invocations ────

function makeHttpError(status: number, body: unknown) {
  const err = new Error("Edge Function returned a non-2xx status code");
  (err as any).context = {
    status,
    json: () => Promise.resolve(body),
  };
  return err;
}

describe("classifyInvokeError", () => {
  it("returns 'connection' for a plain fetch Error (no context)", async () => {
    expect(await classifyInvokeError(new Error("Failed to fetch"))).toBe("connection");
  });

  it("returns 'pro_gate' for 429 with Pro subscription message", async () => {
    const err = makeHttpError(429, {
      error: "This feature requires a Pro subscription. Upgrade at usehunter.app/settings.",
    });
    expect(await classifyInvokeError(err)).toBe("pro_gate");
  });

  it("returns 'rate_limit' for 429 without Pro subscription message", async () => {
    const err = makeHttpError(429, { error: "Too many requests. Please try again later." });
    expect(await classifyInvokeError(err)).toBe("rate_limit");
  });

  it("returns 'rate_limit' for 429 when body is unreadable", async () => {
    const err = new Error("Edge Function returned a non-2xx status code");
    (err as any).context = {
      status: 429,
      json: () => Promise.reject(new Error("body consumed")),
    };
    expect(await classifyInvokeError(err)).toBe("rate_limit");
  });

  it("returns 'timeout' for 504", async () => {
    const err = makeHttpError(504, { error: "Interview coach timed out" });
    expect(await classifyInvokeError(err)).toBe("timeout");
  });

  it("returns 'generic' for 500", async () => {
    const err = makeHttpError(500, { error: "Service temporarily unavailable" });
    expect(await classifyInvokeError(err)).toBe("generic");
  });

  it("returns 'generic' for non-Error values", async () => {
    expect(await classifyInvokeError("string error")).toBe("generic");
    expect(await classifyInvokeError(null)).toBe("generic");
  });
});
