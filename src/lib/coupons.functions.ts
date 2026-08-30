import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Cupom muito curto")
    .max(40, "Cupom inválido")
    .regex(/^[A-Za-z0-9_-]+$/, "Cupom inválido"),
});

const messages: Record<string, string> = {
  not_found: "Cupom não encontrado.",
  inactive: "Este cupom não está mais ativo.",
  expired: "Este cupom expirou.",
  exhausted: "Este cupom atingiu o limite de usos.",
};

/** Valida um cupom de desconto para exibir no resumo do pedido. */
export const validateCoupon = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { resolveCoupon } = await import("@/lib/coupons.server");
    const result = await resolveCoupon(data.code);
    if (!result.ok) {
      return { valid: false as const, message: messages[result.reason] ?? "Cupom inválido." };
    }
    return {
      valid: true as const,
      code: result.code,
      discount_percent: result.discount_percent,
      message: `Cupom aplicado: -${result.discount_percent}%`,
    };
  });
