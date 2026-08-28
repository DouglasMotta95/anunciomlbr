import { BadgeCheck, CreditCard, Landmark, QrCode, ShieldCheck, WalletCards } from "lucide-react";

import { cn } from "@/lib/utils";

type PaymentTrustProps = {
  compact?: boolean;
  className?: string;
};

const PAYMENT_METHODS = [
  { icon: WalletCards, label: "Saldo Mercado Pago" },
  { icon: QrCode, label: "Pix" },
  { icon: CreditCard, label: "Cartão" },
  { icon: Landmark, label: "Outros meios disponíveis" },
] as const;

export function PaymentTrust({ compact = false, className }: PaymentTrustProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[.06] via-background to-secondary/[.04] p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Pagamento seguro com Mercado Pago</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
              <BadgeCheck className="h-3 w-3" /> protegido
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Você será direcionado ao ambiente oficial do Mercado Pago para concluir a compra. Seus dados de pagamento não ficam armazenados no ANÚNCIO ML.
          </p>
        </div>
      </div>

      <div className={cn("mt-4 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          return (
            <div key={method.label} className="flex min-h-12 items-center gap-2 rounded-xl border bg-background/70 px-3 py-2">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-[11px] font-medium leading-4">{method.label}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        Os meios exibidos no checkout podem variar conforme sua conta e a disponibilidade do Mercado Pago. Após a aprovação, você retorna ao ANÚNCIO ML e a compra é confirmada com o provedor antes da liberação.
      </p>
    </div>
  );
}
