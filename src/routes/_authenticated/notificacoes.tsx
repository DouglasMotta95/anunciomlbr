import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { AlertTriangle, Bell, CheckCheck, CircleAlert, Sparkles, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/app/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { getSellerGrowthOverview } from '@/lib/seller-growth.functions'

export const Route=createFileRoute('/_authenticated/notificacoes')({component:Notificacoes})

const severityLabel={high:'Urgente',medium:'Atenção',low:'Oportunidade'} as const
const severityVariant={high:'destructive',medium:'secondary',low:'outline'} as const

function Notificacoes(){
  const queryClient=useQueryClient()
  const overviewFn=useServerFn(getSellerGrowthOverview)
  const {data:overview,isLoading}=useQuery({queryKey:['seller-growth','notifications'],queryFn:()=>overviewFn(),staleTime:30000})
  const {data:persistent=[]}=useQuery({queryKey:['user-notifications'],queryFn:async()=>{const {data,error}=await supabase.from('user_notifications').select('*').order('created_at',{ascending:false}).limit(30);if(error)throw error;return data??[]}})
  const unread=persistent.filter((n:any)=>!n.read_at).length
  const markAll=async()=>{if(!unread)return;const {data:{user}}=await supabase.auth.getUser();if(!user)return;await supabase.from('user_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);await queryClient.invalidateQueries({queryKey:['user-notifications']})}
  const opportunities=overview?.opportunities??[]
  const quota=overview?.quota
  const usage=(quota?.quota??0)>0?Math.round(((quota?.used??0)/(quota?.quota??1))*100):0
  return <AppShell title="Alertas e oportunidades" description="Veja o que merece sua atenção agora, usando dados reais da sua operação." actions={<Button variant="outline" size="sm" onClick={markAll} disabled={!unread}><CheckCheck className="mr-2 h-4 w-4"/>Marcar lidas {unread?`(${unread})`:''}</Button>}>
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-4">
        <Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/>Oportunidades detectadas</CardTitle></CardHeader><CardContent className="space-y-2">{isLoading?<div className="h-28 animate-pulse rounded-xl bg-muted"/>:opportunities.length?opportunities.map((o:any)=><Link key={o.key} to={o.action_to as any} className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">{o.severity==='high'?<AlertTriangle className="h-5 w-5 text-destructive"/>:<TrendingUp className="h-5 w-5 text-primary"/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{o.title}</p><Badge variant={severityVariant[o.severity as keyof typeof severityVariant]}>{severityLabel[o.severity as keyof typeof severityLabel]}</Badge><Badge variant="outline">{o.count}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{o.description}</p></div><span className="text-sm font-semibold text-primary">Resolver</span></Link>):<div className="rounded-2xl border border-dashed p-6 text-center"><Bell className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-semibold">Nenhuma oportunidade crítica agora</p><p className="mt-1 text-sm text-muted-foreground">Continue acompanhando. Novos sinais aparecem conforme anúncios, estoque e vendas mudam.</p></div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Histórico de notificações</CardTitle></CardHeader><CardContent className="space-y-2">{persistent.length?persistent.map((n:any)=><div key={n.id} className={`rounded-xl border p-3 ${n.read_at?'opacity-65':'bg-primary/[.03]'}`}><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-4 w-4 text-primary"/><div className="flex-1"><p className="text-sm font-semibold">{n.title}</p><p className="mt-1 text-xs text-muted-foreground">{n.body}</p>{n.action_to&&<Button asChild variant="link" size="sm" className="mt-1 h-auto p-0"><Link to={n.action_to as any}>Abrir</Link></Button>}</div>{!n.read_at&&<Badge>Novo</Badge>}</div></div>):<p className="text-sm text-muted-foreground">O histórico ficará disponível conforme a plataforma gerar alertas persistentes.</p>}</CardContent></Card>
      </div>
      <div className="space-y-4"><Card><CardHeader><CardTitle>Consumo do plano</CardTitle></CardHeader><CardContent><p className="text-3xl font-extrabold">{usage}%</p><p className="mt-1 text-sm text-muted-foreground">{quota?.used??0} de {quota?.quota??0} anúncios utilizados.</p>{usage>=70&&<div className="mt-4 space-y-2"><p className="text-sm font-medium">Sua cota está ficando alta.</p><Button asChild className="w-full"><Link to="/creditos">Comprar anúncios extras</Link></Button><Button asChild variant="outline" className="w-full"><Link to="/licenca">Comparar upgrade</Link></Button></div>}</CardContent></Card><Card><CardHeader><CardTitle>Como os alertas funcionam</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>• Estoque baixo e margem apertada.</p><p>• Anúncios com baixa saúde ou poucas imagens.</p><p>• Problemas de integração.</p><p>• Uso de 70%, 85% e 100% da cota.</p><p>• Oportunidades de otimização e crescimento.</p></CardContent></Card></div>
    </div>
  </AppShell>
}
