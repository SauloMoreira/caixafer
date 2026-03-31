export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('pt-BR');
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'transferencia', label: 'Transferência Bancária' },
] as const;

export const DOCUMENT_TYPES = [
  { value: 'recibo', label: 'Recibo' },
  { value: 'nota_fiscal', label: 'Nota Fiscal' },
  { value: 'id_transferencia', label: 'ID de Transferência' },
  { value: 'sem_documento', label: 'Sem Documento' },
] as const;

export const ENTRY_CATEGORIES = [
  { value: 'reposicao', label: 'Reposição' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'compra', label: 'Compra' },
  { value: 'despesa_extra', label: 'Despesa extra' },
  { value: 'outro', label: 'Outro' },
] as const;
