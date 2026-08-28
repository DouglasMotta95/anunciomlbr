import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MlItem } from "./ml.functions";

const ML_API = "https://api.mercadolibre.com";
const USER_AGENT = "ANUNCIO-ML/1.0";

export type SearchMlItem = MlItem & {
  description?: string | null;
  source_kind?: "marketplace" | "catalog_offer";
  seller_id?: string | null;
  verified_item?: boolean;
};

type SearchResult = { ok: boolean; configured: true; reason: string | null; items: SearchMlItem[] };
type FetchAttempt = { response: Response | null; statuses: number[] };
type ProductSearchRow = { id?: string; name?: string; domain_id?: string; pictures?: Array<{ id?: string; url?: string; secure_url?: string }> };
type ProductDetail = ProductSearchRow & { family_name?: string; attributes?: unknown[]; main_features?: unknown[]; buy_box_winner?: CatalogOfferRow };
type CatalogOfferRow = { item_id?: string; seller_id?: string | number; price?: number; available_quantity?: number; sold_quantity?: number; category_id?: string; condition?: string; status?: string };

const sellerCache = new Map<string, { value: string | null; expires: number }>();

async function getTokens(userId: string): Promise<string[]> {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const tokens: string[] = [];
  try { const user = await getValidMlAccessToken(userId); if (user.ok && user.accessToken) tokens.push(user.accessToken); } catch {}
  try { const app = await getAppAccessToken(); if (app && !tokens.includes(app)) tokens.push(app); } catch {}
  return tokens;
}

function headers(token?: string) {
  const out: Record<string,string> = { Accept: "application/json", "User-Agent": USER_AGENT };
  if (token) out.Authorization = `Bearer ${token}`;
  return out;
}

async function mlFetch(url: string | URL, tokens: string[]): Promise<FetchAttempt> {
  const statuses: number[] = [];
  let last: Response | null = null;
  for (const token of tokens) {
    try {
      const response = await fetch(url, { headers: headers(token) });
      statuses.push(response.status); last = response;
      if (response.ok) return { response, statuses };
      if (![401,403].includes(response.status)) return { response, statuses };
    } catch {}
  }
  try {
    const response = await fetch(url, { headers: headers() });
    statuses.push(response.status); last = response;
    return { response, statuses };
  } catch { return { response: last, statuses }; }
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("http://") ? `https://${value.slice(7)}` : value;
}

function productImages(raw: ProductDetail): string[] {
  return (raw.pictures ?? []).map(p => safeUrl(p.secure_url ?? p.url)).filter((v):v is string=>!!v);
}

async function sellerNickname(sellerId: string | number | null | undefined, tokens: string[]): Promise<string | null> {
  if (sellerId == null) return null;
  const key = String(sellerId);
  const cached = sellerCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const attempt = await mlFetch(`${ML_API}/users/${encodeURIComponent(key)}`, tokens);
  if (!attempt.response?.ok) { sellerCache.set(key,{value:null,expires:Date.now()+60_000}); return null; }
  const data = await attempt.response.json().catch(()=>null) as {nickname?:unknown}|null;
  const value = typeof data?.nickname === "string" && data.nickname.trim() ? data.nickname.trim() : null;
  sellerCache.set(key,{value,expires:Date.now()+10*60_000});
  return value;
}

