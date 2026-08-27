import { BriefcaseBusiness, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_PARTNER_URL = "https://wa.me/5535991429262?text=Ol%C3%A1%2C%20tenho%20interesse%20em%20ser%20revendedor%20do%20AN%C3%9ANCIO%20ML.";

export function PartnerCta() {
  return (
    <section className="border-b border-border/60 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BriefcaseBusiness className="h-3.5 w-3.5" /> Programa de parceiros
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Quer revender o ANÚNCIO ML?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              O programa de revenda é separado dos planos da plataforma. O acesso é liberado individualmente após análise e aprovação da nossa equipe.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Acesso exclusivo para parceiros aprovados</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Área de revenda separada do painel do cliente</span>
            </div>
          </div>
          <Button asChild size="lg" variant="outline" className="w-full font-semibold md:w-auto">
            <a href={WHATSAPP_PARTNER_URL} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" /> Quero ser parceiro
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
