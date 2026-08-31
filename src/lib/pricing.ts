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
    listing_limit: 250,
    ai_credits: 100,
    features: ["Busca e clonagem de anúncios", "Até 250 criações/duplicações por ciclo", "100 créditos de IA por ciclo", "Editor e publicação no Mercado Livre"],
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
    listing_limit: 1000,
    ai_credits: 300,
    features: ["Tudo do Starter", "Até 1.000 criações/duplicações por ciclo", "300 créditos de IA por ciclo", "Clonagem e otimização em massa", "Relatórios de vendas"],
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
    listing_limit: 3000,
    ai_credits: 750,
    features: ["Tudo do Pro", "Até 3.000 criações/duplicações por ciclo", "750 créditos de IA por ciclo", "Radar e oportunidades", "Lucro e margem"],
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
    ai_credits: 1000,
    features: ["Tudo do Premium", "Criações/duplicações ilimitadas", "1.000 créditos de IA por ciclo", "Suporte prioritário"],
    highlighted: false,
    active: true,
    sort_order: 4,
  },
];
