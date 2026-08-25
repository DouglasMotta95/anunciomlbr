import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Check, 
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLicense } from "@/hooks/useLicense";
import { useProfile } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import { createMercadoPagoCheckout } from "@/lib/checkout.functions";
import { activateLicense } from "@/lib/licenses.functions";
import { formatBRL, formatDate, daysUntil } from "@/lib/format";
import {
  periodMonthlyCents,
  periodSavingsCents,
  periodTotalCents,
  type BillingPeriod,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

const title = "Plano e licença — ANÚNCIO ML";
const description =
  "Ative sua chave de licença, escolha um plano e pague com segurança pelo Mercado Pago.";

export const Route = createFileRoute("/_authenticated/licenca")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LicensePage,
});

function LicensePage() {
  const queryClient = useQueryClient();
  const { data: license } = useLicense();
  const { data: profile } = useProfile();
  const { data: plans = [] } = usePlans();
  const { data: periods = [] } = usePeriods();
  const activate = useServerFn(activateLicense);
  const checkout = useServerFn(createMercadoPagoCheckout);

  const [code, setCode] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  const discount = periods.find((item) => item.period === period) ?? periods[0];

  const activation = useMutation({
    mutationFn: (value: string) => activate({ data: { code: value } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error("Chave não aceita", { description: result.reason });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["license"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Licença ativada!", {
        description: `Plano ${result.license.plan ?? ""} válido até ${formatDate(result.license.expires_at)}`,
      });
      setCode("");
    },
    onError: () => toast.error("Não foi possível validar a chave agora."),
  });

  const purchase = useMutation({
    mutationFn: (planId: string) => checkout({ data: { plan_id: planId, period } }),
    onSuccess: (result) => {
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.info("Pagamento pendente de configuração", {
        description:
          "O checkout do Mercado Pago ainda não está configurado nesta instalação. Sua intenção de compra foi registrada e você pode ativar por chave de licença.",
      });
    },
    onError: () => toast.error("Falha ao iniciar o checkout."),
  });

  return (
    <AppShell title="Plano e licença" description="Ative uma chave ou contrate direto pelo Mercado Pago.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ativar chave de licença</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (code.trim().length >= 6) activation.mutate(code.trim());
              }}
            >
              <div className="min-w-[220px] flex-1 space-y-2">
                <Label htmlFor="code">Chave</Label>
                <Input
                  id="code"
                  value={code}
                  placeholder="PRO-XXXX-XXXX-XXXX"
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
              </div>
              <Button type="submit" disabled={activation.isPending || code.trim().length < 6}>
                {activation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Ativar
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Chaves são geradas após o pagamento aprovado ou enviadas manualmente pelo suporte
              (Pix, cortesia, parceria).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {license?.plan ? (
              <>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <span className="font-display text-lg font-bold">{license.plan.name}</span>
                  <Badge>ativa</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs text-muted-foreground">Chave {license.code}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(license.code);
                      toast.success("Código copiado");
                    }}
                  >
                    <Copy className="h-3 w-3" /> COPIAR CÓDIGO
                  </Button>
                </div>
                <p className="text-muted-foreground">Válida até {formatDate(license.expires_at)}</p>
                <p className="text-muted-foreground">
                  {(() => {
                    const days = daysUntil(license.expires_at);
                    return days === null ? "" : days >= 0 ? `${days} dia(s) restante(s)` : "Licença expirada";
                  })()}
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">Nenhuma licença ativa. Você está no teste gratuito.</p>
                {profile && (
                  <div className="space-y-1">
                    <Progress
                      value={
                        profile.free_listings_limit > 0
                          ? Math.min(100, (profile.free_listings_used / profile.free_listings_limit) * 100)
                          : 0
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {profile.free_listings_used}/{profile.free_listings_limit} anúncios do teste gratuito usados
                    </p>
                  </div>
                )}
                {profile && profile.free_listings_used >= profile.free_listings_limit && (
                  <p className="text-sm font-medium text-destructive">
                    Seu teste gratuito terminou. Escolha um plano para continuar.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Planos</h2>
          <Tabs value={period} onValueChange={(value) => setPeriod(value as BillingPeriod)}>
            <TabsList>
              {periods.map((item) => (
                <TabsTrigger key={item.period} value={item.period}>
                  {item.label}
                  {Number(item.discount_percent) > 0 && (
                    <span className="ml-1.5 text-[10px] text-primary">
                      -{Number(item.discount_percent)}%
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = license?.plan?.id === plan.id;
            return (
              <Card
                key={plan.id}
                className={cn(plan.highlighted && "border-primary/50 ring-1 ring-primary/30")}
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {plan.highlighted && <Badge variant="secondary">popular</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="font-display text-2xl font-extrabold tracking-tight">
                      {discount ? formatBRL(periodMonthlyCents(plan, discount)) : formatBRL(plan.price_monthly_cents)}
                      <span className="text-sm font-medium text-muted-foreground">/mês</span>
                    </div>
                    {discount && discount.months > 1 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatBRL(periodTotalCents(plan, discount))} por {discount.months} meses ·
                        economia de {formatBRL(periodSavingsCents(plan, discount))}
                      </p>
                    )}
                  </div>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={purchase.isPending || isCurrent}
                    onClick={() => purchase.mutate(plan.id)}
                  >
                    {purchase.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="mr-2 h-4 w-4" />
                    )}
                    {isCurrent ? "Plano atual" : "Contratar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
