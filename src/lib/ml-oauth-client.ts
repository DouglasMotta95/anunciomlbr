export function openMercadoLivreOAuthStart() {
  if (typeof window === "undefined") return;

  // Sempre inicia o OAuth na mesma janela. Isso evita perda de sessão/estado
  // em previews, popups bloqueados e retornos que não atualizam a conta conectada.
  // Fluxo esperado: ANÚNCIO ML -> Mercado Livre -> callback -> /integracoes.
  window.location.assign("/ml-start");
}
