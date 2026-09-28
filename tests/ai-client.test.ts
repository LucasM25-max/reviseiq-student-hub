import { describe, expect, it, vi } from "vitest";

import { callGemini, type GeminiRequest } from "@/lib/ai/client";
import { MARK_RESPONSE_SCHEMA } from "@/lib/ai/schema";

const request: GeminiRequest = {
  systemInstruction: "You are an examiner.",
  prompt: "Mark this.",
  responseSchema: MARK_RESPONSE_SCHEMA,
  temperature: 0,
  maxOutputTokens: 1200,
  timeoutMs: 5000,
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const candidate = (text: string, finishReason = "STOP") => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason }],
  usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 350 },
});

describe("callGemini", () => {
  it("fails fast and cheaply when there is no key", async () => {
    const fetchImpl = vi.fn();
    const result = await callGemini(request, { apiKey: null, fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-key");
    // The important part: no request was made at all.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns the text and token usage on success", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(candidate('{"ok":true}')));
    const result = await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe('{"ok":true}');
      expect(result.usage.inputTokens).toBe(1000);
      expect(result.usage.outputTokens).toBe(350);
    }
  });

  it("sends the key as a header, never in the URL", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(candidate("{}")),
    );
    await callGemini(request, { apiKey: "secret-key", fetchImpl: fetchImpl as never });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).not.toContain("secret-key");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
  });

  it("asks for deterministic, schema-constrained JSON", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(candidate("{}")),
    );
    await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    const [, init] = fetchImpl.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));

    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toEqual(MARK_RESPONSE_SCHEMA);
    expect(body.generationConfig.maxOutputTokens).toBe(1200);
    expect(body.systemInstruction.parts[0].text).toBe("You are an examiner.");
  });

  it("puts the model in the path, so GEMINI_MODEL actually routes", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(candidate("{}")),
    );
    await callGemini(request, {
      apiKey: "k",
      model: "gemini-3.5-flash-lite",
      fetchImpl: fetchImpl as never,
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "gemini-3.5-flash-lite:generateContent",
    );
  });

  it("reports an HTTP error with its status, and does not throw", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota exceeded", { status: 429 }));
    const result = await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("http");
      expect(result.status).toBe(429);
      expect(result.detail).toContain("quota");
    }
  });

  it("reports a body that is not JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>502</html>", { status: 200 }));
    const result = await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("reports an empty candidate list rather than returning empty text", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ candidates: [] }));
    const result = await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("reports a safety block distinctly, so it can be told apart in the ledger", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ promptFeedback: { blockReason: "SAFETY" } }),
    );
    const result = await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("blocked");
      expect(result.detail).toBe("SAFETY");
    }
  });

  it("treats a response truncated by the token cap as unusable", async () => {
    // MAX_TOKENS leaves a JSON fragment behind, which would parse as nothing useful.
    const fetchImpl = vi.fn(async () =>
      jsonResponse(candidate('{"awardedMarks": 2, "pointsAw', "MAX_TOKENS")),
    );
    const result = await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blocked");
  });

  it("aborts rather than hanging, and says so", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );

    const result = await callGemini(
      { ...request, timeoutMs: 10 },
      { apiKey: "k", fetchImpl: fetchImpl as never },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("timeout");
  });

  it("reports a network failure without throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const result = await callGemini(request, { apiKey: "k", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("network");
      expect(result.detail).toContain("ECONNREFUSED");
    }
  });

  it("measures latency from a clock it is given", async () => {
    let t = 1000;
    const now = () => t;
    const fetchImpl = vi.fn(async () => {
      t += 250;
      return jsonResponse(candidate("{}"));
    });

    const result = await callGemini(request, {
      apiKey: "k",
      fetchImpl: fetchImpl as never,
      now,
    });
    expect(result.latencyMs).toBe(250);
  });
});
