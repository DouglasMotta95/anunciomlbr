import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, CreditCard, Link2, Rocket, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import { formatBRL } from "@/lib/format";
import { periodMonthlyCents, periodSavingsCents, periodTotalCents } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------ */
/* COMPARATIVO MENSAL x ANUAL                                                */
/* ------------------------------------------------------------------------ */

const featureRows: { label: string; monthly: boolean; annual: boolean; note?: string }[] = [
  { label: "Todos os recursos da plataforma", monthly: true, annual: true },
  { label: "Integração oficial com o Mercado Livre", monthly: true, annual: true },
  { label: "Otimização de títulos e descrições com IA", monthly: true, annual: true },
  { label: "Cancelamento a qualquer momento", monthly: true, annual: false, note: "compromisso de 12 meses" },
  { label: "Preço travado por 12 meses", monthly: false, annual: true },
  { label: "Melhor preço por mês", monthly: false, annual: true },
  { label: "Prioridade no suporte", monthly: false, annual: true },
];

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="h-4 w-4 text-success" />
  ) : (
    <X className="h-4 w-4 text-destructive/70" />
  );
}

export function PlanPeriodComparisonSection() {
  const { data: plans } = usePlans();
  const { data: periods } = usePeriods();

  const monthly = periods?.find((p) => p.period === "monthly");
  const annual = periods?.find((p) => p.period === "annual");
  const plan = plans?.find((p) => p.highlighted) ?? plans?.[0];

  return (
    <section id="mensal-ou-anual" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Mensal ou anual
          </span>
          <h2 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">
            Qual período combina com você?
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Comece no mensal sem fidelidade. Se já sabe que vai escalar, o anual entrega o menor
            preço por mês.
          </p>
        </div>

        <Card className="mt-10 overflow-hidden border-border/60 bg-surface/60 p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2 border-b border-border/60 bg-background/40 p-3 sm:gap-4 sm:p-4">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Recurso
            </span>
            <div className="w-24 text-center sm:w-32">
              <p className="text-xs font-bold uppercase tracking-wide">Mensal</p>
              {plan && monthly && (
                <p className="mt-1 font-display text-sm font-extrabold">
                  {formatBRL(periodMonthlyCents(plan, monthly))}
                  <span className="text-[10px] font-medium text-muted-foreground">/mês</span>
                </p>
              )}
            </div>
            <div className="w-24 text-center sm:w-32">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Anual</p>
              {plan && annual && (
                <p className="mt-1 font-display text-sm font-extrabold text-primary">
                  {formatBRL(periodMonthlyCents(plan, annual))}
                  <span className="text-[10px] font-medium text-muted-foreground">/mês</span>
                </p>
              )}
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {featureRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-3 text-sm sm:gap-4 sm:p-4"
              >
                <span className="min-w-0 text-muted-foreground">
                  {row.label}
                  {row.note && (
                    <span className="ml-1 text-[11px] text-muted-foreground/70">({row.note})</span>
                  )}
                </span>
                <span className="flex w-24 justify-center sm:w-32">
                  <Mark ok={row.monthly} />
                </span>
                <span className="flex w-24 justify-center sm:w-32">
                  <Mark ok={row.annual} />
                </span>
              </div>
            ))}

            {plan && annual && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 bg-primary/5 p-3 text-sm sm:gap-4 sm:p-4">
                <span className="min-w-0 font-semibold">Economia no período</span>
                <span className="w-24 text-center text-xs text-muted-foreground sm:w-32">—</span>
                <span className="w-24 text-center text-xs font-semibold text-success sm:w-32">
                  {formatBRL(periodSavingsCents(plan, annual))}
                </span>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline" className="font-semibold">
            <Link to="/checkout" search={{ plan: plan?.code, period: "monthly" }}>
              Assinar mensal
            </Link>
          </Button>
          <Button asChild className="font-semibold shadow-glow">
            <Link to="/checkout" search={{ plan: plan?.code, period: "annual" }}>
              Assinar anual e economizar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* COMO FUNCIONA — DA COMPRA À PRIMEIRA VENDA                                */
/* ------------------------------------------------------------------------ */

const purchaseSteps = [
  {
    n: "01",
    icon: CreditCard,
    t: "Assine em 2 passos",
    d: "Escolha o plano, confirme o resumo do pedido e pague pelo Mercado Pago.",
  },
  {
    n: "02",
    icon: Link2,
    t: "Conecte sua conta ML",
    d: "Um clique na integração oficial e seus anúncios entram na plataforma.",
  },
  {
    n: "03",
    icon: Sparkles,
    t: "Copie e otimize com IA",
    d: "Duplique anúncios que já vendem e melhore título, descrição e preço.",
  },
  {
    n: "04",
    icon: Rocket,
    t: "Publique e venda",
    d: "Publique direto no Mercado Livre e acompanhe vendas e estoque.",
  },
];

export function PurchaseFlowSection() {
  return (
    <section id="da-compra-a-venda" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Como funciona
          </span>
          <h2 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">
            Da compra à primeira venda
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Ativação imediata: em poucos minutos você já está publicando anúncios.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {purchaseSteps.map((s) => (
            <Card
              key={s.n}
              className="group relative overflow-hidden border-border/60 bg-surface/60 p-5 transition-all hover:-translate-y-1 hover:border-primary/40"
            >
              <span className="absolute right-4 top-3 font-display text-4xl font-extrabold text-foreground/5">
                {s.n}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-sm font-bold tracking-wide">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary">Ativação imediata</Badge>
          <Badge variant="secondary">Pagamento seguro Mercado Pago</Badge>
          <Badge variant="secondary">Suporte em português</Badge>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* CTA FIXO MOBILE                                                            */
/* ------------------------------------------------------------------------ */

export function MobileStickyCta() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setVisible(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-300 md:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">Comece com 10 anúncios grátis</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Sem cartão · cancele quando quiser
          </p>
        </div>
        {user ? (
          <Button asChild size="sm" className="shrink-0 font-semibold shadow-glow">
            <Link to="/dashboard">Abrir painel</Link>
          </Button>
        ) : (
          <Button asChild size="sm" className="shrink-0 font-semibold shadow-glow">
            <Link to="/checkout">Quero comprar</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
