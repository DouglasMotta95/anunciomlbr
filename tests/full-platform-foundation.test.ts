import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20260903170000_full_platform_foundation.sql","utf8");
const server=readFileSync("src/lib/platform-operations.functions.ts","utf8");
const nav=readFileSync("src/components/app/AppShell.tsx","utf8");
describe("full platform foundation",()=>{
 test("multiconta, equipe, lotes e kits têm RLS",()=>{for(const table of ["seller_accounts","workspace_members","bulk_operations","product_kits","catalog_actions"]){expect(migration).toContain(`alter table public.${table} enable row level security`)}});
 test("lotes começam em simulação e validam propriedade",()=>{expect(server).toContain('status: "simulated"');expect(server).toContain('dry_run: true');expect(server).toContain('external_write: false');expect(server).toContain('.eq("user_id", user.id).in("id", data.listingIds)')});
 test("não reestrutura tokens legados automaticamente",()=>{expect(migration).not.toContain("alter table public.ml_tokens");expect(migration).not.toContain("drop table public.ml_tokens")});
 test("novos módulos aparecem na navegação",()=>{expect(nav).toContain('/operacao-massa');expect(nav).toContain('/kits');expect(nav).toContain('/equipe')});
});
