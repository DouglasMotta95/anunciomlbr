export function openMercadoLivreOAuthStart() {
  if (typeof window === "undefined") return;

  // Fluxo único e previsível: sai do ANÚNCIO ML, autoriza no Mercado Livre
  // e retorna pelo callback oficial para /integracoes já com a conta conectada.
  // Evitamos popup/iframe porque isso pode deixar o estado visual do app
  // desatualizado ou bloquear o retorno em navegadores móveis/preview.
  window.location.assign("/ml-start");
}
