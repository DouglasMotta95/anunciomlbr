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
    // As tabelas/colunas abaixo foram adicionadas por migrations recentes e ainda não
    // constam no arquivo gerado de tipos do Supabase. O cast fica isolado no servidor.
    const db = supabaseAdmin as any;
    const [profiles, connections, rules, keywordCount, pricingCount, abuse, activity, plans, creations, published, competitors] = await Promise.all([
      db.from("profiles").select("id,email,full_name,last_seen_at"),
      db.from("ml_connections").select("user_id,ml_user_id,nickname,connected,listings_count,last_sync_at,created_at,updated_at").order("updated_at",{ascending:false}).limit(200),
      db.from("automation_rules").select("id,user_id,name,signal,threshold,action,enabled,created_at,updated_at").order("updated_at",{ascending:false}).limit(200),
      db.from("keyword_tracks").select("id",{count:"exact",head:true}),
      db.from("pricing_audit_log").select("id",{count:"exact",head:true}),
      db.from("registration_abuse_events").select("id,created_at,status,user_id,email_hash,ip_hash,device_hash,user_agent_hash").order("created_at",{ascending:false}).limit(100),
      db.from("activity_events").select("id,user_id,kind,message,created_at").order("created_at",{ascending:false}).limit(400),
      db.from("plans").select("id,code,name,kind,active,listing_limit,ai_credits,feature_flags").order("sort_order",{ascending:true}),
      db.from("listing_quota_claims").select("listing_id",{count:"exact",head:true}),
      db.from("listings").select("id",{count:"exact",head:true}).not("published_at","is",null),
      db.from("competitor_watch").select("id",{count:"exact",head:true}),
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

export const adminReleaseMlConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    user_id: z.string().uuid(),
    ml_user_id: z.string().trim().min(1).max(80).nullable().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: connection, error: lookupError } = await db
      .from("ml_connections")
      .select("user_id,ml_user_id,nickname,connected")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (lookupError) throw new Error(`Falha ao localizar vínculo Mercado Livre: ${lookupError.message}`);
    if (!connection) throw new Error("Vínculo Mercado Livre não encontrado para esse usuário.");
    if (data.ml_user_id && connection.ml_user_id && String(connection.ml_user_id) !== data.ml_user_id) {
      throw new Error("A conta Mercado Livre mudou desde que o painel foi carregado. Atualize a tela antes de tentar novamente.");
    }

    const now = new Date().toISOString();
    const { error: disconnectError } = await db
      .from("ml_connections")
      .update({ connected: false, updated_at: now })
      .eq("user_id", data.user_id);
    if (disconnectError) throw new Error(`Falha ao liberar vínculo Mercado Livre: ${disconnectError.message}`);

    // O token antigo precisa ser removido para impedir que o login antigo continue
    // operando a conta depois de o administrador liberar o vínculo. Anúncios locais
    // e histórico ficam preservados.
    const { error: tokenError } = await db.from("ml_tokens").delete().eq("user_id", data.user_id);
    if (tokenError) {
      // Se o token não puder ser removido, restauramos o estado conectado para não
      // deixar uma conta "liberada" ainda utilizável pelo usuário anterior.
      await db.from("ml_connections").update({ connected: true, updated_at: new Date().toISOString() }).eq("user_id", data.user_id);
      throw new Error(`Falha ao revogar token Mercado Livre: ${tokenError.message}`);
    }

    // Estados OAuth pendentes do usuário antigo deixam de ter utilidade após reset.
    await db.from("ml_oauth_states").delete().eq("user_id", data.user_id);

    await db.from("activity_events").insert({
      user_id: context.userId,
      kind: "admin_ml_binding_released",
      message: `Vínculo Mercado Livre ${connection.nickname || connection.ml_user_id || "sem identificação"} liberado pelo administrador.`,
      meta: {
        target_user_id: data.user_id,
        ml_user_id: connection.ml_user_id ?? null,
        nickname: connection.nickname ?? null,
        was_connected: Boolean(connection.connected),
      },
    });

    return {
      ok: true,
      user_id: data.user_id,
      ml_user_id: connection.ml_user_id ?? null,
      nickname: connection.nickname ?? null,
    };
  });

export const adminUpdatePlanFeatureFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown)=>z.object({plan_id:z.string().uuid(),flags:z.record(z.enum(FEATURE_KEYS),z.boolean())}).parse(data))
  .handler(async ({ data, context })=>{
    await assertAdmin(context);
    const { supabaseAdmin }=await import("@/integrations/supabase/client.server");
    const db=supabaseAdmin as any;
    const clean:Record<string,boolean>={};
    for(const key of FEATURE_KEYS) if(Object.prototype.hasOwnProperty.call(data.flags,key)) clean[key]=data.flags[key] as boolean;
    const {data:plan,error}=await db.from("plans").update({feature_flags:clean}).eq("id",data.plan_id).select("id,code,name,feature_flags").single();
    if(error) throw new Error(`Falha ao atualizar recursos do plano: ${error.message}`);
    await db.from("activity_events").insert({user_id:context.userId,kind:"admin_plan_features_updated",message:`Recursos do plano ${plan.code} atualizados.`,meta:{plan_id:plan.id,feature_flags:clean}});
    return plan;
  });
