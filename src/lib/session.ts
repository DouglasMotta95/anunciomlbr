/**
 * Detecção síncrona de sessão persistida.
 * Evita o "flash de visitante" no retorno do login social / F5:
 * se existe sessão gravada, mostramos splash até a validação terminar.
 */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // storage indisponível (modo privado etc.) — tratar como visitante
  }
  return false;
}

/** Erros de OAuth retornam no hash da URL (#error=access_denied...). */
export function hasAuthErrorInUrl(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.includes("error=");
}