async function mapItemRaw(raw: Record<string,unknown>, tokens: string[], source_kind: SearchMlItem["source_kind"]="marketplace"): Promise<SearchMlItem> {
  const pictures = Array.isArray(raw["pictures"]) ? raw["pictures"] as Array<{secure_url?:string;url?:string}> : [];
  const images = pictures.map(p=>safeUrl(p.secure_url??p.url)).filter((v):v is string=>!!v);
  const sellerId = raw["seller_id"] != null ? String(raw["seller_id"]) : null;
  const sellerObj = raw["seller"] as { nickname?: unknown; id?: unknown } | undefined;
  const resolvedSellerId = sellerId ?? (sellerObj?.id != null ? String(sellerObj.id) : null);
  const seller = typeof sellerObj?.nickname === "string" ? sellerObj.nickname : await sellerNickname(resolvedSellerId, tokens);
  return {
    id: String(raw["id"] ?? raw["item_id"] ?? ""),
    title: String(raw["title"] ?? "Anúncio Mercado Livre"),
    price_cents: typeof raw["price"] === "number" ? Math.round(Number(raw["price"])*100) : null,
    thumbnail: safeUrl(raw["thumbnail"]) ?? images[0] ?? null,
    permalink: safeUrl(raw["permalink"]),
    category: typeof raw["category_id"] === "string" ? raw["category_id"] : null,
    seller: seller ?? null,
    seller_id: resolvedSellerId,
    condition: typeof raw["condition"] === "string" ? raw["condition"] : null,
    available_quantity: typeof raw["available_quantity"] === "number" ? raw["available_quantity"] : null,
    sold_quantity: typeof raw["sold_quantity"] === "number" ? raw["sold_quantity"] : null,
    status: typeof raw["status"] === "string" ? raw["status"] : null,
    images,
    attributes: Array.isArray(raw["attributes"]) ? raw["attributes"] : [],
    source_kind,
    verified_item: true,
  };
}

async function fetchItemsBatch(ids: string[], tokens: string[]): Promise<SearchMlItem[]> {
  const unique = Array.from(new Set(ids.map(id=>id.toUpperCase().replace("MLB-","MLB")).filter(id=>/^MLB\d+$/i.test(id))));
  const out: SearchMlItem[] = [];
  for (let i=0;i<unique.length;i+=20) {
    const chunk=unique.slice(i,i+20);
    const url=new URL(`${ML_API}/items`);url.searchParams.set("ids",chunk.join(","));url.searchParams.set("include_attributes","all");
    const attempt=await mlFetch(url,tokens);
    if(!attempt.response?.ok) continue;
    const rows=await attempt.response.json().catch(()=>[]) as Array<{code?:number;body?:Record<string,unknown>}>;
    const mapped=await Promise.all(rows.filter(r=>r?.code===200&&r.body).map(r=>mapItemRaw(r.body!,tokens)));
    out.push(...mapped.filter(item=>!!item.id));
  }
  return out;
}

async function fetchItem(itemId:string,tokens:string[]):Promise<{item:SearchMlItem|null;statuses:number[]}> {
  const id=itemId.toUpperCase().replace("MLB-","MLB");
  const direct=await mlFetch(`${ML_API}/items/${encodeURIComponent(id)}?include_attributes=all`,tokens);
  if(direct.response?.ok){const raw=await direct.response.json().catch(()=>null) as Record<string,unknown>|null;return {item:raw?await mapItemRaw(raw,tokens):null,statuses:direct.statuses};}
  const batch=await fetchItemsBatch([id],tokens);
  return {item:batch[0]??null,statuses:direct.statuses};
}

async function descriptionResult(itemId:string,tokens:string[]):Promise<{description:string|null;reason:string|null}> {
  const attempt=await mlFetch(`${ML_API}/items/${encodeURIComponent(itemId)}/description`,tokens);
  if(attempt.response?.ok){const data=await attempt.response.json().catch(()=>null) as {plain_text?:unknown}|null;const description=typeof data?.plain_text==="string"&&data.plain_text.trim()?data.plain_text.trim():null;return {description,reason:description?null:"Este anúncio não possui descrição disponível."};}
  if(attempt.statuses.includes(404)) return {description:null,reason:"Este anúncio não possui descrição disponível."};
  return {description:null,reason:"Não foi possível carregar a descrição agora."};
}

async function productDetail(id:string,tokens:string[]):Promise<ProductDetail|null>{const attempt=await mlFetch(`${ML_API}/products/${encodeURIComponent(id)}`,tokens);if(!attempt.response?.ok)return null;return await attempt.response.json().catch(()=>null) as ProductDetail|null;}

