import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type PlanFeatureFlags = Record<string, boolean>;

export type ActiveLicense = {
  id: string;
  code: string;
  status: string;
  period: string;
  starts_at: string | null;
  expires_at: string | null;
  plan: { id: string; code: string; name: string; listing_limit: number | null; ai_credits: number | null; feature_flags: PlanFeatureFlags | null } | null;
};

export function isPlanFeatureAllowed(flags: PlanFeatureFlags | null | undefined, key: string | null | undefined) {
  if (!key) return true;
  return flags?.[key] !== false;
}

export function useLicense() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["license", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ActiveLicense | null> => {
      // feature_flags foi adicionado por migration recente; o cast pode ser removido
      // quando os tipos gerados do Supabase forem regenerados.
      const db = supabase as any;
      const { data, error } = await db
        .from("licenses")
        .select(
          "id, code, status, period, starts_at, expires_at, plans!inner(id, code, name, listing_limit, ai_credits, kind, feature_flags)",
        )
        .eq("user_id", user!.id)
        .eq("status", "active")
        .neq("plans.kind", "ad_package")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { plans, ...rest } = data as any;
      return { ...rest, plan: plans ?? null } as ActiveLicense;
    },
  });
}

export function useListings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActivity(limit = 12) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["activity", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}
