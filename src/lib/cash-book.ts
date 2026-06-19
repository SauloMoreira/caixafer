/**
 * Cash Book (Livro de Movimento de Caixa Virtual)
 *
 * Camada pura que transforma os movimentos do dia em linhas de livro-caixa.
 * NÃO altera a lógica contábil — apenas reorganiza os dados existentes.
 *
 * Regras:
 *  - Consolidado por categoria + forma de pagamento: PDV, Biblioteca, Bazar,
 *    Doações sem documento.
 *  - Analítico (1 linha por lançamento): Mensalidades, qualquer cash_entry com
 *    document_type/document_reference, despesas, sangrias, estornos, retiradas,
 *    suprimentos, ajustes manuais, pagamentos SPR/Fiado.
 *  - DOC Nº reinicia em 01 a cada página.
 *  - Saldo Anterior + Entradas em dinheiro − Saídas em dinheiro = Saldo Atual.
 */

import { PAYMENT_METHODS } from './constants';

export type Origem =
  | 'PDV'
  | 'Biblioteca'
  | 'Bazar'
  | 'SPR'
  | 'Fiado'
  | 'Mensalidade'
  | 'Doação'
  | 'Despesa'
  | 'Sangria'
  | 'Estorno'
  | 'Ajuste Manual'
  | 'Suprimento'
  | 'Outro';

export interface CashBookRow {
  docNumber: string;        // "01", "02", ...
  origem: Origem;
  historico: string;
  entrada: number;
  saida: number;
  documentType: string;     // label visível ou ''
  documentReference: string; // ''
  paymentMethod: string;    // chave interna (dinheiro|pix|debito|credito|transferencia|''), usada para rodapé
  sourceId?: string | null; // rastreabilidade
}

export interface CashBookPage {
  date: string;             // YYYY-MM-DD
  rows: CashBookRow[];
  totalEntradas: number;
  totalSaidas: number;
  /** Saldo esperado em dinheiro físico do dia anterior. */
  saldoAnterior: number;
  /** Saldo esperado em dinheiro físico ao final do dia. */
  saldoAtual: number;
  /** Detalhamento total por forma de pagamento (entradas - saídas). */
  byMethod: Record<string, { entradas: number; saidas: number }>;
  hasMovement: boolean;
}

export interface SaleInput {
  id?: string;
  total_amount: number | string;
  payment_method: string;
  notes?: string | null;
  is_deleted?: boolean | null;
  status?: string | null;
}

export interface EntryInput {
  id?: string;
  entry_type: 'income' | 'expense' | string;
  category?: string | null;
  description?: string | null;
  amount: number | string;
  payment_method?: string | null;
  document_type?: string | null;
  document_reference?: string | null;
  source_type?: string | null;
  is_deleted?: boolean | null;
}

// ------------- Helpers -------------

const toNum = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v) || 0;

const PM_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((p) => [p.value, p.label]),
);
const pmLabel = (m: string | null | undefined) =>
  m ? PM_LABEL[m] || capitalize(m) : 'Dinheiro';

const DOC_LABEL: Record<string, string> = {
  recibo: 'Recibo',
  nota_fiscal: 'Nota Fiscal',
  id_transferencia: 'ID Transferência',
  sem_documento: 'Sem Documento',
};
const docLabel = (d: string | null | undefined) =>
  d && d !== 'sem_documento' ? DOC_LABEL[d] || capitalize(d) : '';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const isActiveSale = (s: SaleInput) =>
  !s.is_deleted &&
  !(
    typeof s.status === 'string' &&
    ['cancelled', 'cancelado', 'canceled', 'void', 'voided'].includes(
      s.status.toLowerCase(),
    )
  );

const isActiveEntry = (e: EntryInput) => !e.is_deleted;

function classifySale(s: SaleInput): 'Biblioteca' | 'Bazar' | 'PDV' {
  const n = (s.notes || '').toLowerCase();
  if (n.includes('biblioteca')) return 'Biblioteca';
  if (n.includes('bazar')) return 'Bazar';
  return 'PDV';
}