async function catalogOffers(product:ProductDetail,tokens:string[],limit:number):Promise<SearchMlItem[]> {
  if(!product.id)return[];
  const url=new URL(`${ML_API}/products/${encodeURIComponent(product.id)}/items`);url.searchParams.set("limit",String(Math.min(Math.max(limit,1),100)));
  const attempt=await mlFetch(url,tokens);if(!attempt.response?.ok)return[];
  const data=await attempt.response.json().catch(()=>null) as {results?:CatalogOfferRow[]}|null;
  const rows=(data?.results??[]).filter(r=>typeof r.item_id==="string"&&typeof r.price==="number").slice(0,limit);
  if(!rows.length)return[];

  // Primeiro tenta validar os IDs retornados pelo catálogo no recurso de itens.
  // Quando isso funciona, usamos título, preço, vendedor e permalink do anúncio real.
  const verified=await fetchItemsBatch(rows.map(row=>String(row.item_id)),tokens);
  const verifiedById=new Map(verified.map(item=>[item.id.toUpperCase(),item]));
  const images=productImages(product),title=String(product.name??product.family_name??"Oferta de catálogo").trim().slice(0,60);
  const sellerIds=Array.from(new Set(rows.map(r=>r.seller_id!=null?String(r.seller_id):null).filter((v):v is string=>!!v)));
  const sellerPairs=await Promise.all(sellerIds.map(async id=>[id,await sellerNickname(id,tokens)] as const));
  const sellers=new Map(sellerPairs);

  return rows.map(row=>{
    const id=String(row.item_id).toUpperCase().replace("MLB-","MLB");
    const detail=verifiedById.get(id);
    if(detail){
      return {
        ...detail,
        source_kind:"catalog_offer" as const,
        sold_quantity: detail.sold_quantity ?? (typeof row.sold_quantity==="number"?row.sold_quantity:null),
        available_quantity: detail.available_quantity ?? (typeof row.available_quantity==="number"?row.available_quantity:null),
        verified_item:true,
      };
    }

    // A API de catálogo confirma que existe uma oferta, mas se o próprio item
    // não puder ser validado não tratamos esses dados como anúncio copiável.
    return {
      id,
      title,
      price_cents:null,
      thumbnail:images[0]??null,
      permalink:null,
      category:row.category_id??null,
      seller:row.seller_id!=null?sellers.get(String(row.seller_id))??null:null,
      seller_id:row.seller_id!=null?String(row.seller_id):null,
      condition:row.condition??null,
      available_quantity:typeof row.available_quantity==="number"?row.available_quantity:null,
      sold_quantity:typeof row.sold_quantity==="number"?row.sold_quantity:null,
      status:row.status??"active",
      images,
      attributes:Array.isArray(product.attributes)?product.attributes:Array.isArray(product.main_features)?product.main_features:[],
      source_kind:"catalog_offer" as const,
      verified_item:false,
    } satisfies SearchMlItem;
  });
}

async function discoverDomains(query:string,tokens:string[]):Promise<string[]>{const url=new URL(`${ML_API}/sites/MLB/domain_discovery/search`);url.searchParams.set("q",query);url.searchParams.set("limit","3");const attempt=await mlFetch(url,tokens);if(!attempt.response?.ok)return[];const rows=await attempt.response.json().catch(()=>[]) as Array<{domain_id?:unknown}>;return rows.map(r=>typeof r.domain_id==="string"?r.domain_id:null).filter((v):v is string=>!!v);}

async function productSearchPage(query:string,tokens:string[],offset:number,domainId?:string){const url=new URL(`${ML_API}/products/search`);url.searchParams.set("status","active");url.searchParams.set("site_id","MLB");url.searchParams.set("q",query);url.searchParams.set("limit","20");url.searchParams.set("offset",String(offset));if(domainId)url.searchParams.set("domain_id",domainId);const attempt=await mlFetch(url,tokens);if(!attempt.response?.ok)return{rows:[] as ProductSearchRow[],statuses:attempt.statuses,failed:true};const data=await attempt.response.json().catch(()=>null) as {results?:ProductSearchRow[]}|null;return{rows:data?.results??[],statuses:attempt.statuses,failed:false};}

