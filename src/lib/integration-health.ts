export type IntegrationHealthInput={connected:boolean;expiresAt?:string|null;lastSyncAt?:string|null;lastError?:string|null;ordersPermission?:boolean|null};
export function integrationHealth(i:IntegrationHealthInput){
 if(!i.connected)return {status:'disconnected',label:'Mercado Livre desconectado',detail:'Conecte sua conta para liberar anúncios, vendas e sincronização.',action:'Conectar',to:'/integracoes'};
 if(i.lastError)return {status:'attention',label:'Integração precisa de atenção',detail:i.lastError,action:'Ver integração',to:'/integracoes'};
 if(i.ordersPermission===false)return {status:'permission',label:'Conta conectada — Vendas pendentes',detail:'A conexão está ativa, mas Vendas e Envios dependem da permissão funcional do aplicativo no Mercado Livre.',action:'Ver instruções',to:'/integracoes'};
 return {status:'healthy',label:'Mercado Livre conectado',detail:i.lastSyncAt?`Última sincronização: ${i.lastSyncAt}`:'Conexão ativa. A primeira sincronização ocorrerá ao usar os recursos.',action:'Gerenciar',to:'/integracoes'};
}
