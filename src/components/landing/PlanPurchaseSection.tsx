import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Crown, Rocket, Sparkles, Store } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import { formatBRL } from "@/lib/format";
import {
  PERIOD_FALLBACK,
  periodMonthlyCents,
  periodSavingsCents,
  periodTotalCents,
  type BillingPeriod,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

const planIcons = [Rocket, Sparkles, Crown, Store];

export function PlanPurchaseSection() {
  const { data: plans = [] } = usePlans();
  const { data: loadedPeriods = [] } = usePeriods();
  const periods = loadedPeriods.length ? loadedPeriods : PERIOD_FALLBACK;
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const discount = periods.find((item) => item.period === period) ?? periods[0]!;

  return (
    <section id="planos" className="border-y border-border/60 bg-surface/20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[.16em] text-primary">
            PLANOS ANÚNCIO ML
          </span>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-5xl">Escolha seu plano e compre direto por aqui.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty leading-7 text-muted-foreground">
            Compare o limite de anúncios, os créditos de IA e os recursos de cada plano. Quando decidir, clique em comprar e siga para o checkout.
          </p>
        </div>

        <div className="mx-auto mt-8 flex w-fit flex-wrap justify-center gap-1 rounded-2xl border border-border/60 bg-background/70 p-1.5">
          {periods.map((item) => (
            <button
              key={item.period}
              type="button"
              onClick={() => setPeriod(item.period)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide transition",
                period === item.period
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {item.label}
              {Number(item.discount_percent) > 0 && <span className="ml-1 opacity-80">-{Number(item.discount_percent)}%</span>}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => {
            const Icon = planIcons[index] ?? Sparkles;
            const total = periodTotalCents(plan, discount);
            const monthly = periodMonthlyCents(plan, discount);
            const savings = periodSavingsCents(plan, discount);

            return (
              <Card
                key={plan.code}
                className={cn(
                  "relative flex min-h-[470px] flex-col overflow-hidden border-border/70 bg-background/85 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl",
                  plan.highlighted && "border-primary/55 bg-primary/[.055] shadow-glow",
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute right-4 top-4 bg-primary text-primary-foreground">MAIS ESCOLHIDO</Badge>
                )}

                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-5 text-sm font-black tracking-[.12em]">{plan.name}</p>
                <p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{plan.tagline}</p>

                <div className="mt-5">
                  <div className="flex items-end gap-1">
                    <span className="font-display text-4xl font-black tracking-tight">{formatBRL(monthly)}</span>
                    <span className="pb-1 text-xs font-semibold text-muted-foreground">/mês</span>
                  </div>
                  {discount.months > 1 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Total de {formatBRL(total)} por {discount.months} meses</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Plano mensal, sem período longo obrigatório.</p>
                  )}
                  {savings > 0 && <p className="mt-1 text-xs font-bold text-success">Economia de {formatBRL(savings)} no período</p>}
                </div>

                <div className="mt-5 rounded-2xl border border-border/60 bg-surface/40 p-3 text-xs">
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Anúncios</span><span className="font-bold">{plan.listing_limit == null ? "Ilimitados" : plan.listing_limit}</span></div>
                  <div className="mt-2 flex justify-between gap-2"><span className="text-muted-foreground">Créditos de IA</span><span className="font-bold">{plan.ai_credits == null ? "—" : plan.ai_credits}</span></div>
                </div>

                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 leading-5 text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild size="lg" className={cn("mt-6 w-full gap-2 font-black", plan.highlighted && "shadow-glow")} variant={plan.highlighted ? "default" : "outline"}>
                  <Link to="/checkout" search={{ plan: plan.code, period }}>
                    Comprar {plan.name} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/[.06] px-5 py-4 text-center">
          <p className="text-sm font-bold">Ainda não quer escolher um plano?</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie sua conta e experimente a franquia inicial de 10 anúncios antes de decidir.</p>
          <Button asChild variant="link" className="mt-1 font-bold text-primary">
            <Link to="/auth" search={{ mode: "signup" }}>Começar com 10 anúncios <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