function rankBySales(items:SearchMlItem[]){return[...items].sort((a,b)=>(Number(b.verified_item!==false)-Number(a.verified_item!==false))||((b.sold_quantity??-1)-(a.sold_quantity??-1)));}

async function officialCatalogSearch(query:string,tokens:string[],limit:number):Promise<{items:SearchMlItem[];statuses:number[];failed:boolean}> {
  const desired=Math.min(Math.max(limit,1),200),productTarget=Math.min(50,Math.max(8,Math.ceil(desired/4)));
  let rows:ProductSearchRow[]=[],statuses:number[]=[],failed=true;
  for(let offset=0;offset<productTarget;offset+=20){const page=await productSearchPage(query,tokens,offset);statuses.push(...page.statuses);failed=failed&&page.failed;if(page.rows.length)rows.push(...page.rows);if(page.rows.length<20||rows.length>=productTarget)break;}

  // Domain discovery não fica mais restrito ao caso de zero resultados. Ele
  // amplia consultas como "Gemini" quando a busca direta retorna produtos sem oferta.
  if(rows.length<productTarget){
    const domains=await discoverDomains(query,tokens);
    for(const domain of domains){const page=await productSearchPage(query,tokens,0,domain);statuses.push(...page.statuses);failed=failed&&page.failed;rows.push(...page.rows);if(rows.length>=productTarget)break;}
  }

  const products=Array.from(new Map(rows.filter(r=>!!r.id).map(r=>[r.id!,r])).values()).slice(0,productTarget);
  const output:SearchMlItem[]=[];
  for(let i=0;i<products.length&&output.length<desired;i+=4){const batch=products.slice(i,i+4);const batchResults=await Promise.all(batch.map(async product=>{const detail=(await productDetail(product.id!,tokens))??product;return catalogOffers(detail,tokens,Math.min(6,desired-output.length));}));output.push(...batchResults.flat());}
  const unique=Array.from(new Map(output.map(item=>[item.id,item])).values());
  return{items:rankBySales(unique).slice(0,desired),statuses,failed:failed&&!unique.length};
}

async function legacyMarketplaceSearch(query:string,tokens:string[],limit:number):Promise<SearchMlItem[]> {
  const desired=Math.min(limit,50),url=new URL(`${ML_API}/sites/MLB/search`);url.searchParams.set("q",query);url.searchParams.set("limit",String(desired));
  const attempt=await mlFetch(url,tokens);if(!attempt.response?.ok)return[];
  const data=await attempt.response.json().catch(()=>null) as {results?:Array<Record<string,unknown>>}|null;
  const mapped=await Promise.all((data?.results??[]).slice(0,desired).map(row=>mapItemRaw(row,tokens,"marketplace")));
  return rankBySales(mapped.filter(item=>!!item.id));
}

async function sellerSearch(query:string,tokens:string[],limit:number):Promise<{items:SearchMlItem[];statuses:number[];failed:boolean}> {
  const desired=Math.min(Math.max(limit,1),200),value=query.trim().replace(/^@/,"");const statuses:number[]=[];const ids:string[]=[];
  if(/^\d+$/.test(value)){
    for(let offset=0;offset<desired;offset+=50){const url=new URL(`${ML_API}/users/${encodeURIComponent(value)}/items/search`);url.searchParams.set("status","active");url.searchParams.set("limit",String(Math.min(50,desired-offset)));url.searchParams.set("offset",String(offset));const attempt=await mlFetch(url,tokens);statuses.push(...attempt.statuses);if(!attempt.response?.ok)return{items:[],statuses,failed:true};const data=await attempt.response.json().catch(()=>null) as {results?:string[]}|null;const page=data?.results??[];ids.push(...page);if(page.length<50)break;}
  }else{
    for(let offset=0;offset<desired;offset+=50){const url=new URL(`${ML_API}/sites/MLB/search`);url.searchParams.set("nickname",value);url.searchParams.set("limit",String(Math.min(50,desired-offset)));url.searchParams.set("offset",String(offset));const attempt=await mlFetch(url,tokens);statuses.push(...attempt.statuses);if(!attempt.response?.ok)return{items:[],statuses,failed:true};const data=await attempt.response.json().catch(()=>null) as {results?:Array<Record<string,unknown>>}|null;const page=data?.results??[];if(page.length){const mapped=await Promise.all(page.map(row=>mapItemRaw(row,tokens,"marketplace")));return{items:rankBySales(mapped).slice(0,desired),statuses,failed:false};}break;}
  }
  const items=await fetchItemsBatch(ids.slice(0,desired),tokens);return{items:rankBySales(items),statuses,failed:false};
}

