import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ExternalLink, Loader2, PackagePlus, Rocket } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getAdQuota } from "@/lib/quota.functions";
import { publishListing } from "@/lib/publish.functions";
import { formatBRL } from "@/lib/format";

export function PublishButton({ listingId, disabled, preview }: { listingId: string; disabled?: boolean; preview?: { title: string; priceCents: number | null; image?: string | null; stock?: number } }) {
  const publishFn = useServerFn(publishListing);
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: () => publishFn({ data: { listing_id: listingId } }),
    onSuccess: async (res) => {
      if (!res.ok) { toast.error("Publicação não concluída", { description: res.reason }); return; }
      await queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      await queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success(`Publicado no Mercado Livre · ${res.ml_item_id}`, {
        description: "O anúncio foi confirmado pelo Mercado Livre. Use o botão abaixo para abrir e conferir a publicação.",
        duration: 12000,
        action: {
          label: "Abrir no Mercado Livre",
          onClick: () => window.open(res.permalink, "_blank", "noopener,noreferrer"),
        },
      });
    },
    onError: () => toast.error("Não foi possível publicar agora."),
  });

  return <AlertDialog><AlertDialogTrigger asChild><Button size="sm" disabled={disabled || publish.isPending}>{publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Rocket className="mr-2 h-4 w-4"/>}Publicar no Mercado Livre</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Prévia final antes de publicar</AlertDialogTitle><AlertDialogDescription>Confira o anúncio que será enviado para sua conta do Mercado Livre. Após a confirmação, o sistema exibirá o código MLB e um link direto para você conferir a publicação real.</AlertDialogDescription></AlertDialogHeader>{preview&&<div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-[120px_1fr]">{preview.image?<img src={preview.image} alt={preview.title} className="aspect-square w-full rounded-xl border bg-white object-contain p-2"/>:<div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem imagem</div>}<div><p className="font-semibold leading-5">{preview.title||"Anúncio sem título"}</p><p className="mt-2 text-2xl font-extrabold">{formatBRL(preview.priceCents)}</p>{preview.stock!=null&&<p className="mt-1 text-xs text-muted-foreground">Estoque: {preview.stock}</p>}<p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><ExternalLink className="h-3.5 w-3.5"/>O link real será mostrado após o Mercado Livre confirmar a publicação.</p></div></div>}<AlertDialogFooter><AlertDialogCancel>Voltar e revisar</AlertDialogCancel><AlertDialogAction disabled={publish.isPending} onClick={() => publish.mutate()}>{publish.isPending ? "Publicando..." : "Confirmar publicação"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

export function AdQuotaBar() {
  const quotaFn = useServerFn(getAdQuota);
  const quota = useQuery({ queryKey: ["ad-quota"], queryFn: () => quotaFn({}) });
  if (!quota.data) return null;
  const { used, quota: total, remaining, plan_name } = quota.data;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const low = total > 0 && (remaining <= 3 || percent >= 80);
  return <div className="rounded-2xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">Franquia de criação e cópias</span><span className="text-muted-foreground">{used} de {total} {plan_name ? `· ${plan_name}` : ""}</span></div><div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }}/></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Cada nova criação ou duplicação consome 1 unidade; editar o mesmo anúncio não consome novamente. {remaining > 0 ? `${remaining} anúncio(s) ainda disponíveis.` : "Limite de novas criações atingido."}</p>{low&&<div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link to="/creditos"><PackagePlus className="mr-1.5 h-3.5 w-3.5"/>Comprar extras</Link></Button><Button asChild size="sm"><Link to="/licenca"><ArrowUpRight className="mr-1.5 h-3.5 w-3.5"/>Assinar/upgrade</Link></Button></div>}</div></div>;
}
