import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Boxes, PlugZap, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicSocialProof } from "@/lib/public-social-proof.functions";
import { formatNumber } from "@/lib/format";

export function RealSocialProof() {
  const proofFn = useServerFn(getPublicSocialProof);
  const { data, isLoading } = useQuery({
    queryKey: ["public-social-proof"],
    queryFn: () => proofFn(),
    staleTime: 5 * 60_000,
  });

  const stats = [
    { label: "Usuários na plataforma", value: data?.users ?? 0, icon: Users },
    { label: "Anúncios criados ou copiados", value: data?.createdListings ?? 0, icon: Boxes },
    { label: "Anúncios publicados", value: data?.publishedListings ?? 0, icon: BadgeCheck },
    { label: "Contas Mercado Livre conectadas", value: data?.connectedAccounts ?? 0, icon: PlugZap },
  ].filter((item) => isLoading || item.value > 0);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[.08] via-card to-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">ANÚNCIO ML EM AÇÃO</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Uma plataforma feita para colocar anúncios em movimento.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Busca, cópia, otimização e publicação reunidas em um único fluxo para vendedores do Mercado Livre.</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-border/70 bg-background/80 shadow-none">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div>
                  {isLoading ? <Skeleton className="h-9 w-24" /> : <p className="text-3xl font-extrabold tracking-tight">{formatNumber(value)}</p>}
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary" /></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isLoading && stats.length === 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {["10 anúncios para testar", "Suporte pelo WhatsApp", "Integração com Mercado Livre"].map((text) => (
              <div key={text} className="rounded-2xl border bg-background/75 p-4 text-sm font-semibold">{text}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
