import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { callGeminiAuthenticated } from "../src/lib/gemini.functions";
import { geminiGenerate } from "../src/lib/gemini.server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env["GEMINI_API_KEY"];
const originalGoogleKey = process.env["GOOGLE_API_KEY"];

function quota(remaining: number) {
  return { used: 10 - remaining, credit_limit: 10, remaining };
}

beforeEach(() => {
  process.env["GEMINI_API_KEY"] = "test-key-never-sent-to-a-real-provider";
  delete process.env["GOOGLE_API_KEY"];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGeminiKey === undefined) delete process.env["GEMINI_API_KEY"];
  else process.env["GEMINI_API_KEY"] = originalGeminiKey;
  if (originalGoogleKey === undefined) delete process.env["GOOGLE_API_KEY"];
  else process.env["GOOGLE_API_KEY"] = originalGoogleKey;
});

describe("callGemini autenticado", () => {
  it("bloqueia antes do provedor quando o usuário não tem crédito", async () => {
    let generated = false;
    const result = await callGeminiAuthenticated(
      { prompt: "teste" },
      USER_ID,
      {
        getQuota: async () => quota(0),
        generate: async () => {
          generated = true;
          return { ok: true as const, result: "não deveria rodar" };
        },
        consume: async () => ({ ok: true as const, quota: quota(0) }),
      },
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "AI_CREDITS_EXHAUSTED" });
    expect(generated).toBe(false);
  });

  it("responde e consome exatamente um crédito após geração bem-sucedida", async () => {
    let consumedAmount = 0;
    let consumedUser = "";
    const result = await callGeminiAuthenticated(
      { prompt: "Responda apenas OK" },
      USER_ID,
      {
        getQuota: async () => quota(5),
        generate: async () => ({ ok: true as const, result: "OK" }),
        consume: async (userId, amount) => {
          consumedUser = userId;
          consumedAmount = amount;
          return { ok: true as const, quota: quota(4) };
        },
      },
    );

    expect(result).toEqual({ ok: true, text: "OK", remaining: 4 });
    expect(consumedUser).toBe(USER_ID);
    expect(consumedAmount).toBe(1);
  });

  it("propaga limite 429 sem consumir crédito", async () => {
    globalThis.fetch = async () => new Response("{}", { status: 429 });
    let consumed = false;
    const result = await callGeminiAuthenticated(
      { prompt: "teste" },
      USER_ID,
      {
        getQuota: async () => quota(5),
        generate: geminiGenerate,
        consume: async () => {
          consumed = true;
          return { ok: true as const, quota: quota(4) };
        },
      },
    );

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(consumed).toBe(false);
  });

  it("trata falha de conexão sem consumir crédito", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("connection refused");
    };
    let consumed = false;
    const result = await callGeminiAuthenticated(
      { prompt: "teste" },
      USER_ID,
      {
        getQuota: async () => quota(5),
        generate: geminiGenerate,
        consume: async () => {
          consumed = true;
          return { ok: true as const, quota: quota(4) };
        },
      },
    );

    expect(result).toMatchObject({ ok: false, code: "network" });
    expect(consumed).toBe(false);
  });

  it("trata timeout sem consumir crédito", async () => {
    globalThis.fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });

    let consumed = false;
    const result = await callGeminiAuthenticated(
      { prompt: "teste" },
      USER_ID,
      {
        getQuota: async () => quota(5),
        generate: (prompt, options) => geminiGenerate(prompt, { ...options, timeoutMs: 5 }),
        consume: async () => {
          consumed = true;
          return { ok: true as const, quota: quota(4) };
        },
      },
    );

    expect(result).toMatchObject({ ok: false, code: "timeout" });
    expect(consumed).toBe(false);
  });
});
