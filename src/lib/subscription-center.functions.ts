import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const getSubscriptionCenter=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const db=context.supabase as any
 const month=new Date();month.setUTCDate(1);month.setUTCHours(0,0,0,0)
 const [{data:license},{data:quota},{data:aiUsage},{data:payments},{data:cancellation}]=await Promise.all([
  db.from('licenses').select('id,code,status,period,starts_at,expires_at,ads_quota,ads_used,plan_id,plans(id,name,tagline,price_monthly_cents,listing_limit,ai_credits,features)').eq('user_id',context.userId).eq('status','active').order('expires_at',{ascending:false}).limit(1).maybeSingle(),
  db.rpc('my_ad_quota'),
  db.from('ai_credit_usage').select('used').eq('user_id',context.userId).eq('period_start',month.toISOString().slice(0,10)).maybeSingle(),
  db.from('payments').select('id,status,amount_cents,period,created_at,provider_ref,plan_id').eq('user_id',context.userId).order('created_at',{ascending:false}).limit(12),
  db.from('subscription_cancellation_requests').select('id,status,requested_at').eq('user_id',context.userId).eq('status','requested').order('requested_at',{ascending:false}).limit(1).maybeSingle(),
 ])
 const q=Array.isArray(quota)?quota[0]:quota
 const plan=(license as any)?.plans??null
 return {license:license??null,plan,quota:{total:Number(q?.quota??q?.total??0),used:Number(q?.used??0),remaining:Number(q?.remaining??0)},ai:{limit:Number(plan?.ai_credits??0),used:Number(aiUsage?.used??0),remaining:Math.max(0,Number(plan?.ai_credits??0)-Number(aiUsage?.used??0))},payments:payments??[],cancellation:cancellation??null}
})
