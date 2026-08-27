import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const getMonthlyResults=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db=context.supabase as any
  const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),next=new Date(now.getFullYear(),now.getMonth()+1,1)
  const prevStart=new Date(now.getFullYear(),now.getMonth()-1,1),prevEnd=start
  const [{data:listings},{data:aiUsage},{data:connection}]=await Promise.all([
    db.from('listings').select('id,status,updated_at,created_at').gte('updated_at',start.toISOString()).lt('updated_at',next.toISOString()),
    db.from('ai_credit_usage').select('used').eq('user_id',context.userId).eq('period_start',start.toISOString().slice(0,10)).maybeSingle(),
    db.from('ml_connections').select('connected').eq('user_id',context.userId).maybeSingle(),
  ])
  let sales={orders:0,units:0,revenue_cents:0},previous={orders:0,units:0,revenue_cents:0}
  if(connection?.connected){try{const {fetchSellerOrders}=await import('@/lib/orders.server');for(const [range,target] of [[[start,next],sales],[[prevStart,prevEnd],previous]] as const){const result=await fetchSellerOrders(context.userId,range[0].toISOString(),range[1].toISOString());if(result.ok){const paid=result.orders.filter((o:any)=>!['cancelled','invalid'].includes(o.status));target.orders=paid.length;target.revenue_cents=paid.reduce((s:number,o:any)=>s+Math.round((o.paid_amount??o.total_amount)*100),0);target.units=paid.reduce((s:number,o:any)=>s+o.items.reduce((x:number,i:any)=>x+Number(i.quantity??0),0),0)}}}catch(error){console.error('monthly results orders failed',error)}}
  const worked=(listings??[]).length,aiActions=Number(aiUsage?.used??0),estimatedMinutesSaved=worked*4+aiActions*3
  const revenueChange=previous.revenue_cents>0?Math.round(((sales.revenue_cents-previous.revenue_cents)/previous.revenue_cents)*1000)/10:null
  return {period_start:start.toISOString(),period_end:next.toISOString(),listings_worked:worked,ai_actions:aiActions,estimated_minutes_saved:estimatedMinutesSaved,sales,previous,revenue_change_percent:revenueChange,connected:!!connection?.connected}
})
