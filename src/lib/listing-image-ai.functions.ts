import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(5000).nullish(),
  category: z.string().trim().max(160).nullish(),
  attributes: z.unknown().optional(),
});

function extensionFor(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

function buildPrompt(data: z.infer<typeof inputSchema>) {
  const attrs = Array.isArray(data.attributes)
    ? data.attributes.slice(0, 20).map((item: any) => {
        const name = item?.name ?? item?.id ?? "";
        const value = item?.value_name ?? item?.value ?? "";
        return name && value ? `${name}: ${value}` : null;
      }).filter(Boolean).join("; ")
    : "";
  return [
    "Crie uma fotografia profissional de e-commerce do produto descrito abaixo.",
    "Produto centralizado, fundo branco ou cinza muito claro, iluminação de estúdio, aparência realista, alta nitidez, composição limpa e adequada para marketplace.",
    "Não adicione preço, texto promocional, logotipo, selo, moldura ou marca-d'água visível.",
    "Não invente acessórios, funções, cores, conectores, embalagem ou características que não estejam explicitamente informadas.",
    `Título: ${data.title}`,
    data.category ? `Categoria: ${data.category}` : "",
    data.description ? `Descrição: ${data.description.slice(0, 1800)}` : "",
    attrs ? `Atributos confirmados: ${attrs}` : "",
  ].filter(Boolean).join("\n");
}

export const generateListingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { ok: false as const, reason: "A geração de imagens por IA ainda não está configurada no servidor." };

    const { getAiQuota, consumeAiQuota } = await import("@/lib/ai-quota.server");
    const quota = await getAiQuota(context.userId);
    if (quota.remaining < 1) {
      return { ok: false as const, reason: `Créditos de IA esgotados (${quota.used}/${quota.credit_limit}).` };
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(data) }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[Gemini image generation]", response.status, detail.slice(0, 500));
      return { ok: false as const, reason: "Não foi possível gerar a imagem agora. Tente novamente em instantes." };
    }

    const payload = await response.json().catch(() => null) as any;
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data);
    const inline = imagePart?.inlineData ?? imagePart?.inline_data;
    const base64 = typeof inline?.data === "string" ? inline.data : null;
    const mimeType = typeof inline?.mimeType === "string" ? inline.mimeType : typeof inline?.mime_type === "string" ? inline.mime_type : "image/png";
    if (!base64) return { ok: false as const, reason: "A IA não retornou uma imagem válida. Gere novamente." };

    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) {
      return { ok: false as const, reason: "A imagem gerada ficou inválida ou grande demais. Gere novamente." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = "ai-listing-images";
    const path = `${context.userId}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(mimeType)}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) {
      console.error("[AI image upload]", uploadError.message);
      return { ok: false as const, reason: "A imagem foi gerada, mas não foi possível salvá-la. Verifique a migration do armazenamento." };
    }

    const credit = await consumeAiQuota(context.userId, 1);
    if (!credit.ok) {
      await supabaseAdmin.storage.from(bucket).remove([path]).catch(() => undefined);
      return { ok: false as const, reason: credit.reason };
    }

    const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return {
      ok: true as const,
      url: publicData.publicUrl,
      remaining: credit.quota.remaining,
    };
  });
