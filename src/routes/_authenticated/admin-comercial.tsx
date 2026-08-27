import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Bot, Check, Copy, Loader2, MessageCircle, RefreshCcw, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL, formatDateTime } from '@/lib/format'
import { adminListPayments } from '@/lib/admin.functions'
import { generateRecoveryMessage, markRecoveryAction } from '@/lib/admin-commercial.functions'
import { checkIsAdmin } from '@/lib/roles.functions'

export const Route=createFileRoute('/_authenticated/admin-comercial')({beforeLoad:async()=>{try{const {isAdmin}=await checkIsAdmin();if(!isAdmin)throw redirect({to:'/dashboard'})}catch(e){if(isRedirect(e))throw e;throw redirect({to:'/dashboard'})}},component:Commercial})
function Commercial(){
 const list=useServerFn(adminListPayments),generate=useServerFn(generateRecoveryMessage),mark=useServerFn(markRecoveryAction)
 const {data,isLoading,refetch}=useQuery({queryKey:['admin-recovery-payments'],queryFn:async()=>{const [pending,rejected]=await Promise.all([list({data:{status:'pending',page:0,pageSize:50}}),list({data:{status:'rejected',page:0,pageSize:50}})]);return [...pending.payments,...rejected.payments].sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())}})
 const [messages,setMessages]=useState<Record<string,string>>({})
 const gen=useMutation({mutationFn:(p:any)=>generate({data:{payment_id:p.id,email:p.email,plan:p.plan,amount_cents:p.amount_cents,status:p.status}}),onSuccess:(r:any,vars:any)=>{if(r.ok)setMessages(x=>({...x,[vars.id]:r.message}));else toast.error(r.reason??'Não foi possível gerar a mensagem.')}})
 const action=useMutation({mutationFn:(v:{payment_id:string;action:'contacted'|'resolved'|'ignored'})=>mark({data:v}),onSuccess:()=>toast.success('Ação registrada')})
 return <AdminLayout activeSection="pagamentos" onSectionChange={()=>{}}><div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-extrabold">Assistente comercial</h2><p className="text-sm text-muted-foreground">Recupere pagamentos pendentes e recusados com mensagens geradas pela IA e revisão humana antes do envio.</p></div><Button variant="outline" onClick={()=>refetch()}><RefreshCcw className="mr-2 h-4 w-4"/>Atualizar</Button></div><div className="grid gap-4">{isLoading?<Card><CardContent className="p-8 text-sm text-muted-foreground">Carregando oportunidades...</CardContent></Card>:(data??[]).length===0?<Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum pagamento pendente ou recusado para recuperar.</CardContent></Card>:(data??[]).map((p:any)=><Card key={p.id}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="text-base">{p.email??'Cliente sem e-mail'}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{p.plan??'Plano não informado'} · {formatBRL(p.amount_cents)} · {formatDateTime(p.created_at)}</p></div><Badge variant={p.status==='rejected'?'destructive':'secondary'}>{p.status==='rejected'?'Recusado':'Pendente'}</Badge></CardHeader><CardContent className="space-y-3">{messages[p.id]?<div className="rounded-xl border bg-muted/30 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4 text-primary"/>Mensagem sugerida</div><p className="whitespace-pre-wrap text-sm">{messages[p.id]}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>{void navigator.clipboard.writeText(messages[p.id]);toast.success('Mensagem copiada')}}><Copy className="mr-2 h-4 w-4"/>Copiar</Button><Button size="sm" onClick={()=>action.mutate({payment_id:p.id,action:'contacted'})}><MessageCircle className="mr-2 h-4 w-4"/>Marcar contatado</Button><Button size="sm" variant="outline" onClick={()=>action.mutate({payment_id:p.id,action:'resolved'})}><Check className="mr-2 h-4 w-4"/>Resolvido</Button><Button size="sm" variant="ghost" onClick={()=>action.mutate({payment_id:p.id,action:'ignored'})}><X className="mr-2 h-4 w-4"/>Ignorar</Button></div></div>:<Button onClick={()=>gen.mutate(p)} disabled={gen.isPending}><Bot className="mr-2 h-4 w-4"/>{gen.isPending?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Gerando...</>:'Gerar abordagem com IA'}</Button>}</CardContent></Card>)}</div></div></AdminLayout>
}
