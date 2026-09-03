import { useState } from "react";
import { ArrowRight, BarChart3, Bot, CircleDollarSign, Gauge, HeartPulse, Radar, Sparkles, Target, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const views = [
  { id: "overview", label: "Visão geral", icon: Gauge },
  { id: "opportunities", label: "Oportunidades", icon: Target },
  { id: "competition", label: "Concorrência", icon: Radar },
  { id: "pricing", label: "Precificação", icon: CircleDollarSign },
  { id: "health", label: "Raio-X", icon: HeartPulse },
  { id: "automation", label: "Automação", icon: Bot },
] as const;

type ViewId = (typeof views)[number]["id"];

export function ProductInsideShowcase() {
  const [active, setActive] = useState<ViewId>("overview");

  return (
    <section id="produto-por-dentro" className="border-y border-border/60 bg-surface/20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> VEJA O PRODUTO POR DENTRO</Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-5xl">Não é só copiar anúncio. É uma central de operação.</h2>
          <p className="mt-4 text-pretty leading-7 text-muted-foreground">Explore as áreas que conectam análise, decisão e ação. Os números abaixo são ilustrativos para demonstrar a experiência visual do produto.</p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-panel)]">
          <div className="flex gap-1 overflow-x-auto border-b border-border/70 bg-background/70 p-2 sm:p-3">
            {views.map((view) => {
              const Icon = view.icon;
              const selected = active === view.id;
              return <button key={view.id} type="button" onClick={() => setActive(view.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-200 ${selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}><Icon className="h-4 w-4" />{view.label}</button>;
            })}
          </div>

          <div className="grid min-h-[440px] lg:grid-cols-[210px_1fr]">
            <aside className="hidden border-r border-border/70 bg-sidebar/60 p-4 lg:block">
              <p className="px-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-muted-foreground">ANÚNCIO ML</p>
              <div className="mt-4 space-y-1">
                {views.map((view) => { const Icon = view.icon; return <div key={view.id} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${active === view.id ? "bg-primary/12 text-primary" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{view.label}</div>; })}
              </div>
              <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/[.06] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Fluxo conectado</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Cada análise leva para a próxima ação dentro da plataforma.</p></div>
            </aside>

            <div className="p-5 sm:p-7" aria-live="polite">
              {active === "overview" && <Overview />}
              {active === "opportunities" && <Opportunities />}
              {active === "competition" && <Competition />}
              {active === "pricing" && <Pricing />}
              {active === "health" && <Health />}
              {active === "automation" && <Automation />}
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
          <Button asChild size="lg" className="gap-2 font-bold shadow-glow"><Link to="/auth" search={{ mode: "signup" }}>Usar com meus anúncios <ArrowRight className="h-4 w-4" /></Link></Button>
          <span className="text-xs text-muted-foreground">Comece testando o fluxo com 10 anúncios.</span>
        </div>
      </div>
    </section>
  );
}

function Header({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-primary">{eyebrow}</p><h3 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{text}</p></div>; }
function Stat({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="rounded-2xl border border-border/70 bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></div>; }

function Overview() { return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Header eyebrow="Painel do vendedor" title="A operação inteira em uma leitura." text="Vendas, anúncios, prioridades e inteligência aparecem no mesmo contexto para reduzir troca de tela."/><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Receita 30 dias" value="R$ 28,4 mil" hint="dado demonstrativo"/><Stat label="Margem estimada" value="23,8%" hint="dado demonstrativo"/><Stat label="Oportunidades" value="7" hint="exemplo de fila"/><Stat label="Saúde" value="91/100" hint="exemplo visual"/></div><div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-border/70 bg-background p-5"><div className="flex items-center justify-between"><p className="text-sm font-black">Desempenho</p><BarChart3 className="h-4 w-4 text-primary"/></div><div className="mt-7 flex h-36 items-end gap-2">{[32,45,39,58,52,68,61,76,72,84,79,92].map((h,i)=><span key={i} className="flex-1 rounded-t-md bg-primary/20 transition-all duration-300 hover:bg-primary/45" style={{height:`${h}%`}} />)}</div></div><div className="rounded-2xl border border-primary/20 bg-primary/[.05] p-5"><Zap className="h-5 w-5 text-primary"/><p className="mt-4 text-sm font-black">Próxima melhor ação</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Priorize anúncios com margem baixa antes de revisar itens saudáveis.</p><span className="mt-5 inline-flex text-xs font-bold text-primary">Abrir oportunidade →</span></div></div></div>; }

function Opportunities() { const items=["3 anúncios com margem baixa","2 anúncios com estoque crítico","1 anúncio com cadastro incompleto"]; return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Header eyebrow="Central de oportunidades" title="O sistema mostra por onde começar." text="Em vez de despejar indicadores, a central transforma sinais disponíveis em uma fila objetiva de ações."/><div className="mt-6 space-y-3">{items.map((item,i)=><div key={item} className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background p-4 transition hover:-translate-y-0.5 hover:border-primary/30"><span className={`flex h-10 w-10 items-center justify-center rounded-xl font-black ${i===0?"bg-destructive/10 text-destructive":"bg-primary/10 text-primary"}`}>0{i+1}</span><div className="flex-1"><p className="text-sm font-black">{item}</p><p className="mt-1 text-xs text-muted-foreground">Exemplo ilustrativo de prioridade operacional.</p></div><ArrowRight className="h-4 w-4 text-muted-foreground"/></div>)}</div></div>; }

function Competition() { return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Header eyebrow="Radar de concorrência" title="Preço sozinho não conta a história toda." text="Compare referências, acompanhe mudanças e enxergue contexto antes de tomar uma decisão comercial."/><div className="mt-6 grid gap-4 md:grid-cols-3"><Stat label="Seu preço" value="R$ 119,90" hint="exemplo"/><Stat label="Mediana" value="R$ 124,50" hint="exemplo"/><Stat label="Referências" value="8" hint="exemplo"/></div><div className="mt-4 rounded-2xl border border-border/70 bg-background p-5"><div className="flex items-center gap-2 text-sm font-black"><Radar className="h-4 w-4 text-primary"/>Posicionamento demonstrativo</div><div className="mt-6 space-y-4">{[["Sua oferta",72],["Referência A",88],["Referência B",61]].map(([label,value])=><div key={String(label)}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><span className="font-bold">{value}%</span></div><Progress value={Number(value)}/></div>)}</div></div></div>; }

function Pricing() { return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Header eyebrow="Preço e margem" title="Simule antes de alterar." text="Entenda o impacto de preço, custos e margem antes de qualquer decisão. Nenhuma alteração é feita nesta demonstração."/><div className="mt-6 grid gap-4 md:grid-cols-3"><Stat label="Preço simulado" value="R$ 129,90" hint="exemplo"/><Stat label="Margem simulada" value="24,6%" hint="exemplo"/><Stat label="Resultado por unidade" value="R$ 31,95" hint="exemplo"/></div><div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[.05] p-5"><div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 h-5 w-5 text-primary"/><div><p className="font-black">Decisão com contexto</p><p className="mt-1 text-sm leading-6 text-muted-foreground">A proposta é comparar cenários antes de mexer no anúncio real, mantendo a decisão final com o vendedor.</p></div></div></div></div>; }

function Health() { const checks=[["Título e estrutura",92],["Cadastro",84],["Apresentação",76],["Consistência",88]]; return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Header eyebrow="Raio-X do anúncio" title="Veja onde o anúncio pode melhorar." text="O diagnóstico organiza pontos objetivos em uma leitura rápida e direciona para a correção correspondente."/><div className="mt-6 grid gap-4 lg:grid-cols-[.65fr_1.35fr]"><div className="flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/[.05] p-7"><HeartPulse className="h-7 w-7 text-primary"/><p className="mt-4 text-5xl font-black">85</p><p className="mt-1 text-xs font-bold text-muted-foreground">SCORE DEMONSTRATIVO</p></div><div className="rounded-2xl border border-border/70 bg-background p-5 space-y-4">{checks.map(([label,value])=><div key={String(label)}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{label}</span><span>{value}/100</span></div><Progress value={Number(value)}/></div>)}</div></div></div>; }

function Automation() { return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Header eyebrow="Automação com guardrails" title="Automatize primeiro no modo seguro." text="Regras podem ser avaliadas e simuladas antes de qualquer ação externa. A demonstração não executa alterações no Mercado Livre."/><div className="mt-6 grid gap-3 sm:grid-cols-2">{[["Estoque baixo","Avisar quando atingir limite"],["Margem baixa","Sinalizar item fora da meta"],["Anúncio parado","Priorizar revisão"],["Saúde do anúncio","Criar alerta abaixo do score"]].map(([title,text])=><div key={title} className="rounded-2xl border border-border/70 bg-background p-4"><div className="flex items-center justify-between"><Bot className="h-5 w-5 text-primary"/><Badge variant="outline">Simulação</Badge></div><p className="mt-4 text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div></div>; }