function classifyEntry(e: EntryInput): {
  origem: Origem;
  analytical: boolean;
  historicoBase: string;
} {
  const cat = (e.category || '').toLowerCase();
  const desc = e.description || '';
  const src = (e.source_type || '').toLowerCase();

  if (src === 'spr_fiado_payment') {
    return { origem: 'SPR', analytical: true, historicoBase: desc || 'Pagamento SPR' };
  }
  if (cat.includes('mensalidad')) {
    return { origem: 'Mensalidade', analytical: true, historicoBase: 'Mensalidade' };
  }
  if (cat.includes('doacao') || cat.includes('doação')) {
    return { origem: 'Doação', analytical: false, historicoBase: 'Doação' };
  }
  if (cat.includes('sangria')) {
    return { origem: 'Sangria', analytical: true, historicoBase: desc || 'Sangria de caixa' };
  }
  if (cat.includes('estorno') || cat.includes('devoluc') || cat.includes('reembolso')) {
    return { origem: 'Estorno', analytical: true, historicoBase: desc || 'Estorno' };
  }
  if (cat.includes('suprimento')) {
    return { origem: 'Suprimento', analytical: true, historicoBase: desc || 'Suprimento de caixa' };
  }
  if (cat.includes('retirada')) {
    return { origem: 'Despesa', analytical: true, historicoBase: desc || 'Retirada de caixa' };
  }
  if (cat.includes('ajuste')) {
    return { origem: 'Ajuste Manual', analytical: true, historicoBase: desc || 'Ajuste manual' };
  }
  if (cat.includes('despesa') || e.entry_type === 'expense') {
    return { origem: 'Despesa', analytical: true, historicoBase: desc || capitalize(e.category || 'Despesa') };
  }
  return { origem: 'Outro', analytical: true, historicoBase: desc || capitalize(e.category || 'Lançamento') };
}

// ------------- Page builder -------------

export interface BuildPageParams {
  date: string;
  sales: SaleInput[];
  entries: EntryInput[];
  /** Saldo esperado em dinheiro físico do dia anterior. */
  saldoAnterior: number;
}

