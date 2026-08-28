import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const getMercadoLivreCapabilityHealth=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db=context.supabase as any
  const {data:connection}=await db.from('ml_connections').select('connected,ml_user_id,last_sync_at,listings_count').eq('user_id',context.userId).maybeSingle()
  if(!connection?.connected)return {connected:false,token:'missing' as const,search:'blocked' as const,sales:'blocked' as const,last_sync_at:connection?.last_sync_at??null,listings_count:connection?.listings_count??0}
  const {getValidMlAccessToken}=await import('@/lib/ml.server')
  const tokenState=await getValidMlAccessToken(context.userId)
  if(!tokenState.ok)return {connected:true,token:'expired' as const,search:'blocked' as const,sales:'blocked' as const,last_sync_at:connection.last_sync_at??null,listings_count:connection.listings_count??0,reason:tokenState.reason}
  let search:'ok'|'error'='error',sales:'ok'|'permission'|'error'='error'
  const headers={Authorization:`Bearer ${tokenState.accessToken}`,Accept:'application/json'}
  try{
    const url=new URL('https://api.mercadolibre.com/products/search')
    url.searchParams.set('status','active')
    url.searchParams.set('site_id','MLB')
    url.searchParams.set('q','teste')
    url.searchParams.set('limit','1')
    const r=await fetch(url,{headers})
    search=r.ok?'ok':'error'
  }catch{search='error'}
  if(connection.ml_user_id){try{const r=await fetch(`https://api.mercadolibre.com/orders/search?seller=${encodeURIComponent(String(connection.ml_user_id))}&limit=1`,{headers});sales=r.ok?'ok':r.status===401||r.status===403?'permission':'error'}catch{sales='error'}}
  return {connected:true,token:'ok' as const,search,sales,last_sync_at:connection.last_sync_at??null,listings_count:connection.listings_count??0}
})