function userMessage(statuses:number[],empty=false){if(statuses.includes(429))return"O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente.";if(statuses.includes(401))return"Não foi possível validar a autorização do Mercado Livre agora.";if(statuses.includes(403))return empty?"A API do Mercado Livre não liberou ofertas verificáveis para este termo. Tente outro termo, link, ID ou vendedor.":"Não foi possível consultar esse tipo de anúncio agora.";return empty?"Não encontramos ofertas verificáveis para este termo.":"Não foi possível consultar o Mercado Livre agora.";}

function extractMlbId(value:string){const match=value.toUpperCase().match(/MLB-?\d+/);return match?match[0].replace("-",""):null;}
function allowedHost(host:string){const h=host.toLowerCase();return h==="meli.la"||h==="mercadolivre.com.br"||h.endsWith(".mercadolivre.com.br")||h==="mercadolibre.com"||h.endsWith(".mercadolibre.com");}
async function resolveLink(raw:string):Promise<{itemId:string|null;productId:string|null}>{let candidate=raw.trim();const embedded=candidate.match(/https?:\/\/[^\s]+/i)?.[0];candidate=embedded??candidate;if(/^(?:www\.)?(?:produto\.|lista\.)?mercadolivre\.com\.br\//i.test(candidate)||/^(?:www\.)?meli\.la\//i.test(candidate))candidate=`https://${candidate}`;let current:URL;try{current=new URL(candidate)}catch{return{itemId:null,productId:null}}if(!allowedHost(current.hostname))return{itemId:null,productId:null};for(let hop=0;hop<5;hop++){const id=extractMlbId(`${current.pathname}${current.search}`);if(id)return /\/p\/MLB-?\d+/i.test(current.pathname)?{itemId:null,productId:id}:{itemId:id,productId:null};try{const r=await fetch(current.toString(),{redirect:"manual",headers:{"User-Agent":USER_AGENT}});const location=r.headers.get("location");if(!location)break;const next=new URL(location,current);if(!allowedHost(next.hostname))break;current=next}catch{break}}const id=extractMlbId(`${current.pathname}${current.search}`);return id?{itemId:id,productId:null}:{itemId:null,productId:null};}

export const searchMercadoLivre=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({query:z.string().trim().min(1).max(120),limit:z.number().int().min(1).max(200).optional()}).parse(data)).handler(async({data,context}):Promise<SearchResult>=>{const limit=data.limit??20,tokens=await getTokens(context.userId);if(!tokens.length)return{ok:false,configured:true,reason:"Conecte sua conta do Mercado Livre para usar a busca.",items:[]};const [marketplace,catalog]=await Promise.all([legacyMarketplaceSearch(data.query,tokens,Math.min(limit,50)),officialCatalogSearch(data.query,tokens,limit)]);const merged=rankBySales(Array.from(new Map([...marketplace,...catalog.items].map(item=>[item.id,item])).values())).slice(0,limit);if(merged.length){const verified=merged.filter(item=>item.verified_item!==false).length;return{ok:true,configured:true,reason:marketplace.length?null:verified?"Resultados obtidos pelos recursos oficiais do Mercado Livre. Ofertas verificadas aparecem primeiro; o ranking usa vendas quando a API informa esse dado.":"A API retornou referências de catálogo, mas não liberou os itens completos. Essas referências ficam sem preço copiável até serem verificadas.",items:merged};}return{ok:false,configured:true,reason:userMessage(catalog.statuses,true),items:[]};});

export const searchMercadoLivreProducts=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({query:z.string().trim().min(1).max(120),limit:z.number().int().min(1).max(200).optional()}).parse(data)).handler(async({data,context}):Promise<SearchResult>=>{const tokens=await getTokens(context.userId);if(!tokens.length)return{ok:false,configured:true,reason:"Conecte sua conta do Mercado Livre para usar a busca.",items:[]};const result=await officialCatalogSearch(data.query,tokens,data.limit??20);return result.items.length?{ok:true,configured:true,reason:"Resultados obtidos pelos recursos oficiais do Mercado Livre. Ofertas verificadas aparecem primeiro.",items:result.items}:{ok:false,configured:true,reason:userMessage(result.statuses,true),items:[]};});

