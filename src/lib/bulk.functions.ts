import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BulkItemStatus = "queued" | "processing" | "done" | "error";
export type BulkJobItem = { id:string; label:string; status:BulkItemStatus; message?:string|null; source?:Record<string,unknown>|null };
export type BulkJobKind = "copy" | "duplicate" | "optimize" | "pause" | "activate" | "delete";

const startSchema=z.object({kind:z.enum(["copy","duplicate","optimize","pause","activate","delete"]),items:z.array(z.object({id:z.string().min(1),label:z.string().min(1),source:z.record(z.string(),z.unknown()).optional().nullable()})).min(1).max(200)});

export const startBulkJob=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>startSchema.parse(data)).handler(async({data,context})=>{
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
 const items:BulkJobItem[]=data.items.map(item=>({id:item.id,label:item.label,status:"queued",message:null,source:item.source??null}));
 const {data:job,error}=await supabaseAdmin.from("bulk_jobs").insert({user_id:context.userId,kind:data.kind,status:"queued",total:items.length,processed:0,failed:0,payload:{items} as never}).select("id").single();
 if(error||!job)return {ok:false as const,reason:"Não foi possível criar o processamento."};
 if(data.kind==="optimize")await processBulkJob(job.id,context.userId,data.kind,items);else void processBulkJob(job.id,context.userId,data.kind,items);
 return {ok:true as const,jobId:job.id};
});

export const getBulkJob=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({jobId:z.string().uuid()}).parse(data)).handler(async({data,context})=>{const {data:job,error}=await context.supabase.from("bulk_jobs").select("*").eq("id",data.jobId).eq("user_id",context.userId).maybeSingle();if(error||!job)return {ok:false as const,job:null};return {ok:true as const,job};});

async function processBulkJob(jobId:string,userId:string,kind:BulkJobKind,items:BulkJobItem[]){
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
 await supabaseAdmin.from("bulk_jobs").update({status:"processing",updated_at:new Date().toISOString()}).eq("id",jobId);
 let processed=0,failed=0;const state=[...items];
 const persist=async()=>{await supabaseAdmin.from("bulk_jobs").update({processed,failed,payload:{items:state} as unknown as never,updated_at:new Date().toISOString()}).eq("id",jobId)};
 for(const item of state){item.status="processing";await persist();try{await runBulkItem(kind,userId,item);item.status="done";item.message=null;processed+=1}catch(error){item.status="error";item.message=error instanceof Error?error.message:"Erro inesperado";failed+=1}await persist()}
 await supabaseAdmin.from("bulk_jobs").update({status:failed>0&&processed===0?"error":"done",updated_at:new Date().toISOString()}).eq("id",jobId);
 await supabaseAdmin.from("activity_events").insert({user_id:userId,kind:`bulk_${kind}`,message:`Processamento em massa concluído: ${processed} sucesso(s), ${failed} erro(s)`,meta:{jobId,kind,processed,failed,total:state.length}});
}

function normalizeHttps(value:unknown):string|null{if(typeof value!=="string"||!value)return null;return value.startsWith("http://")?`https://${value.slice(7)}`:value}
function sourceImages(source:Record<string,unknown>):string[]{const provided=Array.isArray(source["images"])?(source["images"] as unknown[]).map(normalizeHttps).filter((v):v is string=>!!v):[];if(provided.length>0)return Array.from(new Set(provided));const thumbnail=normalizeHttps(source["thumbnail"]);return thumbnail?[thumbnail]:[]}

async function consumeBulkAiCredit(userId:string){
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
 const {data,error}=await supabaseAdmin.rpc("consume_ai_credit",{p_user_id:userId,p_amount:1});
 if(error){console.error("[AI quota bulk]",error.message);throw new Error("Não foi possível validar os créditos de IA.")}
 const quota=Array.isArray(data)?data[0]:data;
 if(!quota?.allowed)throw new Error(`Créditos de IA esgotados (${quota?.used??0}/${quota?.credit_limit??0}).`);
}

async function runBulkItem(kind:BulkJobKind,userId:string,item:BulkJobItem){
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
 if(kind==="copy"){
  const source=(item.source??{}) as Record<string,unknown>;const priceCents=typeof source["price_cents"]==="number"?source["price_cents"] as number:null;const attributes=Array.isArray(source["attributes"])?source["attributes"]:[];
  const {error}=await supabaseAdmin.from("listings").insert({user_id:userId,title:String(source["title"]??item.label),price_cents:priceCents,category:source["category"] as string??null,condition:source["condition"] as string??null,status:"draft",source_ml_id:item.id,source_permalink:source["permalink"] as string??null,images:sourceImages(source) as unknown as never,attributes:attributes as unknown as never,stock:typeof source["available_quantity"]==="number"?source["available_quantity"] as number:1});if(error)throw new Error(error.message);return;
 }
 if(kind==="duplicate"){
  const {data:listing,error:fetchError}=await supabaseAdmin.from("listings").select("title,description,price_cents,stock,sku,category,condition,images,attributes,cost_cents,fees_cents,ai_score,source_permalink").eq("id",item.id).eq("user_id",userId).maybeSingle();if(fetchError||!listing)throw new Error("Anúncio não encontrado.");
  const {cleanOptimizedTitle}=await import("./ai.server");
  const {error}=await supabaseAdmin.from("listings").insert({...listing,user_id:userId,status:"draft",title:cleanOptimizedTitle(String(listing.title??item.label))});if(error)throw new Error(error.message);return;
 }
 if(kind==="delete"){const {error}=await supabaseAdmin.from("listings").delete().eq("id",item.id).eq("user_id",userId);if(error)throw new Error(error.message);return}
 if(kind==="pause"||kind==="activate"){const {error}=await supabaseAdmin.from("listings").update({status:kind==="pause"?"paused":"active",updated_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",userId);if(error)throw new Error(error.message);return}
 if(kind==="optimize"){
  const {data:listing,error:fetchError}=await supabaseAdmin.from("listings").select("id,title,description,category,price_cents,attributes,images").eq("id",item.id).eq("user_id",userId).maybeSingle();if(fetchError||!listing)throw new Error("Anúncio não encontrado.");
  await consumeBulkAiCredit(userId);
  const {aiJson,cleanOptimizedTitle,optimizationPrompt}=await import("./ai.server");
  const imagesCount=Array.isArray(listing.images)?listing.images.length:0;
  const out=await aiJson<{title?:string;description?:string;score_after?:number}>(optimizationPrompt({title:listing.title,description:listing.description,category:listing.category,price_cents:listing.price_cents,attributes:listing.attributes,images_count:imagesCount}));if(!out.ok)throw new Error(out.reason);const parsed=out.result;if(!parsed.title||!parsed.description)throw new Error("A IA não retornou título e descrição válidos.");
  const cleanTitle=cleanOptimizedTitle(parsed.title);if(cleanTitle.length<3)throw new Error("A IA não retornou um título válido.");
  const {error:updateError}=await supabaseAdmin.from("listings").update({title:cleanTitle,description:parsed.description.trim(),ai_score:Number.isFinite(parsed.score_after)?Math.max(0,Math.min(100,Number(parsed.score_after))):null,updated_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",userId);if(updateError)throw new Error(updateError.message);
 }
}