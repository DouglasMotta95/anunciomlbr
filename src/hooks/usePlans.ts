import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  PERIOD_FALLBACK,
  PUBLIC_PLAN_FALLBACK,
  type PeriodDiscount,
  type Plan,
} from "@/lib/pricing";

export function usePlans() {
  const includeAddons = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  return useQuery({
    queryKey: ["plans", includeAddons ? "admin" : "public"],
    queryFn: async (): Promise<Plan[]> => {
      try {
        let query = supabase.from("plans").select("*").eq("active", true);
        if (!includeAddons) query = query.not("kind", "in", '("ad_package","ai_package")');
        const { data, error } = await query.order("sort_order");
        if (error) throw error;
        const rows = (data ?? []).map((p) => ({
          ...p,
          features: Array.isArray(p.features) ? (p.features as string[]) : [],
        })) as Plan[];
        if (!includeAddons && rows.length === 0) return PUBLIC_PLAN_FALLBACK;
        return rows;
      } catch (error) {
        if (!includeAddons) {
          console.warn("[plans] Falha ao carregar catálogo público; usando fallback local.", error);
          return PUBLIC_PLAN_FALLBACK;
        }
        throw error;
      }
    },
  });
}

export function usePeriods() {
  return useQuery({
    queryKey: ["period-discounts"],
    queryFn: async (): Promise<PeriodDiscount[]> => {
      try {
        const { data, error } = await supabase.from("period_discounts").select("*");
        if (error) throw error;
        const order: Record<string, number> = { monthly: 0, quarterly: 1, semiannual: 2, annual: 3 };
        const rows = (data ?? []) as PeriodDiscount[];
        if (!rows.length) return PERIOD_FALLBACK;
        return [...rows].sort((a, b) => (order[a.period] ?? 9) - (order[b.period] ?? 9));
      } catch (error) {
        console.warn("[pricing] Falha ao carregar períodos; usando fallback local.", error);
        return PERIOD_FALLBACK;
      }
    },
  });
}
