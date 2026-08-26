export function openMercadoLivreOAuthStart() {
  if (typeof window === "undefined") return;

  let isFramed = true;
  try {
    isFramed = window.self !== window.top;
  } catch {
    isFramed = true;
  }

  if (!isFramed) {
    window.location.assign("/ml-start");
    return;
  }

  const popup = window.open(
    "/ml-start",
    "anuncio_ml_mercado_livre_oauth",
    "popup,width=980,height=760,noopener,noreferrer",
  );

  if (popup) {
    popup.focus();
    return;
  }

  window.location.assign("/ml-start");
}