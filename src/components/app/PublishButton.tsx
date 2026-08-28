import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Loader2, PackagePlus, Rocket } from "lucide-react";
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

/** Publica no Mercado Livre um rascunho que já consumiu a franquia na criação/cópia. */
export function PublishButton({ listingId, disabled }: { listingId: string; disabled?: boolean }) {
  const publishFn = useServerFn(publishListing);
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: () => publishFn({ data: { listing_id: listingId } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error("Publicação não concluída", { description: res.reason });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      await queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Anúncio publicado no Mercado Livre", {
        description: "Publicar um rascunho existente não consome outra unidade da sua franquia.",
      });
    },
    onError: () => toast.error("Não foi possível publicar agora."),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={disabled || publish.isPending}>
          {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
          Publicar no Mercado Livre
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publicar este anúncio?</AlertDialogTitle>
          <AlertDialogDescription>
            O rascunho será enviado para a sua conta do Mercado Livre. A franquia é consumida quando o anúncio é criado, copiado ou duplicado no ANÚNCIO ML; publicar este rascunho não desconta outra unidade.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={publish.isPending} onClick={() => publish.mutate()}>
            {publish.isPending ? "Publicando..." : "Publicar agora"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Barra da franquia de criação/cópia com upsell contextual quando o saldo fica baixo. */
export function AdQuotaBar() {
  const quotaFn = useServerFn(getAdQuota);
  const quota = useQuery({ queryKey: ["ad-quota"], queryFn: () => quotaFn({}) });
  if (!quota.data) return null;
  const { used, quota: total, remaining, plan_name } = quota.data;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const low = total > 0 && (percent >= 80 || remaining <= 5);
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">Franquia de criação e cópias</span>
        <span className="text-muted-foreground">{used} de {total} {plan_name ? `· ${plan_name}` : ""}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {remaining > 0
            ? `${remaining} anúncio(s) ainda podem ser criados ou duplicados neste ciclo.`
            : "Limite de novas criações atingido. Seus rascunhos existentes continuam podendo ser publicados."}
        </p>
        {low && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/creditos"><PackagePlus className="mr-1.5 h-3.5 w-3.5" />Comprar extras</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/licenca"><ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />Fazer upgrade</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
