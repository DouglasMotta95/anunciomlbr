import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Check, Copy, Lightbulb, PackageCheck, Search, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

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
  { label: "Acompanhar", icon: BarChart3 },
  { label: "Agir", icon: Lightbulb },
] as const;

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
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary"><Sparkles className="h-3.5 w-3.5" /> EXPERIMENTE ANTES DE CRIAR SUA CONTA</span>
          <h2 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-5xl">Veja o anúncio entrar e continuar dentro da operação.</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted-foreground">Uma simulação local do fluxo completo: encontrar, preparar, publicar, acompanhar e transformar um sinal em próxima ação.</p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-panel)]">
          <div className="flex gap-2 overflow-x-auto border-b border-border/70 bg-surface/30 px-4 py-3 sm:px-6">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const done = step > index;
              const active = step === index;
              return <div key={item.label} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-all duration-300 ${active ? "bg-primary text-primary-foreground shadow-sm" : done ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}{item.label}</div>;
            })}
            <span className="ml-auto hidden shrink-0 self-center text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground sm:block">Dados ilustrativos</span>
          </div>

          <div className="grid min-h-[520px] lg:grid-cols-[.72fr_1.28fr]">
            <aside className="border-b border-border/70 bg-surface/20 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">Tour guiado</p>
              <h3 className="mt-3 text-2xl font-black">
                {step === 0 && "Encontre uma referência."}
                {step === 1 && "Escolha o anúncio base."}
                {step === 2 && "Veja a IA entrar no fluxo."}
                {step === 3 && "Prepare a publicação."}
                {step === 4 && "O anúncio entra no acompanhamento."}
                {step >= 5 && "O sistema aponta o próximo passo."}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {step === 0 && "Digite um produto e simule como começa a pesquisa dentro da plataforma."}
                {step === 1 && "Selecione uma referência demonstrativa e transforme-a em um rascunho editável."}
                {step === 2 && "A IA aparece como parte do processo, sem retirar sua revisão e decisão final."}
                {step === 3 && "Na operação real, a publicação só acontece depois da sua confirmação e conexão autorizada."}
                {step === 4 && "Depois da publicação, o anúncio continua visível na gestão e nos indicadores da conta."}
                {step >= 5 && "A proposta é fechar o ciclo: dado disponível vira prioridade e leva você direto para a ação correspondente."}
              </p>
              <div className="mt-7 rounded-2xl border border-border/70 bg-background/80 p-4"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> O que você está vendo</div><p className="mt-2 text-sm font-semibold">Uma simulação local. Não representa anúncio, preço, venda, vendedor ou resultado real.</p></div>
            </aside>

            <div className="relative p-5 sm:p-7" aria-live="polite">
              {step === 0 && <SearchStep query={query} setQuery={setQuery} loading={loading} startSearch={startSearch} />}
              {step === 1 && <ResultsStep selected={selected} setSelected={setSelected} next={() => setStep(2)} />}
              {step === 2 && <OptimizeStep product={activeProduct} next={() => setStep(3)} />}
              {step === 3 && <PublishStep product={activeProduct} next={() => setStep(4)} />}
              {step === 4 && <TrackingStep product={activeProduct} next={() => setStep(5)} />}
              {step >= 5 && <OpportunityStep restart={restart} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchStep({ query, setQuery, loading, startSearch }: { query: string; setQuery: (value: string) => void; loading: boolean; startSearch: () => void }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"><div className="flex items-center gap-2 text-sm font-black"><Search className="h-4 w-4 text-primary" /> Buscar anúncios</div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && startSearch()} placeholder="Ex.: fone bluetooth" className="h-12" /><Button onClick={startSearch} disabled={loading || !query.trim()} className="h-12 gap-2 px-6 font-bold"><Search className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} /> {loading ? "Buscando..." : "Simular busca"}</Button></div>{loading ? <div className="mt-7 space-y-3">{[0,1,2].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl border border-border/60 bg-surface/50" />)}<p className="text-center text-xs font-semibold text-muted-foreground">Consultando referências → validando → organizando resultados</p></div> : <div className="mt-8 grid gap-3 sm:grid-cols-3">{["Pesquise", "Compare", "Escolha"].map((label, index) => <div key={label} className="rounded-2xl border border-border/70 bg-surface/30 p-4 transition hover:-translate-y-1 hover:border-primary/30"><span className="text-3xl font-black text-primary/20">0{index + 1}</span><p className="mt-3 text-sm font-black">{label}</p></div>)}</div>}</div>;
}

