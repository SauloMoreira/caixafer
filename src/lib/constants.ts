export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string): string {
  // Date-only strings (YYYY-MM-DD) are parsed as UTC by JS, causing off-by-one in negative UTC offsets.
  // Append T12:00:00 to force local interpretation without timezone shift.
  const d = date.length === 10 ? new Date(date + 'T12:00:00') : new Date(date);
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('pt-BR');
}

export function toLocalISODate(d: Date): string {
  // Extrai YYYY-MM-DD usando o fuso LOCAL do navegador (equivalente a
  // America/Sao_Paulo para nossos operadores). Nunca usar toISOString(),
  // que sempre converte para UTC e faz o dia virar 3h antes.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toLocalISODate(new Date());
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
