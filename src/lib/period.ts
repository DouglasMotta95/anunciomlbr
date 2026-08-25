export type PeriodKey = "hoje" | "7d" | "30d" | "3m" | "6m" | "12m" | "custom";

export const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "custom", label: "Personalizado" },
];

/** Converte a chave do período em um intervalo ISO (from/to) para consultas. */
export function resolvePeriodRange(
  period: PeriodKey,
  custom?: { from: string; to: string },
): { fromISO: string; toISO: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (period === "custom" && custom?.from && custom?.to) {
    const from = new Date(custom.from);
    from.setHours(0, 0, 0, 0);
    const customTo = new Date(custom.to);
    customTo.setHours(23, 59, 59, 999);
    return { fromISO: from.toISOString(), toISO: customTo.toISOString() };
  }

  const from = new Date(now);
  switch (period) {
    case "hoje":
      from.setHours(0, 0, 0, 0);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "12m":
      from.setMonth(from.getMonth() - 12);
      break;
  }
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}
