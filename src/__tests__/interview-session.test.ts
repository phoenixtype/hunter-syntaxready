import { describe, it, expect, vi, afterEach } from "vitest";
import { parseStoredSession, serializeSession } from "../lib/interview-session";

// ── IMPORTANT-9: localStorage session TTL ─────────────────────────────────────

describe("parseStoredSession", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns null for null input", () => {
    expect(parseStoredSession(null)).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    expect(parseStoredSession("{not json")).toBeNull();
  });

  it("returns null for empty messages array", () => {
    const raw = JSON.stringify({ messages: [], mode: "behavioral", savedAt: Date.now() });
    expect(parseStoredSession(raw)).toBeNull();
  });

  it("returns session when savedAt is within TTL", () => {
    const raw = JSON.stringify({
      messages: [{ role: "assistant", content: "Hi" }],
      mode: "behavioral",
      savedAt: Date.now() - 60_000, // 1 minute ago
    });
    const result = parseStoredSession(raw);
    expect(result).not.toBeNull();
    expect(result!.messages).toHaveLength(1);
    expect(result!.mode).toBe("behavioral");
  });

  it("returns null when savedAt is past TTL", () => {
    const TTL = 24 * 60 * 60 * 1000;
    const raw = JSON.stringify({
      messages: [{ role: "assistant", content: "Hi" }],
      mode: "behavioral",
      savedAt: Date.now() - TTL - 1,
    });
    expect(parseStoredSession(raw)).toBeNull();
  });

  it("respects a custom ttlMs argument", () => {
    const raw = JSON.stringify({
      messages: [{ role: "assistant", content: "Hi" }],
      mode: "technical",
      savedAt: Date.now() - 5_000, // 5 seconds ago
    });
    // 3-second TTL → expired
    expect(parseStoredSession(raw, 3_000)).toBeNull();
    // 10-second TTL → still valid
    expect(parseStoredSession(raw, 10_000)).not.toBeNull();
  });

  it("accepts sessions that have no savedAt field (backward compatibility)", () => {
    const raw = JSON.stringify({
      messages: [{ role: "assistant", content: "Hi" }],
      mode: "negotiation",
    });
    const result = parseStoredSession(raw);
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("negotiation");
  });
});

describe("serializeSession", () => {
  it("includes a savedAt timestamp close to now", () => {
    const before = Date.now();
    const raw = serializeSession([{ role: "user", content: "hello" }], "behavioral");
    const after = Date.now();

    const parsed = JSON.parse(raw);
    expect(parsed.savedAt).toBeGreaterThanOrEqual(before);
    expect(parsed.savedAt).toBeLessThanOrEqual(after);
  });

  it("serialises messages and mode correctly", () => {
    const msgs = [{ role: "assistant", content: "Go!" }];
    const raw = serializeSession(msgs, "technical");
    const parsed = JSON.parse(raw);
    expect(parsed.messages).toEqual(msgs);
    expect(parsed.mode).toBe("technical");
  });
});