export function buildCashBookPage(params: BuildPageParams): CashBookPage {
  const sales = (params.sales || []).filter(isActiveSale);
  const entries = (params.entries || []).filter(isActiveEntry);

  const rows: CashBookRow[] = [];

  // --- Vendas: consolidadas por origem (PDV/Biblioteca/Bazar) × método ---
  const salesAgg: Record<string, Record<string, number>> = {
    PDV: {},
    Biblioteca: {},
    Bazar: {},
  };
  sales.forEach((s) => {
    const origem = classifySale(s);
    const method = s.payment_method || 'dinheiro';
    salesAgg[origem][method] = (salesAgg[origem][method] || 0) + toNum(s.total_amount);
  });

  // Ordem fixa: PDV → Biblioteca → Bazar para previsibilidade
  (['PDV', 'Biblioteca', 'Bazar'] as const).forEach((origem) => {
    PAYMENT_METHODS.forEach((pm) => {
      const v = salesAgg[origem][pm.value];
      if (!v) return;
      rows.push({
        docNumber: '',
        origem,
        historico: `${origem} ${pm.label}`,
        entrada: v,
        saida: 0,
        documentType: '',
        documentReference: '',
        paymentMethod: pm.value,
      });
    });
  });

  // --- Doações sem documento: consolidadas por método ---
  const doacoesSemDoc: Record<string, number> = {};
  const doacoesComDoc: EntryInput[] = [];
  entries.forEach((e) => {
    const cat = (e.category || '').toLowerCase();
    if (!(cat.includes('doacao') || cat.includes('doação'))) return;
    if (e.entry_type !== 'income') return;
    if (e.document_type && e.document_type !== 'sem_documento') {
      doacoesComDoc.push(e);
    } else if (e.document_reference) {
      doacoesComDoc.push(e);
    } else {
      const k = e.payment_method || 'dinheiro';
      doacoesSemDoc[k] = (doacoesSemDoc[k] || 0) + toNum(e.amount);
    }
  });
  PAYMENT_METHODS.forEach((pm) => {
    const v = doacoesSemDoc[pm.value];
    if (!v) return;
    rows.push({
      docNumber: '',
      origem: 'Doação',
      historico: `Doação ${pm.label}`,
      entrada: v,
      saida: 0,
      documentType: '',
      documentReference: '',
      paymentMethod: pm.value,
    });
  });

  // --- Lançamentos analíticos ---
  // Inclui: mensalidades, doações com doc, despesas, sangrias, estornos,
  // retiradas, suprimentos, ajustes, SPR, e qualquer entry com doc.
  const analyticalEntries: Array<EntryInput & { _origem: Origem; _historico: string }> = [];

  entries.forEach((e) => {
    const cat = (e.category || '').toLowerCase();
    const isDoacao = cat.includes('doacao') || cat.includes('doação');
    if (isDoacao) {
      if (
        (e.document_type && e.document_type !== 'sem_documento') ||
        e.document_reference
      ) {
        analyticalEntries.push({ ...e, _origem: 'Doação', _historico: `Doação ${pmLabel(e.payment_method)}` });
      }
      return; // já tratada
    }
    const info = classifyEntry(e);
    if (info.analytical) {
      const histPrefix = info.historicoBase;
      const histSuffix = ` (${pmLabel(e.payment_method)})`;
      analyticalEntries.push({
        ...e,
        _origem: info.origem,
        _historico: `${histPrefix}${histSuffix}`,
      });
    } else {
      // não-analítico não-doação: agrega como "Outro <método>"
      // (caso raro; mantém rastreabilidade mínima)
      analyticalEntries.push({
        ...e,
        _origem: info.origem,
        _historico: `${info.historicoBase} (${pmLabel(e.payment_method)})`,
      });
    }
  });

  // Ordena analíticos pela ordem natural (id/criação preservada do input)
  analyticalEntries.forEach((e) => {
    const valor = toNum(e.amount);
    const isIncome = e.entry_type === 'income';
    rows.push({
      docNumber: '',
      origem: e._origem,
      historico: e._historico,
      entrada: isIncome ? valor : 0,
      saida: isIncome ? 0 : valor,
      documentType: docLabel(e.document_type),
      documentReference: e.document_reference || '',
      paymentMethod: e.payment_method || 'dinheiro',
      sourceId: e.id ?? null,
    });
  });

  // --- Numera DOC Nº ---
  rows.forEach((r, i) => {
    r.docNumber = String(i + 1).padStart(2, '0');
  });

  // --- Totais ---
  const totalEntradas = rows.reduce((s, r) => s + r.entrada, 0);
  const totalSaidas = rows.reduce((s, r) => s + r.saida, 0);

  const byMethod: Record<string, { entradas: number; saidas: number }> = {};
  rows.forEach((r) => {
    const k = r.paymentMethod || 'dinheiro';
    if (!byMethod[k]) byMethod[k] = { entradas: 0, saidas: 0 };
    byMethod[k].entradas += r.entrada;
    byMethod[k].saidas += r.saida;
  });

  // Saldo Atual = saldo anterior + dinheiro entradas - dinheiro saídas
  // (consistente com computePhysicalCash: usa apenas método 'dinheiro')
  const cashIn = byMethod['dinheiro']?.entradas || 0;
  const cashOut = byMethod['dinheiro']?.saidas || 0;
  const saldoAtual = params.saldoAnterior + cashIn - cashOut;

  return {
    date: params.date,
    rows,
    totalEntradas,
    totalSaidas,
    saldoAnterior: params.saldoAnterior,
    saldoAtual,
    byMethod,
    hasMovement: rows.length > 0,
  };
}

// ------------- Page numbering -------------

export interface ClosingForPage {
  business_date: string;
}

/**
 * Atribui número sequencial a cada data que teve cash_closings,
 * em ordem cronológica. Retorna mapa date → "00001".
 */
export function assignPageNumbers(closings: ClosingForPage[]): Record<string, string> {
  const uniqueDates = Array.from(new Set(closings.map((c) => c.business_date))).sort();
  const map: Record<string, string> = {};
  uniqueDates.forEach((d, i) => {
    map[d] = String(i + 1).padStart(5, '0');
  });
  return map;
}
