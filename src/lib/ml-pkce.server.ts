function base64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function deriveMlPkce(state: string, clientSecret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`anuncio-ml-pkce:${state}`));
  const verifier = base64Url(signature);
  const challengeDigest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return { verifier, challenge: base64Url(challengeDigest) };
}
