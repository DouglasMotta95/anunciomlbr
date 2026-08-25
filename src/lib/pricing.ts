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
