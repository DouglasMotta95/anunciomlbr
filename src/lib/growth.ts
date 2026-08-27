export type GrowthSignal = { kind:string; title:string; body:string; to:string; severity:'info'|'success'|'warning'|'critical' };
export type GrowthInput = { connected:boolean; listings:number; used:number; limit:number; activePlan:boolean; lowStock?:number; weakListings?:number; paused?:number; revenueCents?:number; orders?:number; units?:number; aiUsed?:number };

export function onboardingProgress(i: GrowthInput) {
  const steps=[
    {key:'connect',label:'Conectar Mercado Livre',done:i.connected,to:'/integracoes'},
    {key:'import',label:'Encontrar ou importar seu primeiro anúncio',done:i.listings>0,to:'/buscar'},
    {key:'work',label:'Duplicar ou otimizar um anúncio',done:i.used>0,to:i.listings>0?'/anuncios':'/buscar'},
    {key:'plan',label:'Ativar um plano para continuar crescendo',done:i.activePlan,to:'/planos'},
  ];
  return {steps,done:steps.filter(s=>s.done).length,total:steps.length,percent:Math.round(steps.filter(s=>s.done).length/steps.length*100)};
}

export function growthSignals(i: GrowthInput): GrowthSignal[] {
  const out:GrowthSignal[]=[];
  if(!i.connected) out.push({kind:'integration',title:'Conecte sua conta',body:'Conecte o Mercado Livre para liberar dados reais, vendas e automações.',to:'/integracoes',severity:'warning'});
  const pct=i.limit>0?i.used/i.limit:0;
  if(pct>=1) out.push({kind:'quota',title:'Seu limite acabou',body:'Compre anúncios extras ou faça upgrade para continuar publicando.',to:'/creditos',severity:'critical'});
  else if(pct>=.85) out.push({kind:'quota',title:'Você já usou 85% do plano',body:`Restam ${Math.max(0,i.limit-i.used)} anúncios. Garanta capacidade antes de parar sua operação.`,to:'/creditos',severity:'warning'});
  else if(pct>=.7) out.push({kind:'quota',title:'Seu plano está sendo bem utilizado',body:'Você passou de 70% da cota. Compare upgrade e pacotes extras.',to:'/creditos',severity:'info'});
  if((i.lowStock??0)>0) out.push({kind:'stock',title:`${i.lowStock} produto(s) com estoque baixo`,body:'Evite perder venda nos anúncios que estão perto de zerar.',to:'/estoque',severity:'warning'});
  if((i.weakListings??0)>0) out.push({kind:'health',title:`${i.weakListings} anúncio(s) podem melhorar`,body:'Revise saúde, título, imagens e atributos para aumentar a qualidade.',to:'/crescimento',severity:'info'});
  if((i.paused??0)>0) out.push({kind:'paused',title:`${i.paused} anúncio(s) pausado(s)`,body:'Confira se algum campeão pode voltar a vender.',to:'/anuncios',severity:'info'});
  return out;
}

export function monthlyValue(i: GrowthInput) {
  const minutes=Math.max(0,i.used)*4 + Math.max(0,i.aiUsed??0)*3;
  return { listingsWorked:i.used, aiActions:i.aiUsed??0, orders:i.orders??0, units:i.units??0, revenueCents:i.revenueCents??0, estimatedMinutesSaved:minutes };
}

export function retentionAlternatives(reason:string){
  const common=[{key:'downgrade',label:'Ver um plano menor',to:'/planos'},{key:'extras',label:'Usar pacotes avulsos',to:'/creditos'}];
  if(reason==='price') return common;
  if(reason==='usage') return [{key:'help',label:'Ver oportunidades na minha conta',to:'/crescimento'},...common];
  return [{key:'help',label:'Revisar minha operação',to:'/crescimento'},...common];
}
