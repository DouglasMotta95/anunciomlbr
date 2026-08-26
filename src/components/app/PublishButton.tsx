import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Rocket } from "lucide-react";
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

/** Publica o rascunho no Mercado Livre de verdade, consumindo 1 anúncio do plano. */
export function PublishButton({ listingId, disabled }: { listingId: string; disabled?: boolean }) {
  const quotaFn = useServerFn(getAdQuota);
  const publishFn = useServerFn(publishListing);
  const queryClient = useQueryClient();

  const quota = useQuery({ queryKey: ["ad-quota"], queryFn: () => quotaFn({}) });

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
        description: `Restam ${res.remaining} anúncio(s) no seu plano.`,
      });
    },
    onError: () => toast.error("Não foi possível publicar agora."),
  });

  const remaining = quota.data?.remaining ?? 0;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={disabled || publish.isPending}>
          {publish.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-4 w-4" />
          )}
          Publicar no Mercado Livre
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publicar este anúncio?</AlertDialogTitle>
          <AlertDialogDescription>
            O anúncio será criado na sua conta do Mercado Livre e 1 publicação será descontada do
            seu plano. {quota.isLoading ? "Verificando seu saldo..." : `Saldo atual: ${remaining} anúncio(s).`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={remaining < 1} onClick={() => publish.mutate()}>
            {remaining < 1 ? "Sem saldo disponível" : "Publicar agora"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Barra de consumo de anúncios do plano ativo. */
export function AdQuotaBar() {
  const quotaFn = useServerFn(getAdQuota);
  const quota = useQuery({ queryKey: ["ad-quota"], queryFn: () => quotaFn({}) });

  if (!quota.data) return null;
  const { used, quota: total, remaining, plan_name } = quota.data;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">Anúncios utilizados</span>
        <span className="text-muted-foreground">
          {used} de {total} {plan_name ? `· ${plan_name}` : ""}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {remaining > 0 ? `${remaining} publicação(ões) disponível(is).` : "Limite atingido — adquira um pacote ou plano maior."}
      </p>
    </div>
  );
}
