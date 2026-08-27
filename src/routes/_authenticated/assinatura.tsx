import { createFileRoute, Link } from '@tanstack/react-router'
import { Bell, CheckCircle2, Gift, Rocket, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/assinatura')({ component: Assinatura })

const benefits = [
  ['Primeiro resultado', 'Conecte o Mercado Livre, encontre um anúncio e publique sua primeira melhoria.'],
  ['Valor do mês', 'Acompanhe anúncios trabalhados, otimizações, vendas e tempo economizado com dados reais.'],
  ['Alertas inteligentes', 'Receba avisos de cota, estoque, queda de desempenho e oportunidades.'],
]

function Assinatura() {
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <section className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-zinc-950 to-zinc-900 p-6 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div><p className="mb-2 text-sm font-semibold text-yellow-400">CENTRAL DA ASSINATURA</p><h1 className="text-3xl font-bold text-white">Seu plano precisa se pagar em resultado.</h1><p className="mt-2 max-w-2xl text-zinc-400">Veja consumo, oportunidades, benefícios e próximos passos em um único lugar.</p></div>
        <div className="flex gap-2"><Link to="/creditos" className="rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-black">Comprar extras</Link><Link to="/planos" className="rounded-xl border border-zinc-700 px-4 py-3 font-semibold text-white">Comparar planos</Link></div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">{benefits.map(([title,text],i)=><article key={title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">{i===0?<Rocket/>:i===1?<TrendingUp/>:<Bell/>}</div><h2 className="font-semibold text-white">{title}</h2><p className="mt-2 text-sm text-zinc-400">{text}</p></article>)}</section>

    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex items-center gap-2 text-white"><Sparkles className="text-yellow-400"/><h2 className="text-lg font-semibold">Missão de ativação</h2></div><div className="mt-5 space-y-3">{['Conectar conta do Mercado Livre','Buscar ou importar um anúncio','Duplicar ou otimizar um anúncio','Revisar e publicar'].map((x,i)=><div key={x} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3"><CheckCircle2 className="text-zinc-600"/><span className="text-sm text-zinc-300">{i+1}. {x}</span></div>)}</div></article>
      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex items-center gap-2 text-white"><ShieldCheck className="text-yellow-400"/><h2 className="text-lg font-semibold">Confiança da operação</h2></div><p className="mt-3 text-sm text-zinc-400">Integrações e recursos que dependem de permissões externas devem mostrar claramente o que falta configurar, sem inventar resultados.</p><Link to="/integracoes" className="mt-5 inline-flex rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white">Ver integrações</Link></article>
    </section>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex items-center gap-2"><Gift className="text-yellow-400"/><h2 className="font-semibold text-white">Cresça sem trocar de plano à força</h2></div><p className="mt-2 text-sm text-zinc-400">Quando sua cota estiver perto do limite, você poderá escolher entre upgrade e pacotes extras. Créditos extras adquiridos continuam separados do plano principal.</p></section>
  </main>
}
