const LISTING_STATUS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  error: "Erro",
  archived: "Arquivado",
  closed: "Encerrado",
  under_review: "Em análise",
  inactive: "Inativo",
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
};

const LICENSE_STATUS: Record<string, string> = {
  active: "Ativa",
  available: "Disponível",
  expired: "Expirada",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

export function listingStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não informado";
  return LISTING_STATUS[status] ?? status;
}

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não informado";
  return ORDER_STATUS[status] ?? status;
}

export function licenseStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não informado";
  return LICENSE_STATUS[status] ?? status;
}
