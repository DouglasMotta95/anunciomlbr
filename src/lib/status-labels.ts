const LISTING_STATUS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  error: "Erro",
  archived: "Arquivado",
  closed: "Arquivado",
  under_review: "Em análise",
  inactive: "Inativo",
  pending: "Pendente",
  pending_review: "Aguardando análise",
  rejected: "Rejeitado",
};

const ORDER_STATUS: Record<string, string> = {
  paid: "Pago",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  invalid: "Inválido",
  pending: "Pendente",
  payment_required: "Aguardando pagamento",
  partially_paid: "Parcialmente pago",
  ready_to_ship: "Pronto para envio",
  shipped: "Enviado",
  delivered: "Entregue",
  handling: "Em preparação",
};

const LICENSE_STATUS: Record<string, string> = {
  active: "Ativa",
  available: "Disponível",
  expired: "Expirada",
  suspended: "Suspensa",
  cancelled: "Cancelada",
  pending: "Pendente",
};

function humanizeUnknownStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function listingStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não informado";
  return LISTING_STATUS[status] ?? humanizeUnknownStatus(status);
}

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não informado";
  return ORDER_STATUS[status] ?? humanizeUnknownStatus(status);
}

export function licenseStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não informado";
  return LICENSE_STATUS[status] ?? humanizeUnknownStatus(status);
}
