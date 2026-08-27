export type PlanComparison = { slug:string; name:string; audience:string; highlights:string[]; cta:string };
export const planComparison:PlanComparison[]=[
 {slug:'free',name:'Grátis',audience:'Para testar o fluxo completo',highlights:['10 anúncios para experimentar','Conexão Mercado Livre','Fluxo de busca e duplicação'],cta:'Começar grátis'},
 {slug:'starter',name:'Starter',audience:'Para quem está começando a escalar',highlights:['Mais publicações por período','Créditos de IA','Saúde e oportunidades dos anúncios'],cta:'Escolher Starter'},
 {slug:'pro',name:'Pro',audience:'Para vendedores em crescimento',highlights:['Mais anúncios e IA','Radar e precificação','Relatórios e central de crescimento'],cta:'Escolher Pro'},
 {slug:'business',name:'Business',audience:'Para operação de maior volume',highlights:['Limites maiores','Ferramentas avançadas de operação','Prioridade para recursos de escala'],cta:'Escolher Business'},
];

export function contextualUpgrade(used:number,limit:number){
 const pct=limit>0?used/limit:0;
 if(pct>=1)return {level:'blocked',title:'Continue operando hoje',body:'Seu limite terminou. Faça upgrade ou compre um pacote extra.',to:'/creditos'};
 if(pct>=.85)return {level:'urgent',title:'Evite ficar sem anúncios',body:'Você está perto do limite do plano.',to:'/creditos'};
 if(pct>=.7)return {level:'suggestion',title:'Sua operação está crescendo',body:'Compare um plano maior com pacotes extras.',to:'/planos'};
 return null;
}
