import { MessageCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

const SUPPORT_PHONE_DISPLAY = "(35) 99142-9262";
const SUPPORT_WHATSAPP =
  "https://wa.me/5535991429262?text=Ol%C3%A1%21%20Estou%20conhecendo%20o%20AN%C3%9ANCIO%20ML%20e%20gostaria%20de%20tirar%20algumas%20d%C3%BAvidas%20antes%20de%20assinar.";

export function PreSaleSupport() {
  return (
    <>
      <section id="suporte" className="border-y border-border/60 bg-surface/30 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card px-5 py-7 shadow-lg sm:px-8 sm:py-9">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <MessageCircle className="h-3.5 w-3.5" /> SUPORTE PRÉ-VENDA
                </div>
                <h2 className="mt-4 text-balance text-2xl font-black sm:text-3xl">
                  Ficou com alguma dúvida antes de assinar?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                  Fale diretamente pelo WhatsApp para entender os planos, o teste grátis e como o ANÚNCIO ML funciona antes de comprar.
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-success" /> Atendimento pessoal
                  </span>
                  <span>WhatsApp: {SUPPORT_PHONE_DISPLAY}</span>
                </div>
              </div>

              <Button asChild size="lg" className="shrink-0 gap-2 font-bold shadow-glow">
                <a href={SUPPORT_WHATSAPP} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <a
        href={SUPPORT_WHATSAPP}
        target="_blank"
        rel="noreferrer"
        aria-label="Tirar dúvidas pelo WhatsApp"
        className="fixed bottom-24 right-4 z-50 hidden items-center gap-2 rounded-full border border-primary/25 bg-card px-4 py-3 text-sm font-bold text-foreground shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl active:scale-95 md:flex"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageCircle className="h-4 w-4" />
        </span>
        Tirar dúvidas
      </a>
    </>
  );
}