export const searchMercadoLivreSeller=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({query:z.string().trim().min(1).max(120),limit:z.number().int().min(1).max(200).optional()}).parse(data)).handler(async({data,context}):Promise<SearchResult>=>{const tokens=await getTokens(context.userId);if(!tokens.length)return{ok:false,configured:true,reason:"Conecte sua conta do Mercado Livre para usar a busca.",items:[]};const result=await sellerSearch(data.query,tokens,data.limit??20);return result.items.length?{ok:true,configured:true,reason:null,items:result.items}:{ok:false,configured:true,reason:userMessage(result.statuses,true),items:[]};});

export const getMercadoLivreItem=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({id:z.string().trim().regex(/^MLB-?\d+$/i,"ID inválido. Use MLB1234567890.")}).parse(data)).handler(async({data,context}):Promise<SearchResult>=>{const tokens=await getTokens(context.userId);if(!tokens.length)return{ok:false,configured:true,reason:"Conecte sua conta do Mercado Livre para consultar o anúncio.",items:[]};const result=await fetchItem(data.id,tokens);return result.item?{ok:true,configured:true,reason:null,items:[result.item]}:{ok:false,configured:true,reason:userMessage(result.statuses,false),items:[]};});

export const getMercadoLivreItemDescription=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({id:z.string().trim().regex(/^MLB-?\d+$/i)}).parse(data)).handler(async({data,context})=>{const tokens=await getTokens(context.userId);if(!tokens.length)return{ok:false as const,description:null,reason:"Conecte sua conta do Mercado Livre."};const result=await descriptionResult(data.id.toUpperCase().replace("MLB-","MLB"),tokens);return{ok:!!result.description,description:result.description,reason:result.reason};});

export const getMercadoLivreItemFromLink=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({link:z.string().trim().min(4).max(1000)}).parse(data)).handler(async({data,context}):Promise<SearchResult>=>{const tokens=await getTokens(context.userId);if(!tokens.length)return{ok:false,configured:true,reason:"Conecte sua conta do Mercado Livre para consultar o link.",items:[]};const resolved=await resolveLink(data.link);if(resolved.itemId){const result=await fetchItem(resolved.itemId,tokens);return result.item?{ok:true,configured:true,reason:null,items:[result.item]}:{ok:false,configured:true,reason:userMessage(result.statuses,false),items:[]};}if(resolved.productId){const product=await productDetail(resolved.productId,tokens);const offers=product?await catalogOffers(product,tokens,1):[];return offers[0]?{ok:true,configured:true,reason:offers[0].verified_item===false?"O produto foi identificado, mas a API não liberou o anúncio completo para copiar.":null,items:[offers[0]]}:{ok:false,configured:true,reason:"O produto foi identificado, mas não retornou uma oferta ativa.",items:[]};}return{ok:false,configured:true,reason:"Não conseguimos identificar um anúncio nesse link.",items:[]};});
