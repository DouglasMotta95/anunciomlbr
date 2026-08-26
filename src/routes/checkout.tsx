import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2, Lock, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import { createMercadoPagoCheckout } from "@/lib/checkout.functions";
import { formatBRL, formatDate } from "@/lib/format";
import {
  periodMonthlyCents,
  periodSavingsCents,
  periodTotalCents,
  renewalDate,
  type BillingPeriod,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  plan: z.string().optional(),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]).optional(),
});

const title = "Checkout rápido — ANÚNCIO ML";
const description =
  "Confirme seu plano do ANÚNCIO ML em poucos passos: resumo do pedido, período e pagamento seguro pelo Mercado Pago.";

export const Route = createFileRoute("/checkout")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: plans = [], isLoading } = usePlans();
  const { data: periods = [] } = usePeriods();
  const startCheckout = useServerFn(createMercadoPagoCheckout);

  const [planCode, setPlanCode] = useState<string | undefined>(search.plan);
  const [period, setPeriod] = useState<BillingPeriod>(search.period ?? "monthly");

  useEffect(() => {
    if (!planCode && plans.length) {
      setPlanCode((plans.find((p) => p.highlighted) ?? plans[0]).code);
    }
  }, [planCode, plans]);

  const plan = plans.find((p) => p.code === planCode);
  const discount = periods.find((p) => p.period === period) ?? periods[0];

  const purchase = useMutation({
    mutationFn: () => startCheckout({ data: { plan_id: plan!.id, period } }),
    onSuccess: (result) => {
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.info("Pedido registrado", {
        description:
          "O pagamento online ainda não está disponível nesta instalação. Nosso suporte envia sua chave de licença.",
      });
      void navigate({ to: "/licenca" });
    },
    onError: () => toast.error("Não foi possível iniciar o pagamento agora."),
  });

  const total = plan && discount ? periodTotalCents(plan, discount) : 0;
  const monthly = plan && discount ? periodMonthlyCents(plan, discount) : 0;
  const savings = plan && discount ? periodSavingsCents(plan, discount) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="text-primary">1. Resumo do pedido</span>
          <span>›</span>
          <span>2. Pagamento seguro</span>
        </div>
        <h1 className="mt-3 text-balance text-3xl font-extrabold">
          Confirme seu plano em 2 passos
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sem formulários longos: revise o resumo e conclua no Mercado Pago.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="border-border/60 bg-surface/60 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Plano
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {isLoading && <p className="text-sm text-muted-foreground">Carregando planos…</p>}
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanCode(p.code)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      p.code === planCode
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        p.code === planCode ? "border-primary bg-primary" : "border-border",
                      )}
                    >
                      {p.code === planCode && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.tagline}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-primary">
                        {formatBRL(p.price_monthly_cents)}/mês
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border-border/60 bg-surface/60 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Período
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {periods.map((p) => (
                  <button
                    key={p.period}
                    type="button"
                    onClick={() => setPeriod(p.period)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                      p.period === period
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                    {Number(p.discount_percent) > 0 && (
                      <span className="ml-1 text-[10px] opacity-80">
                        -{Number(p.discount_percent)}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {period === "monthly" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Sem fidelidade — cancele quando quiser.
                </p>
              )}
            </Card>
          </div>

          <Card className="h-fit border-border/60 bg-surface/60 p-5 lg:sticky lg:top-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Resumo do pedido
              </p>
              <Badge variant="secondary">Ativação imediata</Badge>
            </div>

            {plan && discount ? (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-semibold">{plan.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Período</span>
                  <span className="font-semibold">{discount.label}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Equivalente por mês</span>
                  <span className="font-semibold">{formatBRL(monthly)}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Economia</span>
                    <span className="font-semibold text-success">-{formatBRL(savings)}</span>
                  </div>
                )}
                <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/60 pt-3">
                  <span className="text-sm text-muted-foreground">Total hoje</span>
                  <span className="font-display text-2xl font-extrabold">{formatBRL(total)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Renova em {formatDate(renewalDate(discount))}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Selecione um plano.</p>
            )}

            {user ? (
              <Button
                className="mt-5 w-full font-semibold shadow-glow"
                disabled={!plan || !discount || purchase.isPending}
                onClick={() => purchase.mutate()}
              >
                {purchase.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Pagar com Mercado Pago
              </Button>
            ) : (
              <>
                <Button asChild className="mt-5 w-full font-semibold shadow-glow">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Criar conta e concluir
                  </Link>
                </Button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Já tem conta?{" "}
                  <Link to="/auth" className="font-semibold text-primary">
                    Entrar
                  </Link>
                </p>
              </>
            )}

            <ul className="mt-4 space-y-1.5 text-[11px] text-muted-foreground">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-success" /> Pagamento processado pelo
                Mercado Pago
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" /> Acesso liberado assim que o pagamento
                é aprovado
              </li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
