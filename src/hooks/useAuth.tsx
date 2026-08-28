import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { hasSupabaseBrowserConfig, supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/roles.functions";

export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

export function useAuth(): AuthState {
  const queryClient = useQueryClient();
  const configured = hasSupabaseBrowserConfig();

  const { data, isLoading } = useQuery({
    queryKey: ["auth-session"],
    enabled: configured,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session ?? null;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!configured) return;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // Derruba a sessão na UI imediatamente e remove qualquer dado privado da conta anterior.
        queryClient.setQueryData(["auth-session"], null);
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== "auth-session",
        });
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        queryClient.setQueryData(["auth-session"], session ?? null);
        queryClient.invalidateQueries({ queryKey: ["auth-session"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [configured, queryClient]);

  if (!configured) return { user: null, session: null, loading: false };
  return { user: data?.user ?? null, session: data ?? null, loading: isLoading };
}

export function useIsAdmin() {
  const { user } = useAuth();
  const checkAdmin = useServerFn(checkIsAdmin);
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { isAdmin } = await checkAdmin();
      return isAdmin;
    },
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
