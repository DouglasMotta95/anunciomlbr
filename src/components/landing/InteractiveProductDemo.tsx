import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Copy, PackageCheck, Search, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const demoProducts = [
  { title: "Fone Bluetooth Pro com Estojo de Carga", price: "R$ 129,90", seller: "Loja demonstrativa", score: "Boa referência" },
  { title: "Fone Sem Fio Bluetooth com Microfone", price: "R$ 99,90", seller: "Seller exemplo", score: "Título forte" },
  { title: "Headset Bluetooth Compacto Premium", price: "R$ 149,90", seller: "Operação exemplo", score: "Boa apresentação" },
] as const;

const steps = [
  { label: "Buscar", icon: Search },
  { label: "Copiar", icon: Copy },
  { label: "Otimizar", icon: Wand2 },
  { label: "Publicar", icon: PackageCheck },
];

export function InteractiveProductDemo() {
  const [query, setQuery] = useState("fone bluetooth");
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  const activeProduct = useMemo(() => demoProducts[selected] ?? demoProducts[0], [selected]);

  function startSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setStep(0);
    window.setTimeout(() => {
      setLoading(false);
      setStep(1);
    }, 650);
  }

  function restart() {
    setStep(0);
    setSelected(0);
    setLoading(false);
  }

  return (
    <section id="demo-interativa" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> EXPERIMENTE ANTES DE CRIAR SUA CONTA
          </span>
          <h2 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-5xl">Faça um tour pelo fluxo do ANÚNCIO ML.</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted-foreground">Uma demonstração rápida e interativa. Nenhuma busca real é feita e nenhum crédito é consumido.</p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-panel)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-surface/30 px-4 py-3 sm:px-6">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const done = step > index;
              const active = step === index;
              return (
                <div key={item.label} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-all duration-300 ${active ? "bg-primary text-primary-foreground shadow-sm" : done ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  {item.label}
                </div>
              );
            })}
            <span className="ml-auto hidden text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground sm:block">Dados ilustrativos</span>
          </div>

          <div className="grid min-h-[500px] lg:grid-cols-[.72fr_1.28fr]">
            <aside className="border-b border-border/70 bg-surface/20 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">Tour guiado</p>
              <h3 className="mt-3 text-2xl font-black">
                {step === 0 && "Encontre uma referência."}
                {step === 1 && "Escolha o anúncio base."}
                {step === 2 && "Veja a IA trabalhando."}
                {step >= 3 && "Pronto para publicar."}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {step === 0 && "Digite um produto e simule como começa a pesquisa dentro da plataforma."}
                {step === 1 && "Selecione uma das referências demonstrativas e transforme-a em um rascunho editável."}
                {step === 2 && "A demonstração mostra como título e conteúdo podem entrar no fluxo de otimização."}
                {step >= 3 && "Na conta real, a publicação só acontece depois da sua revisão e usando sua conexão autorizada."}
              </p>

              <div className="mt-7 rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> O que você está vendo</div>
                <p className="mt-2 text-sm font-semibold">Uma simulação local da experiência. Não representa anúncio, preço, venda ou vendedor real.</p>
              </div>
            </aside>

            <div className="relative p-5 sm:p-7">
              {step === 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2 text-sm font-black"><Search className="h-4 w-4 text-primary" /> Buscar anúncios</div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && startSearch()} placeholder="Ex.: fone bluetooth" className="h-12" />
                    <Button onClick={startSearch} disabled={loading || !query.trim()} className="h-12 gap-2 px-6 font-bold">
                      <Search className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} /> {loading ? "Buscando..." : "Simular busca"}
                    </Button>
                  </div>
                  {loading ? (
                    <div className="mt-7 space-y-3">
                      {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl border border-border/60 bg-surface/50" />)}
                      <p className="text-center text-xs font-semibold text-muted-foreground">Consultando referências → validando → organizando resultados</p>
                    </div>
                  ) : (
                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                      {["Pesquise", "Compare", "Escolha"].map((label, index) => <div key={label} className="rounded-2xl border border-border/70 bg-surface/30 p-4 transition hover:-translate-y-1 hover:border-primary/30"><span className="text-3xl font-black text-primary/20">0{index + 1}</span><p className="mt-3 text-sm font-black">{label}</p></div>)}
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Resultados demonstrativos</p><p className="mt-1 text-xs text-muted-foreground">Escolha uma referência para continuar.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">3 encontrados</span></div>
                  <div className="mt-5 space-y-3">
                    {demoProducts.map((product, index) => (
                      <button key={product.title} type="button" onClick={() => setSelected(index)} className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${selected === index ? "border-primary/50 bg-primary/[.05]" : "border-border/70 bg-background"}`}>
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-primary"><PackageCheck className="h-6 w-6" /></div>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">{product.seller} · {product.score}</p></div>
                        <span className="text-sm font-black">{product.price}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 flex justify-end"><Button onClick={() => setStep(2)} className="gap-2 font-bold">Copiar para rascunho <Copy className="h-4 w-4" /></Button></div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="rounded-2xl border border-border/70 bg-background p-5">
                    <div className="flex items-center justify-between gap-3"><span className="text-xs font-extrabold uppercase tracking-[.14em] text-muted-foreground">Rascunho</span><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Editável</span></div>
                    <p className="mt-4 text-lg font-black">{activeProduct.title}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-surface/50 p-4"><p className="text-xs font-bold text-muted-foreground">Preço de referência</p><p className="mt-1 text-xl font-black">{activeProduct.price}</p></div><div className="rounded-xl bg-surface/50 p-4"><p className="text-xs font-bold text-muted-foreground">Origem</p><p className="mt-1 text-sm font-black">Referência demonstrativa</p></div></div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[.05] p-5"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wand2 className="h-5 w-5" /></span><div><p className="font-black">Copilot de otimização</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Demonstra como a IA entra no fluxo para revisar apresentação e conteúdo antes da sua aprovação.</p></div></div></div>
                  <div className="mt-5 flex justify-end"><Button onClick={() => setStep(3)} className="gap-2 font-bold">Simular otimização <Sparkles className="h-4 w-4" /></Button></div>
                </div>
              )}

              {step >= 3 && (
                <div className="animate-in zoom-in-95 fade-in duration-300">
                  <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Check className="h-8 w-8" /></span>
                    <p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-primary">Fluxo concluído</p>
                    <h3 className="mt-2 max-w-xl text-balance text-3xl font-black">Agora faça isso com seus próprios anúncios.</h3>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Crie sua conta, conecte o Mercado Livre e use o fluxo real com seus dados. A publicação continua sob seu controle.</p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="gap-2 font-bold shadow-glow"><Link to="/auth" search={{ mode: "signup" }}>Criar conta e testar <ArrowRight className="h-4 w-4" /></Link></Button><Button variant="outline" size="lg" onClick={restart} className="font-bold">Refazer demonstração</Button></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
