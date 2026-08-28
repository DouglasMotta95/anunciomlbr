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
    { label: "Pessoas cadastradas", value: data?.users ?? 0, icon: Users },
    { label: "Anúncios criados ou copiados", value: data?.createdListings ?? 0, icon: Boxes },
    { label: "Anúncios publicados", value: data?.publishedListings ?? 0, icon: BadgeCheck },
    { label: "Contas Mercado Livre conectadas", value: data?.connectedAccounts ?? 0, icon: PlugZap },
  ].filter((item) => isLoading || item.value > 0);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/[.12] via-card to-secondary/[.07] p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_currentColor]" />
              ANÚNCIO ML EM AÇÃO
            </div>
            <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-4xl">Mais operação, menos trabalho manual.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Busca, cópia, otimização e publicação reunidas em um único fluxo para quem vende no Mercado Livre.</p>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="group border-border/70 bg-background/75 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div>
                  {isLoading ? <Skeleton className="h-9 w-24" /> : <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{formatNumber(value)}</p>}
                  <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">{label}</p>
                </div>
                <div className="rounded-2xl border border-primary/15 bg-primary/10 p-2.5 transition-transform duration-300 group-hover:scale-110"><Icon className="h-5 w-5 text-primary" /></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isLoading && stats.length === 0 && (
          <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
            {["10 anúncios para testar", "Suporte direto pelo WhatsApp", "Integração com Mercado Livre"].map((text) => (
              <div key={text} className="rounded-2xl border border-border/70 bg-background/75 p-4 text-sm font-semibold shadow-sm">{text}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
