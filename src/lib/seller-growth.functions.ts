import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Opportunity={key:string;severity:"high"|"medium"|"low";title:string;description:string;count:number;action_to:string};

export const getSellerGrowthOverview=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const db=context.supabase as any;
  const [{data:listings},{data:connection,error:connectionError},{data:quota},tokenState]=await Promise.all([
    db.from("listings").select("id,title,status,stock,price_cents,cost_cents,fees_cents,ai_score,images,attributes,source_ml_id,source_permalink,updated_at"),
    db.from("ml_connections").select("connected,ml_user_id,nickname,last_sync_at,listings_count").eq("user_id",context.userId).maybeSingle(),
    db.rpc("my_ad_quota"),
    import("@/lib/ml.server").then(({getValidMlAccessToken})=>getValidMlAccessToken(context.userId)).catch(()=>({ok:false as const,reason:"token_check_failed"}))
  ]);
  if(connectionError)console.error("growth ML connection lookup failed",connectionError);
  const rows=listings??[],opportunities:Opportunity[]=[];
  const relevant=rows.filter((r:any)=>!["closed","archived"].includes(String(r.status??"")));
  const active=rows.filter((r:any)=>r.status==="active");
  const mlConnected=tokenState.ok===true;
  const lowStock=active.filter((r:any)=>Number(r.stock??0)<=3);
  const noCost=active.filter((r:any)=>!r.cost_cents);
  const weakAi=relevant.filter((r:any)=>r.ai_score!==null&&r.ai_score!==undefined&&Number(r.ai_score)<70);
  const noImages=relevant.filter((r:any)=>!Array.isArray(r.images)||r.images.length<3);
  const incomplete=relevant.filter((r:any)=>!r.title||!r.price_cents||!Array.isArray(r.attributes)||!r.attributes.length);
  const lowMargin=active.filter((r:any)=>{const p=Number(r.price_cents??0),c=Number(r.cost_cents??0),f=Number(r.fees_cents??0);return p>0&&c>0&&((p-c-f)/p)*100<15});
  const add=(items:any[],o:Opportunity)=>{if(items.length)opportunities.push({...o,count:items.length})};
  add(lowStock,{key:"low-stock",severity:"high",title:"Estoque baixo",description:"Anúncios ativos podem perder vendas por falta de estoque.",count:0,action_to:"/estoque"});
  add(lowMargin,{key:"low-margin",severity:"high",title:"Margem apertada",description:"Produtos ativos com margem estimada abaixo de 15%.",count:0,action_to:"/estoque"});
  add(weakAi,{key:"weak-ai",severity:"medium",title:"Anúncios para otimizar",description:"Somente anúncios já avaliados pela IA com pontuação abaixo de 70.",count:0,action_to:"/anuncios"});
  add(noImages,{key:"images",severity:"medium",title:"Poucas imagens",description:"Anúncios em operação com menos de 3 imagens merecem revisão.",count:0,action_to:"/anuncios"});
  add(noCost,{key:"missing-cost",severity:"low",title:"Custo não informado",description:"Cadastre custo e taxas nos anúncios ativos para enxergar lucro real.",count:0,action_to:"/estoque"});
  add(incomplete,{key:"incomplete",severity:"medium",title:"Cadastro incompleto",description:"Anúncios em operação com campos importantes ausentes.",count:0,action_to:"/anuncios"});
  if(!mlConnected)opportunities.unshift({key:"ml-disconnected",severity:"high",title:"Mercado Livre desconectado",description:"Reconecte para sincronizar anúncios, vendas e automações.",count:1,action_to:"/integracoes"});

  let sales={available:false,orders:0,revenue_cents:0,ticket_cents:0,units:0},champions:any[]=[];
  if(mlConnected){
    const now=new Date(),from=new Date(now);from.setDate(from.getDate()-30);
    try{
      const {fetchSellerOrders}=await import("@/lib/orders.server");
      const result=await fetchSellerOrders(context.userId,from.toISOString(),now.toISOString());
      if(result.ok){
        const paid=result.orders.filter(o=>!["cancelled","invalid"].includes(o.status)),revenue=paid.reduce((s,o)=>s+Math.round((o.paid_amount??o.total_amount)*100),0),rank=new Map<string,any>();let units=0;
        for(const order of paid)for(const entry of order.items){units+=entry.quantity;const id=entry.item_id;if(!id)continue;const current=rank.get(id)??{ml_item_id:id,title:entry.title,units:0,revenue_cents:0};current.units+=entry.quantity;current.revenue_cents+=Math.round(entry.unit_price*entry.quantity*100);rank.set(id,current);}
        sales={available:true,orders:paid.length,revenue_cents:revenue,ticket_cents:paid.length?Math.round(revenue/paid.length):0,units};
        champions=Array.from(rank.values()).sort((a,b)=>b.units-a.units||b.revenue_cents-a.revenue_cents).slice(0,5).map((c:any)=>{const local=rows.find((r:any)=>r.source_ml_id===c.ml_item_id);const first=Array.isArray(local?.images)?local.images[0]:null;return {...c,listing_id:local?.id??null,permalink:typeof local?.source_permalink==="string"?local.source_permalink:null,title:local?.title??c.title,image:typeof first==="string"?first:first?.secure_url??first?.url??null};});
      }
    }catch(error){console.error("growth orders summary failed",error);}
  }
  const q=Array.isArray(quota)?quota[0]:quota,weight={high:0,medium:1,low:2} as const;
  return {
    opportunities:opportunities.sort((a,b)=>weight[a.severity]-weight[b.severity]),
    score:Math.max(0,100-opportunities.reduce((s,o)=>s+(o.severity==="high"?18:o.severity==="medium"?9:4),0)),
    sales,champions,catalog:{total:rows.length,active:active.length},
    ai:{scored:relevant.filter((r:any)=>r.ai_score!==null&&r.ai_score!==undefined).length,unscored:relevant.filter((r:any)=>r.ai_score===null||r.ai_score===undefined).length},
    quota:{quota:q?.quota??0,used:q?.used??0,remaining:q?.remaining??0},
    connection:{connected:mlConnected,ml_user_id:connection?.ml_user_id??null,nickname:connection?.nickname??null,last_sync_at:connection?.last_sync_at??null,listings_count:connection?.listings_count??0}
  };
});

