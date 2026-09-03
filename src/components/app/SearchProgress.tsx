import { CheckCircle2, Loader2, Radar, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const STEPS = [
  { label: "Consultando o Mercado Livre", icon: Search },
  { label: "Validando anúncios ativos", icon: ShieldCheck },
  { label: "Organizando os melhores resultados", icon: Radar },
] as const;

export function SearchProgress({ term }: { term: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 1100);
    return () => window.clearInterval(timer);
  }, [term]);

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-primary/15 bg-card shadow-sm">
      <div className="relative p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden bg-muted">
          <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-primary" style={{ transform: `translateX(${step * 100}%)`, transition: "transform 500ms ease" }} />
        </div>

        <div className="flex items-start gap-4">
          <div className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="absolute inset-0 animate-ping rounded-xl border border-primary/20 motion-reduce:hidden" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Buscando anúncios reais</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">{term ? `Pesquisa: “${term}”` : "Preparando consulta…"}</p>
          </div>
          <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary sm:inline-flex">Em andamento</span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {STEPS.map(({ label, icon: Icon }, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition-all duration-300 ${active ? "border-primary/30 bg-primary/[.06] text-foreground shadow-sm" : done ? "border-border/60 bg-muted/20 text-foreground" : "border-border/50 text-muted-foreground"}`}>
                {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Icon className="h-4 w-4" />}
                <span className="font-medium">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-lg border border-border/60 bg-background/70">
              <div className="aspect-[4/3] animate-pulse bg-muted/60" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-6 w-28 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