function ResultsStep({ selected, setSelected, next }: { selected: number; setSelected: (value: number) => void; next: () => void }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Resultados demonstrativos</p><p className="mt-1 text-xs text-muted-foreground">Escolha uma referência para continuar.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">3 encontrados</span></div><div className="mt-5 space-y-3">{demoProducts.map((product, index) => <button key={product.title} type="button" onClick={() => setSelected(index)} className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:p-4 ${selected === index ? "border-primary/50 bg-primary/[.05]" : "border-border/70 bg-background"}`}><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-primary sm:h-14 sm:w-14"><PackageCheck className="h-6 w-6" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black sm:truncate">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">{product.seller} · {product.score}</p></div><span className="hidden text-sm font-black sm:block">{product.price}</span></button>)}</div><div className="mt-5 flex justify-end"><Button onClick={next} className="gap-2 font-bold">Copiar para rascunho <Copy className="h-4 w-4" /></Button></div></div>;
}

function OptimizeStep({ product, next }: { product: (typeof demoProducts)[number]; next: () => void }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"><div className="rounded-2xl border border-border/70 bg-background p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-extrabold uppercase tracking-[.14em] text-muted-foreground">Rascunho</span><Badge variant="outline">Editável</Badge></div><p className="mt-4 text-lg font-black">{product.title}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Mini label="Preço de referência" value={product.price} /><Mini label="Origem" value="Referência demonstrativa" /></div></div><div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[.05] p-5"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wand2 className="h-5 w-5" /></span><div><p className="font-black">Copilot de otimização</p><p className="mt-1 text-sm leading-6 text-muted-foreground">A demonstração representa a revisão de conteúdo antes da sua aprovação.</p><div className="mt-4 space-y-2"><Progress value={86} /><p className="text-xs font-semibold text-primary">Estrutura revisada · etapa demonstrativa</p></div></div></div></div><div className="mt-5 flex justify-end"><Button onClick={next} className="gap-2 font-bold">Continuar para publicação <Sparkles className="h-4 w-4" /></Button></div></div>;
}

function PublishStep({ product, next }: { product: (typeof demoProducts)[number]; next: () => void }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"><div className="rounded-2xl border border-primary/20 bg-primary/[.04] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-primary">Revisão final</p><h3 className="mt-2 text-xl font-black">{product.title}</h3></div><Badge variant="outline">Nenhuma publicação real</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Conteúdo" value="Revisado" /><Mini label="Origem" value="Rascunho" /><Mini label="Ação externa" value="Aguardando usuário" /></div><p className="mt-5 text-sm leading-6 text-muted-foreground">Na conta real, o envio só ocorre após sua confirmação. Nesta vitrine, o próximo passo apenas simula o estado publicado.</p></div><div className="mt-5 flex justify-end"><Button onClick={next} className="gap-2 font-bold">Simular publicação <PackageCheck className="h-4 w-4" /></Button></div></div>;
}

function TrackingStep({ product, next }: { product: (typeof demoProducts)[number]; next: () => void }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"><div className="flex items-center gap-2 text-sm font-black text-primary"><Check className="h-4 w-4" /> Publicação simulada concluída</div><h3 className="mt-3 text-2xl font-black">O anúncio não desaparece depois de publicar.</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Ele passa a fazer parte da visão operacional e pode alimentar análises posteriores quando houver dados reais disponíveis.</p><div className="mt-6 rounded-2xl border bg-background p-4 sm:p-5"><div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">Status demonstrativo: ativo · acompanhamento disponível</p></div><Badge variant="outline">No painel</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Saúde" value="85/100" /><Mini label="Margem" value="24,6%" /><Mini label="Prioridades" value="1 sinal" /></div></div><div className="mt-5 flex justify-end"><Button onClick={next} className="gap-2 font-bold">Ver próxima ação <Lightbulb className="h-4 w-4" /></Button></div></div>;
}

function OpportunityStep({ restart }: { restart: () => void }) {
  return <div className="motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in motion-safe:duration-300"><div className="rounded-2xl border border-primary/25 bg-primary/[.05] p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><Badge>Próxima melhor ação</Badge><span className="text-xs font-semibold text-muted-foreground">Exemplo ilustrativo</span></div><h3 className="mt-4 max-w-xl text-balance text-2xl font-black sm:text-3xl">A margem simulada ficou abaixo da meta.</h3><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Em vez de encerrar na publicação, a experiência mostra como um sinal pode virar uma prioridade e levar para o módulo certo.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><Mini label="Sinal" value="Margem" /><Mini label="Impacto" value="Atenção" /><Mini label="Próximo módulo" value="Precificação" /></div></div><div className="mt-6 rounded-2xl border border-dashed border-border/80 p-5 text-center"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-primary">Fechou o ciclo</p><h3 className="mt-2 text-2xl font-black">Agora faça isso com seus próprios anúncios.</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Crie sua conta, conecte o Mercado Livre e use os módulos com os dados reais da sua operação.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="gap-2 font-bold shadow-glow"><Link to="/auth" search={{ mode: "signup" }}>Usar com meus anúncios <ArrowRight className="h-4 w-4" /></Link></Button><Button variant="outline" size="lg" onClick={restart} className="font-bold">Refazer demonstração</Button></div></div></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface/50 p-4"><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-1 text-sm font-black sm:text-base">{value}</p></div>;
}
