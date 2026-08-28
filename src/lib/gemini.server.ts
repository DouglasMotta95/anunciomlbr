/**
 * Cliente server-only do Google Gemini (API oficial generativelanguage).
 * A GEMINI_API_KEY nunca sai do servidor e nunca é registrada em logs.
 */

const DEFAULT_MODEL = process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
const TIMEOUT_MS = 30_000;

export type GeminiFail = { ok: false; reason: string; code: GeminiErrorCode };
export type GeminiErrorCode =
  | "not_configured"
  | "invalid_key"
  | "rate_limited"
  | "api_error"
  | "timeout"
  | "empty"
  | "network"
  | "parse_error";

export type GeminiOk<T> = { ok: true; result: T };

function apiKey(): string | null {
  return process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || null;
}

export function geminiStatus(): { configured: boolean; model: string } {
  return { configured: !!apiKey(), model: DEFAULT_MODEL };
}

export type GeminiOptions = {
  system?: string | null | undefined;
  model?: string | null | undefined;
  json?: boolean | undefined;
  temperature?: number | null | undefined;
  maxOutputTokens?: number | null | undefined;
};

/** Chamada única de texto ao Gemini com tratamento completo de erros. */
export async function geminiGenerate(
  prompt: string,
  options: GeminiOptions = {},
): Promise<GeminiOk<string> | GeminiFail> {
  const key = apiKey();
  if (!key) {
    return { ok: false, code: "not_configured", reason: "A IA não está configurada no servidor (GEMINI_API_KEY ausente)." };
  }

  const model = options.model || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          ...(options.system ? { system_instruction: { parts: [{ text: options.system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            ...(options.json ? { responseMimeType: "application/json" } : {}),
            ...(options.temperature != null ? { temperature: options.temperature } : {}),
            ...(options.maxOutputTokens != null ? { maxOutputTokens: options.maxOutputTokens } : {}),
          },
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, code: "timeout", reason: "A IA demorou demais para responder. Tente novamente." };
    }
    console.error("[gemini] falha de conexão");
    return { ok: false, code: "network", reason: "Não foi possível conectar à IA agora." };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    // Nunca logar a chave nem o corpo (pode ecoar credenciais).
    console.error("[gemini] credencial rejeitada", response.status);
    return { ok: false, code: "invalid_key", reason: "A chave da IA é inválida ou sem permissão. Verifique a GEMINI_API_KEY." };
  }
  if (response.status === 429) {
    return { ok: false, code: "rate_limited", reason: "Limite de requisições da IA atingido. Tente novamente em instantes." };
  }
  if (!response.ok) {
    console.error("[gemini] erro da API", response.status);
    return { ok: false, code: "api_error", reason: `A IA não respondeu corretamente (erro ${response.status}).` };
  }

  let payload: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, code: "parse_error", reason: "Não foi possível interpretar a resposta da IA." };
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) return { ok: false, code: "empty", reason: "A IA retornou uma resposta vazia. Tente novamente." };
  return { ok: true, result: text };
}

/** Igual a geminiGenerate, mas devolve JSON já parseado. */
export async function geminiGenerateJson<T>(
  prompt: string,
  options: GeminiOptions = {},
): Promise<GeminiOk<T> | GeminiFail> {
  const out = await geminiGenerate(prompt, { ...options, json: true });
  if (!out.ok) return out;
  try {
    return { ok: true, result: JSON.parse(out.result) as T };
  } catch {
    return { ok: false, code: "parse_error", reason: "Não foi possível interpretar a resposta JSON da IA." };
  }
}