export const calculateSmartPrice=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({cost_cents:z.number().int().positive(),fees_percent:z.number().min(0).max(60).default(16),fixed_fees_cents:z.number().int().min(0).default(0),target_margin_percent:z.number().min(1).max(80).default(20)}).parse(d)).handler(async({data})=>{const v=data.fees_percent/100,m=data.target_margin_percent/100,den=1-v-m;if(den<=.05)throw new Error("Margem e taxas incompatíveis.");const p=Math.ceil((data.cost_cents+data.fixed_fees_cents)/den),f=Math.round(p*v)+data.fixed_fees_cents,l=p-data.cost_cents-f;return {suggested_price_cents:p,estimated_fees_cents:f,estimated_profit_cents:l,estimated_margin_percent:p?Math.round((l/p)*10000)/100:0};});
export const getReferralSummary=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const db=context.supabase as any,{data:code,error}=await db.rpc("ensure_referral_code");if(error)throw new Error("Não foi possível gerar seu código de indicação.");const {data:r}=await db.from("referrals").select("id,status,reward_ads,created_at").eq("referrer_user_id",context.userId).order("created_at",{ascending:false});return {code:String(code),total:r?.length??0,converted:(r??[]).filter((x:any)=>["converted","rewarded"].includes(x.status)).length,rewarded_ads:(r??[]).filter((x:any)=>x.status==="rewarded").reduce((s:number,x:any)=>s+Number(x.reward_ads??0),0),referrals:r??[]};});
export const listCompetitorWatch=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {data,error}=await (context.supabase as any).from("competitor_watch").select("*").order("created_at",{ascending:false});if(error)throw new Error("Não foi possível carregar o radar.");return data??[];});
export const addCompetitorWatch=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({ml_item_id:z.string().trim().regex(/^MLB\d+$/i),title:z.string().max(200).nullish(),permalink:z.string().url().nullish()}).parse(d)).handler(async({data,context})=>{const db=context.supabase as any,id=data.ml_item_id.toUpperCase();const {data:row,error}=await db.from("competitor_watch").upsert({user_id:context.userId,ml_item_id:id,title:data.title??null,permalink:data.permalink??null},{onConflict:"user_id,ml_item_id"}).select("*").single();if(error)throw new Error("Não foi possível adicionar ao radar.");return row;});
export const removeCompetitorWatch=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({id:z.string().uuid()}).parse(d)).handler(async({data,context})=>{const {error}=await (context.supabase as any).from("competitor_watch").delete().eq("id",data.id).eq("user_id",context.userId);if(error)throw new Error("Não foi possível remover do radar.");return {ok:true as const};});

export const getResellerDashboard=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const db=supabaseAdmin as any;const {data:reseller,error}=await db.from("resellers").select("*").eq("user_id",context.userId).maybeSingle();if(error)throw new Error("Não foi possível carregar o cadastro de revendedor.");if(!reseller)return {enabled:false as const,sales:[]};const {data:sales}=await db.from("reseller_sales").select("*,plans(name)").eq("reseller_id",reseller.id).order("created_at",{ascending:false}).limit(100);return {enabled:reseller.status==="active",reseller,sales:sales??[]};});
export const adminListResellers=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {assertCapability}=await import("@/lib/permissions.server");await assertCapability(context,"admin.access");const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const {data,error}=await (supabaseAdmin as any).from("resellers").select("*").order("created_at",{ascending:false});if(error)throw new Error("Não foi possível carregar os revendedores.");return data??[];});
export const adminCreateReseller=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email(),discount_percent:z.number().min(0).max(80),wallet_cents:z.number().int().min(0).max(100000000)}).parse(d)).handler(async({data,context})=>{const {assertCapability,logAudit}=await import("@/lib/permissions.server");await assertCapability(context,"admin.access");const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const db=supabaseAdmin as any;const email=data.email.toLowerCase();let userId:string|null=null;const {data:profile}=await db.from("profiles").select("user_id,email").ilike("email",email).limit(1).maybeSingle();if(profile?.user_id)userId=String(profile.user_id);const {data:existing}=await db.from("resellers").select("id").ilike("email",email).limit(1).maybeSingle();if(existing)throw new Error("Já existe um revendedor cadastrado com este e-mail.");const {data:row,error}=await db.from("resellers").insert({name:data.name,email,user_id:userId,discount_percent:data.discount_percent,wallet_cents:data.wallet_cents,status:"active"}).select("*").single();if(error)throw new Error("Não foi possível criar o revendedor.");if(data.wallet_cents>0)await db.from("reseller_wallet_transactions").insert({reseller_id:row.id,amount_cents:data.wallet_cents,kind:"credit",reference:"saldo inicial"});await logAudit({actorId:context.userId,action:"reseller.create",entity:"reseller",entityId:row.id,details:{email,discount_percent:data.discount_percent,wallet_cents:data.wallet_cents,linked_user:!!userId}});return row;});
