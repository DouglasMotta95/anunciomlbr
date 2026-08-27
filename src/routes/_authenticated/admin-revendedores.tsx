import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { ResellersTab } from "@/components/admin/ResellersTab";
import { checkIsAdmin } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/admin-revendedores")({
  head: () => ({ meta: [{ title: "Revendedores — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard", replace: true });
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: () => <AdminLayout activeSection="revendedores" onSectionChange={(section) => { if (section === "revendedores") return; window.location.href = "/admin"; }}><ResellersTab /></AdminLayout>,
});
