import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function ensureAdmin(context:any){const {assertCapability}=await import('@/lib/permissions.server');await assertCapability(context,'admin.access')}

export const generateRecoveryMessage=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({payment_id:z.string().uuid(),email:z.string().email().nullish(),plan:z.string().max(100).nullish(),amount_cents:z.number().int().min(0),status:z.enum(['pending','rejected','cancelled'])}).parse(d)).handler(async({data,context})=>{
 await ensureAdmin(context)
 const {aiJson}=await import('@/lib/ai.server')
 const prompt=`Você é o assistente comercial do ANÚNCIO ML, uma plataforma SaaS para vendedores do Mercado Livre. Gere uma mensagem curta em português do Brasil para recuperação de uma tentativa de compra que não foi concluída. Não pressione, não invente desconto e não diga que o pagamento foi aprovado.\nStatus: ${data.status}\nPlano: ${data.plan??'não informado'}\nValor: R$ ${(data.amount_cents/100).toFixed(2).replace('.',',')}\nCliente: ${data.email??'cliente'}\nRetorne JSON: {"message":string,"subject":string,"next_step":string}`
 const out=await aiJson<{message:string;subject:string;next_step:string}>(prompt)
 if(!out.ok)return out
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server')
 await supabaseAdmin.from('sales_recovery_actions').insert({payment_id:data.payment_id,admin_user_id:context.userId,action:'generated',message:out.result.message})
 return {ok:true as const,...out.result}
})

export const markRecoveryAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({payment_id:z.string().uuid(),action:z.enum(['contacted','resolved','ignored']),note:z.string().max(500).nullish()}).parse(d)).handler(async({data,context})=>{
 await ensureAdmin(context);const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {error}=await supabaseAdmin.from('sales_recovery_actions').insert({payment_id:data.payment_id,admin_user_id:context.userId,action:data.action,note:data.note??null});if(error)throw new Error('Não foi possível registrar a ação.');return {ok:true as const}
})
