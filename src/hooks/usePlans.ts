import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { PERIOD_FALLBACK, type PeriodDiscount, type Plan } from "@/lib/pricing";

export function usePlans() {
  const includeAddons = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  return useQuery({
    queryKey: ["plans", includeAddons ? "admin" : "public"],
    queryFn: async (): Promise<Plan[]> => {
      let query = supabase.from("plans").select("*").eq("active", true);
      if (!includeAddons) query = query.neq("kind", "ad_package");
      const { data, error } = await query.order("sort_order");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
      })) as Plan[];
    },
  });
}

export function usePeriods() {
  return useQuery({
    queryKey: ["period-discounts"],
    queryFn: async (): Promise<PeriodDiscount[]> => {
      const { data, error } = await supabase.from("period_discounts").select("*");
      if (error) throw error;
      const order: Record<string, number> = { monthly: 0, quarterly: 1, semiannual: 2, annual: 3 };
      const rows = (data ?? []) as PeriodDiscount[];
      if (!rows.length) return PERIOD_FALLBACK;
      return [...rows].sort((a, b) => (order[a.period] ?? 9) - (order[b.period] ?? 9));
    },
  });
}
