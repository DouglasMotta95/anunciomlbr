import { createFileRoute, Navigate, Outlet, redirect } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/roles.functions";

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin-");
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    let admin = false;
    try {
      const result = await checkIsAdmin();
      admin = result.isAdmin === true;
    } catch {
      admin = false;
    }

    const adminPath = isAdminRoute(location.pathname);
    if (admin && !adminPath) throw redirect({ to: "/admin", replace: true });

    // Se uma sessão de vendedor tentar abrir uma rota administrativa, envie
    // primeiro para o login administrativo separado. Essa tela limpa a sessão
    // atual antes de pedir as credenciais de admin, evitando o redirecionamento
    // confuso de volta para o dashboard do vendedor.
    if (!admin && adminPath) throw redirect({ to: "/admin/login", replace: true });

    return { user: data.user, isAdmin: admin };
  },
  component: AuthenticatedBoundary,
});

function AuthenticatedBoundary() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
}
