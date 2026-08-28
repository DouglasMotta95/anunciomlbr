export type BillingPeriod = "monthly" | "quarterly" | "semiannual" | "annual";

export type PeriodDiscount = {
  period: BillingPeriod;
  months: number;
  discount_percent: number;
  label: string;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  price_monthly_cents: number;
  listing_limit: number | null;
  ai_credits: number | null;
  features: string[];
  highlighted: boolean;
  active: boolean;
  sort_order: number;
};

/** Preço total do período, já com o desconto configurado pelo admin. */
export function periodTotalCents(plan: Plan, discount: PeriodDiscount): number {
  const gross = plan.price_monthly_cents * discount.months;
  return Math.round(gross * (1 - Number(discount.discount_percent) / 100));
}

/** Preço equivalente por mês no período escolhido. */
export function periodMonthlyCents(plan: Plan, discount: PeriodDiscount): number {
  return Math.round(periodTotalCents(plan, discount) / discount.months);
}

/** Economia em centavos comparada ao mensal cheio. */
export function periodSavingsCents(plan: Plan, discount: PeriodDiscount): number {
  return plan.price_monthly_cents * discount.months - periodTotalCents(plan, discount);
}

export function renewalDate(discount: PeriodDiscount, from = new Date()): Date {
  const date = new Date(from);
  date.setMonth(date.getMonth() + discount.months);
  return date;
}

export const PERIOD_FALLBACK: PeriodDiscount[] = [
  { period: "monthly", months: 1, discount_percent: 0, label: "Mensal" },
  { period: "quarterly", months: 3, discount_percent: 10, label: "3 meses" },
  { period: "semiannual", months: 6, discount_percent: 15, label: "6 meses" },
  { period: "annual", months: 12, discount_percent: 25, label: "Anual" },
];

// Espelho público do catálogo base. Serve apenas para manter a vitrine e os botões de compra
// visíveis caso a leitura pública do Supabase esteja temporariamente indisponível.
export const PUBLIC_PLAN_FALLBACK: Plan[] = [
  {
    id: "fallback-starter",
    code: "starter",
    name: "STARTER",
    tagline: "Para começar a operar",
    price_monthly_cents: 4990,
    listing_limit: 100,
    ai_credits: 100,
    features: ["Busca de anúncios", "Cópia individual", "Editor de anúncios", "10 anúncios grátis no teste"],
    highlighted: false,
    active: true,
    sort_order: 1,
  },
  {
    id: "fallback-pro",
    code: "pro",
    name: "PRO",
    tagline: "O favorito dos vendedores",
    price_monthly_cents: 8990,
    listing_limit: 500,
    ai_credits: 500,
    features: ["Tudo do Starter", "Cópia em massa", "ANÚNCIO AI", "Relatórios de vendas"],
    highlighted: true,
    active: true,
    sort_order: 2,
  },
  {
    id: "fallback-premium",
    code: "premium",
    name: "PREMIUM",
    tagline: "Escala com inteligência",
    price_monthly_cents: 14990,
    listing_limit: 2000,
    ai_credits: 2000,
    features: ["Tudo do Pro", "Radar de concorrentes", "Oportunidades", "Lucro e margem"],
    highlighted: false,
    active: true,
    sort_order: 3,
  },
  {
    id: "fallback-business",
    code: "business",
    name: "BUSINESS",
    tagline: "Operação profissional",
    price_monthly_cents: 24990,
    listing_limit: null,
    ai_credits: 10000,
    features: ["Tudo do Premium", "Anúncios ilimitados", "Suporte prioritário", "Multi-contas ML"],
    highlighted: false,
    active: true,
    sort_order: 4,
  },
];
