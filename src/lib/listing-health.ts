export type ListingHealthInput = {
  title?: string | null;
  description?: string | null;
  images?: unknown;
  attributes?: unknown;
  price_cents?: number | null;
  stock?: number | null;
  ai_score?: number | null;
};

export type ListingHealth = {
  score: number;
  status: "excelente" | "bom" | "atencao" | "critico";
  fixes: string[];
};

export function calculateListingHealth(listing: ListingHealthInput): ListingHealth {
  let score = 0;
  const fixes: string[] = [];
  const title = (listing.title ?? "").trim();
  const description = (listing.description ?? "").trim();
  const images = Array.isArray(listing.images) ? listing.images : [];
  const attributes = Array.isArray(listing.attributes)
    ? listing.attributes
    : listing.attributes && typeof listing.attributes === "object"
      ? Object.keys(listing.attributes as Record<string, unknown>)
      : [];

  if (title.length >= 30 && title.length <= 60) score += 25;
  else if (title.length >= 15) { score += 15; fixes.push("Ajustar o título para ficar mais completo e próximo de 30–60 caracteres."); }
  else fixes.push("Criar um título mais descritivo com as principais palavras do produto.");

  if (images.length >= 5) score += 20;
  else if (images.length >= 3) { score += 14; fixes.push("Adicionar mais imagens úteis do produto."); }
  else { score += images.length * 3; fixes.push("Usar pelo menos 3 imagens e, de preferência, 5 ou mais."); }

  if (description.length >= 500) score += 20;
  else if (description.length >= 200) { score += 12; fixes.push("Completar a descrição com informações já confirmadas do produto."); }
  else fixes.push("Melhorar a descrição: ela está curta ou vazia.");

  if (attributes.length >= 5) score += 15;
  else if (attributes.length >= 2) { score += 8; fixes.push("Preencher mais atributos relevantes da categoria."); }
  else fixes.push("Preencher os atributos do anúncio.");

  if (Number(listing.price_cents ?? 0) > 0) score += 10;
  else fixes.push("Definir um preço válido.");

  if (Number(listing.stock ?? 0) > 0) score += 10;
  else fixes.push("Revisar o estoque disponível.");

  const normalized = Math.max(0, Math.min(100, score));
  return {
    score: normalized,
    status: normalized >= 85 ? "excelente" : normalized >= 70 ? "bom" : normalized >= 50 ? "atencao" : "critico",
    fixes: fixes.slice(0, 5),
  };
}
