import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardPlatformMetrics=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {count,error}=await supabaseAdmin.from("listing_quota_claims").select("listing_id",{count:"exact",head:true}).eq("user_id",context.userId);
  if(error){console.warn("dashboard platform count unavailable",error.message);return {created_by_platform:null as number|null}}
  return {created_by_platform:count??0};
});
