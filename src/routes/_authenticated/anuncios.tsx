import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Pause, Play, PlusCircle, Rocket, Sparkles, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { BulkJobDialog } from "@/components/app/BulkJobDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListings } from "@/hooks/useLicense";
import { startBulkJob } from "@/lib/bulk.functions";
import { formatBRL, formatDate } from "@/lib/format";
import { getProductImage } from "@/lib/product-image";
import { publishListingsBulk, validateListingsForPublish } from "@/lib/publish.functions";

const title = "Meus anúncios — ANÚNCIO ML";
const description = "Gerencie, valide, otimize e publique seus anúncios em massa.";
export const Route = createFileRoute("/_authenticated/anuncios")({ head: () => ({ meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex" }] }), component: ListingsPage });
type Listing = ReturnType<typeof useListings>["data"] extends (infer T)[] | undefined ? T : never;
const PAGE_SIZE = 10;
const TABS = [{ value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "paused", label: "Pausados" }, { value: "draft", label: "Rascunhos" }, { value: "error", label: "Erros" }, { value: "low_stock", label: "Estoque baixo" }, { value: "low_score", label: "Baixa performance" }] as const;
const STATUS_LABEL: Record<string, string> = { active: "Ativo", paused: "Pausado", draft: "Rascunho", error: "Erro", closed: "Encerrado", under_review: "Em análise", inactive: "Inativo" };

function ListingsPage() {
  const queryClient = useQueryClient();
  const { data: listings = [], isLoading } = useListings();
  const startJob = useServerFn(startBulkJob);
  const validateBulk = useServerFn(validateListingsForPublish);
  const publishBulk = useServerFn(publishListingsBulk);
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const filtered = useMemo(() => (listings as Listing[]).filter((listing: any) => tab === "all" ? true : tab === "low_stock" ? (listing.stock ?? 0) <= 2 : tab === "low_score" ? listing.ai_score != null && listing.ai_score < 50 : listing.status === tab), [listings, tab]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as any[];
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedListings = (listings as any[]).filter((l) => selected[l.id]);

  const remove = useMutation({ mutationFn: async (id: string) => { const { supabase } = await import("@/integrations/supabase/client"); const { error } = await supabase.from("listings").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["listings"] }); toast.success("Anúncio excluído"); }, onError: () => toast.error("Não foi possível excluir.") });
  const startBulk = async (kind: "pause" | "activate" | "delete" | "optimize") => { if (!selectedListings.length) return; const result = await startJob({ data: { kind, items: selectedListings.map((l) => ({ id: l.id, label: l.title })) } }); if (!result.ok) return toast.error(result.reason); setJobId(result.jobId); };
  const copyCodes = async () => { const codes = selectedListings.map((l) => l.source_ml_id || l.id); await navigator.clipboard.writeText(codes.join("\n")); toast.success(`${codes.length} códigos copiados`); };
  const exportCsv = () => { const header = "id,titulo,preco,status,estoque,score\n"; const rows = selectedListings.map((l) => [l.id, String(l.title).replace(/,/g, " "), l.price_cents ?? "", STATUS_LABEL[l.status] ?? l.status, l.stock, l.ai_score ?? ""].join(",")).join("\n"); const url = URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "meus-anuncios.csv"; a.click(); URL.revokeObjectURL(url); toast.success("CSV exportado"); };
  const validateAndPublish = async () => { if (!selectedIds.length || publishing) return; setPublishing(true); try { const validation = await validateBulk({ data: { listing_ids: selectedIds } }); if (!validation.ok) return toast.error(validation.reason); const readyIds = validation.items.filter((i) => i.ready).map((i) => i.id); if (!readyIds.length) { const details = validation.items.flatMap((i) => i.issues).slice(0, 3).join(" · "); return toast.error(`Nenhum anúncio pronto. ${details}`); } if (validation.blocked > 0) toast.warning(`${validation.blocked} anúncio(s) com pendências serão ignorados.`); const result = await publishBulk({ data: { listing_ids: readyIds } }); if (!result.ok) return toast.error(result.reason); toast.success(`${result.success} anúncio(s) publicado(s). ${result.failed ? `${result.failed} com erro.` : ""}`); setSelected({}); await queryClient.invalidateQueries({ queryKey: ["listings"] }); } finally { setPublishing(false); } };

  return <AppShell title="Central de anúncios" description="Encontre, gerencie, valide, otimize e publique em escala." actions={<><Button asChild variant="outline" size="sm"><Link to="/buscar"><Tag className="mr-1.5 h-3.5 w-3.5" /> Copiar do ML</Link></Button><Button asChild size="sm"><Link to="/editor/$id" params={{ id: "novo" }}><PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Novo anúncio</Link></Button></>}>
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{listings.length}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Rascunhos</p><p className="text-2xl font-bold">{(listings as any[]).filter((l) => l.status === "draft").length}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Precisam de atenção</p><p className="text-2xl font-bold">{(listings as any[]).filter((l) => l.status === "error" || (l.stock ?? 0) <= 2 || (l.ai_score != null && l.ai_score < 50)).length}</p></CardContent></Card></div>
    <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); setSelected({}); }}><TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">{TABS.map((t) => <TabsTrigger key={t.value} value={t.value} className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t.label}</TabsTrigger>)}</TabsList></Tabs>
    <div className="mt-4">{isLoading ? <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div> : filtered.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Tag className="h-8 w-8 text-muted-foreground" /><p className="font-display text-lg font-bold">Nenhum anúncio nesta visão</p><p className="max-w-md text-sm text-muted-foreground">Busque produtos no Mercado Livre, copie para rascunho e prepare sua operação.</p><Button asChild><Link to="/buscar">Buscar e copiar</Link></Button></CardContent></Card> : <><div className="flex items-center gap-3 pb-2"><Checkbox checked={pageItems.length > 0 && pageItems.every((l) => selected[l.id])} onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, ...Object.fromEntries(pageItems.map((l) => [l.id, !!checked])) }))} id="select-page" /><label htmlFor="select-page" className="text-xs text-muted-foreground">Selecionar página ({pageItems.length})</label></div><div className="grid gap-3 pb-24">{pageItems.map((listing) => <Card key={listing.id}><CardContent className="flex flex-wrap items-center gap-4 pt-6"><Checkbox checked={!!selected[listing.id]} onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [listing.id]: !!checked }))} />{getProductImage(listing.images) ? <img src={getProductImage(listing.images) ?? undefined} alt={listing.title} loading="lazy" className="h-16 w-16 shrink-0 rounded-md object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">Sem imagem</div>}<div className="min-w-[220px] flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{listing.title}</span><Badge variant={listing.status === "active" ? "default" : "outline"}>{STATUS_LABEL[listing.status] ?? "Status desconhecido"}</Badge>{listing.ai_score != null && <Badge variant={listing.ai_score < 50 ? "destructive" : "secondary"}>Qualidade {listing.ai_score}</Badge>}{listing.stock <= 2 && <Badge variant="destructive">Estoque baixo</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{formatBRL(listing.price_cents)} · estoque {listing.stock} · criado em {formatDate(listing.created_at)}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link to="/editor/$id" params={{ id: listing.id }}>Editar</Link></Button><Button size="icon" variant="ghost" onClick={() => remove.mutate(listing.id)} aria-label="Excluir anúncio"><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>)}</div>{totalPages > 1 && <div className="flex items-center justify-between pb-24 text-sm text-muted-foreground"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div></div>}</>}</div>
    {selectedIds.length > 0 && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"><p className="text-sm font-semibold">{selectedIds.length} selecionado(s)</p><div className="flex flex-wrap gap-2"><Button size="sm" onClick={validateAndPublish} disabled={publishing}><Rocket className="mr-1.5 h-3.5 w-3.5" />{publishing ? "Validando..." : "Validar e publicar"}</Button><Button size="sm" variant="outline" onClick={() => startBulk("activate")}><Play className="mr-1.5 h-3.5 w-3.5" /> Ativar</Button><Button size="sm" variant="outline" onClick={() => startBulk("pause")}><Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar</Button><Button size="sm" variant="secondary" onClick={() => startBulk("optimize")}><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Otimizar IA</Button><Button size="sm" variant="outline" onClick={copyCodes}><Copy className="mr-1.5 h-3.5 w-3.5" /> Códigos</Button><Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1.5 h-3.5 w-3.5" /> Exportar</Button><Button size="sm" variant="destructive" onClick={() => startBulk("delete")}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir</Button></div></div></div>}
    <BulkJobDialog jobId={jobId} onOpenChange={(open) => !open && setJobId(null)} onFinished={() => queryClient.invalidateQueries({ queryKey: ["listings"] })} />
  </AppShell>;
}
