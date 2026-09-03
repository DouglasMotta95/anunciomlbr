import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURE_KEYS = ["search_copy","ray_x","market_research","competitor_radar","pricing","automations","questions_ai","reports","multi_account","team_access"] as const;

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Acesso administrativo negado.");
}

export const adminGetControlCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, connections, rules, keywordCount, pricingCount, abuse, activity, plans, creations, published, competitors] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,full_name,last_seen_at"),
      supabaseAdmin.from("ml_connections").select("user_id,ml_user_id,nickname,connected,listings_count,last_sync_at,created_at,updated_at").order("updated_at",{ascending:false}).limit(200),
      supabaseAdmin.from("automation_rules").select("id,user_id,name,signal,threshold,action,enabled,created_at,updated_at").order("updated_at",{ascending:false}).limit(200),
      supabaseAdmin.from("keyword_tracks").select("id",{count:"exact",head:true}),
      supabaseAdmin.from("pricing_audit_log").select("id",{count:"exact",head:true}),
      supabaseAdmin.from("registration_abuse_events").select("id,created_at,status,user_id,email_hash,ip_hash,device_hash,user_agent_hash").order("created_at",{ascending:false}).limit(100),
      supabaseAdmin.from("activity_events").select("id,user_id,kind,message,created_at").order("created_at",{ascending:false}).limit(400),
      supabaseAdmin.from("plans").select("id,code,name,kind,active,listing_limit,ai_credits,feature_flags").order("sort_order",{ascending:true}),
      supabaseAdmin.from("listing_quota_claims").select("listing_id",{count:"exact",head:true}),
      supabaseAdmin.from("listings").select("id",{count:"exact",head:true}).not("published_at","is",null),
      supabaseAdmin.from("competitor_watch").select("id",{count:"exact",head:true}),
    ]);
    const errors=[profiles.error,connections.error,rules.error,keywordCount.error,pricingCount.error,abuse.error,activity.error,plans.error,creations.error,published.error,competitors.error].filter(Boolean);
    if(errors.length) throw new Error(`Falha ao carregar centro de controle: ${errors[0]?.message ?? "erro desconhecido"}`);
    const profileMap=new Map((profiles.data??[]).map((p:any)=>[p.id,p]));
    const kindCounts=new Map<string,number>();
    for(const row of activity.data??[]){const key=String((row as any).kind||"outro");kindCounts.set(key,(kindCounts.get(key)??0)+1)}
    const automationRows=(rules.data??[]) as any[];
    return {
      marketplace:{total:(connections.data??[]).length,connected:(connections.data??[]).filter((x:any)=>x.connected).length,disconnected:(connections.data??[]).filter((x:any)=>!x.connected).length,rows:(connections.data??[]).map((x:any)=>({...x,email:(profileMap.get(x.user_id) as any)?.email??null,name:(profileMap.get(x.user_id) as any)?.full_name??null}))},
      usage:{created:creations.count??0,published:published.count??0,competitorWatches:competitors.count??0,keywordTracks:keywordCount.count??0,pricingSimulations:pricingCount.count??0,activityKinds:Array.from(kindCounts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([kind,count])=>({kind,count}))},
      automations:{total:automationRows.length,enabled:automationRows.filter((x:any)=>x.enabled).length,disabled:automationRows.filter((x:any)=>!x.enabled).length,rows:automationRows.map((x:any)=>({...x,email:(profileMap.get(x.user_id) as any)?.email??null}))},
      security:{total:(abuse.data??[]).length,blocked:(abuse.data??[]).filter((x:any)=>String(x.status).includes("block")).length,registered:(abuse.data??[]).filter((x:any)=>x.status==="registered").length,rows:(abuse.data??[]).map((x:any)=>({id:x.id,created_at:x.created_at,status:x.status,user_id:x.user_id,email:(profileMap.get(x.user_id) as any)?.email??null,email_fp:x.email_hash?String(x.email_hash).slice(0,10):null,ip_fp:x.ip_hash?String(x.ip_hash).slice(0,10):null,device_fp:x.device_hash?String(x.device_hash).slice(0,10):null,user_agent_fp:x.user_agent_hash?String(x.user_agent_hash).slice(0,10):null}))},
      plans:(plans.data??[]).map((x:any)=>({...x,feature_flags:x.feature_flags??{}})),
      audit:(activity.data??[]).slice(0,100).map((x:any)=>({...x,email:(profileMap.get(x.user_id) as any)?.email??null})),
      featureKeys:FEATURE_KEYS,
      checkedAt:new Date().toISOString(),
    };
  });

export const adminUpdatePlanFeatureFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown)=>z.object({plan_id:z.string().uuid(),flags:z.record(z.enum(FEATURE_KEYS),z.boolean())}).parse(data))
  .handler(async ({ data, context })=>{
    await assertAdmin(context);
    const { supabaseAdmin }=await import("@/integrations/supabase/client.server");
    const clean:Record<string,boolean>={};
    for(const key of FEATURE_KEYS) if(Object.prototype.hasOwnProperty.call(data.flags,key)) clean[key]=data.flags[key] as boolean;
    const {data:plan,error}=await supabaseAdmin.from("plans").update({feature_flags:clean}).eq("id",data.plan_id).select("id,code,name,feature_flags").single();
    if(error) throw new Error(`Falha ao atualizar recursos do plano: ${error.message}`);
    await supabaseAdmin.from("activity_events").insert({user_id:context.userId,kind:"admin_plan_features_updated",message:`Recursos do plano ${plan.code} atualizados.`,meta:{plan_id:plan.id,feature_flags:clean}});
    return plan;
  });
