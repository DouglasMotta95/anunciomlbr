import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Loader2, Save, Sparkles, Eye, Wand2, FileText, SearchCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AiPanel } from "@/components/app/AiPanel";
import { AnalysisCard, DescriptionStudio, TitleStudio } from "@/components/app/AiStudio";
import { PublishButton } from "@/components/app/PublishButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { createListingDraft, duplicateListingDraft } from "@/lib/listing-create.functions";
import { getProductImage } from "@/lib/product-image";

export const Route = createFileRoute("/_authenticated/editor/$id")({
  head: () => ({ meta: [{ title: "Editor de anúncio — ANÚNCIO ML" }, { name: "description", content: "Edite, analise e otimize seu anúncio com IA antes de publicar." }] }),
  component: EditorPage,
});

type Form = { title:string; description:string; price:string; stock:string; sku:string; category:string };
const EMPTY:Form={title:"",description:"",price:"",stock:"1",sku:"",category:""};

function EditorPage(){
  const {id}=Route.useParams();const isNew=id==="novo";const navigate=useNavigate();const queryClient=useQueryClient();
  const createDraft=useServerFn(createListingDraft);const duplicateDraft=useServerFn(duplicateListingDraft);
  const [form,setForm]=useState<Form>(EMPTY);const [score,setScore]=useState<number|null>(null);
  const listing=useQuery({queryKey:["listing",id],enabled:!isNew,queryFn:async()=>{const {data,error}=await supabase.from("listings").select("*").eq("id",id).maybeSingle();if(error)throw error;return data}});
  const productImage=getProductImage(listing.data?.images);
  const listingImages=Array.isArray(listing.data?.images)?listing.data.images:[];
  const listingAttributes=listing.data?.attributes??[];
  useEffect(()=>{const row=listing.data;if(!row)return;setForm({title:row.title??"",description:row.description??"",price:row.price_cents!=null?(row.price_cents/100).toFixed(2):"",stock:String(row.stock??0),sku:row.sku??"",category:row.category??""});setScore(row.ai_score??null)},[listing.data]);
  const set=(key:keyof Form)=>(value:string)=>setForm(prev=>({...prev,[key]:value}));
  function parsedValues(){const price=form.price?Math.round(Number(form.price.replace(",","."))*100):null;const stock=Number(form.stock);if(form.title.trim().length<3)throw new Error("Informe um título válido.");if(form.title.trim().length>60)throw new Error("O título deve ter no máximo 60 caracteres.");if(price!==null&&(!Number.isFinite(price)||price<=0))throw new Error("Informe um preço válido maior que zero.");if(!Number.isFinite(stock)||stock<0||!Number.isInteger(stock))throw new Error("Informe um estoque válido.");return{price,stock}}
  const save=useMutation({mutationFn:async()=>{const {price,stock}=parsedValues();const patch={title:form.title.trim(),description:form.description||null,price_cents:price,stock,sku:form.sku||null,category:form.category||null,ai_score:score};if(isNew){const result=await createDraft({data:{title:patch.title,description:patch.description,price_cents:patch.price_cents,stock:patch.stock,sku:patch.sku,category:patch.category}});if(!result.ok)throw new Error(result.reason);return result.id}const {error}=await supabase.from("listings").update(patch).eq("id",id);if(error)throw error;return id},onSuccess:async savedId=>{await queryClient.invalidateQueries({queryKey:["listings"]});toast.success("Anúncio salvo");if(isNew)navigate({to:"/editor/$id",params:{id:savedId}})},onError:e=>toast.error(e instanceof Error?e.message:"Não foi possível salvar.")});
  const duplicate=useMutation({mutationFn:async()=>{if(!listing.data)throw new Error("Carregue o anúncio antes de duplicar.");const result=await duplicateDraft({data:{listing_id:id}});if(!result.ok)throw new Error(result.reason);return result.id},onSuccess:async newId=>{await queryClient.invalidateQueries({queryKey:["listings"]});toast.success("Cópia criada com imagens e atributos");navigate({to:"/editor/$id",params:{id:newId}})},onError:e=>toast.error(e instanceof Error?e.message:"Não foi possível criar a cópia.")});
  const ctx={title:form.title,description:form.description,category:form.category};
  const analysisCtx={...ctx,priceCents:form.price?Math.round(Number(form.price.replace(",","."))*100):null,imagesCount:listingImages.length,attributes:listingAttributes};
  return <AppShell title={isNew?"Novo anúncio":"Editor do anúncio"} description="Revise o anúncio, use a IA quando precisar e publique somente quando estiver pronto.">
    <div className="sticky top-[82px] z-10 mb-5 flex flex-wrap items-center gap-2 rounded-2xl border bg-background/95 p-3 shadow-sm backdrop-blur">
      <Button variant="ghost" size="sm" onClick={()=>navigate({to:"/anuncios"})}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar</Button>
      {!isNew&&<Button variant="outline" size="sm" onClick={()=>duplicate.mutate()} disabled={duplicate.isPending||listing.isLoading}><Copy className="mr-2 h-4 w-4"/>Criar cópia</Button>}
      <div className="ml-auto flex flex-wrap gap-2">{!isNew&&<PublishButton listingId={id} disabled={save.isPending}/>}<Button size="sm" onClick={()=>save.mutate()} disabled={save.isPending}>{save.isPending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}Salvar alterações</Button></div>
    </div>
    {listing.isLoading&&!isNew?<div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Carregando anúncio...</div>:<div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
      <div className="space-y-5">
        <Card className="overflow-hidden"><CardHeader className="border-b bg-muted/20"><CardTitle className="text-lg">Dados do anúncio</CardTitle><p className="text-sm text-muted-foreground">Mantenha as informações principais organizadas antes de publicar.</p></CardHeader><CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor="title">Título</Label><span className="text-xs text-muted-foreground">{form.title.length}/60</span></div><Input id="title" className="h-11 text-base font-medium" value={form.title} onChange={e=>set("title")(e.target.value)} maxLength={60}/></div>
          <div className="space-y-1.5"><Label htmlFor="description">Descrição</Label><Textarea id="description" rows={12} className="leading-relaxed" value={form.description} onChange={e=>set("description")(e.target.value)} placeholder="Descreva o produto de forma clara e objetiva."/></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Preço (R$)" id="price" value={form.price} onChange={set("price")} inputMode="decimal"/><Field label="Estoque" id="stock" value={form.stock} onChange={set("stock")} inputMode="numeric"/><Field label="SKU" id="sku" value={form.sku} onChange={set("sku")}/><Field label="Categoria" id="category" value={form.category} onChange={set("category")}/></div>
        </CardContent></Card>
        <Card className="border-primary/25"><CardHeader className="border-b bg-primary/[.04]"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Sparkles className="h-5 w-5 text-primary"/></div><div><CardTitle className="text-lg">Assistente ANÚNCIO AI</CardTitle><p className="text-sm text-muted-foreground">Uma central única para melhorar o anúncio sem poluir a tela.</p></div></div></CardHeader><CardContent className="pt-5"><Tabs defaultValue="otimizar"><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4"><TabsTrigger value="otimizar"><Wand2 className="mr-1.5 h-4 w-4"/>Otimizar</TabsTrigger><TabsTrigger value="titulos">Títulos</TabsTrigger><TabsTrigger value="descricao"><FileText className="mr-1.5 h-4 w-4"/>Descrição</TabsTrigger><TabsTrigger value="analise"><SearchCheck className="mr-1.5 h-4 w-4"/>Análise</TabsTrigger></TabsList><TabsContent value="otimizar" className="pt-3"><AiPanel title={form.title||"Anúncio sem título"} description={form.description} category={form.category} priceCents={analysisCtx.priceCents} attributes={listingAttributes} imagesCount={listingImages.length} currentScore={score} onApply={result=>{setForm(prev=>({...prev,title:result.title,description:result.description}));setScore(result.score_after);toast.success("Sugestões aplicadas",{description:"Revise e salve para confirmar."})}}/></TabsContent><TabsContent value="titulos" className="pt-3"><TitleStudio ctx={ctx} onPick={picked=>setForm(prev=>({...prev,title:picked.replace(/\s*\((?:copy|cópia)\)\s*$/i,"").slice(0,60)}))}/></TabsContent><TabsContent value="descricao" className="pt-3"><DescriptionStudio ctx={ctx} onApply={text=>setForm(prev=>({...prev,description:text}))}/></TabsContent><TabsContent value="analise" className="pt-3"><AnalysisCard ctx={analysisCtx}/></TabsContent></Tabs></CardContent></Card>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-[164px] xl:self-start"><Card className="overflow-hidden"><CardHeader className="border-b bg-muted/20"><CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4 text-primary"/>Pré-visualização</CardTitle></CardHeader><CardContent className="p-0"><div className="bg-white p-5 text-zinc-900">{productImage?<img src={productImage} alt={form.title||"Imagem do produto"} className="mx-auto aspect-square w-full max-w-[360px] object-contain"/>:<div className="flex aspect-square items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500">Sem imagem do produto</div>}<div className="mt-5 border-t border-zinc-200 pt-5"><p className="text-[15px] leading-snug text-zinc-700">{form.title||"Título do anúncio"}</p><p className="mt-2 text-3xl font-normal tracking-tight">{form.price?`R$ ${form.price}`:"R$ --"}</p><p className="mt-1 text-sm text-emerald-700">Estoque disponível: {form.stock||0}</p></div></div></CardContent></Card><Card><CardContent className="pt-6"><div className="flex flex-wrap gap-2">{form.category&&<Badge variant="outline">{form.category}</Badge>}{score!=null&&<Badge>Score IA {score}/100</Badge>}<Badge variant="secondary">{isNew?"Rascunho novo":listing.data?.status==="active"?"Ativo":listing.data?.status==="paused"?"Pausado":"Rascunho"}</Badge></div><p className="mt-4 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{form.description||"A descrição do anúncio aparecerá aqui."}</p></CardContent></Card></aside>
    </div>}
  </AppShell>
}
function Field({label,id,value,onChange,inputMode}:{label:string;id:string;value:string;onChange:(v:string)=>void;inputMode?:"decimal"|"numeric"}){return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} className="h-10" value={value} onChange={e=>onChange(e.target.value)} inputMode={inputMode}/></div>}