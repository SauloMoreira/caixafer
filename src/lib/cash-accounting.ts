/**
 * Cash Accounting — Camada central de cálculo contábil do caixa.
 *
 * REGRA DE OURO:
 *   Saldo esperado em DINHEIRO FÍSICO =
 *     saldo_inicial + entradas_em_dinheiro - saídas_em_dinheiro
 *
 * PIX, débito, crédito, transferência, fiado em aberto, vendas canceladas
 * e valores apenas previstos NUNCA entram no dinheiro físico.
 * Eles aparecem somente no Movimento Financeiro.
 *
 * Este módulo é puro (sem efeitos colaterais, sem dependência de DB)
 * para garantir testabilidade e fonte única de verdade para tela e impressão.
 */

export type PaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'transferencia';

export const CASH_METHOD: PaymentMethod = 'dinheiro';

/** Métodos que NÃO compõem o dinheiro físico do caixa. */
export const NON_CASH_METHODS: PaymentMethod[] = [
  'pix',
  'debito',
  'credito',
  'transferencia',
];

export function isCash(method: string | null | undefined): boolean {
  return method === CASH_METHOD;
}

// ---------- Tipos mínimos esperados das tabelas ----------

export interface SaleRow {
  total_amount: number | string;
  payment_method: string;
  is_deleted?: boolean | null;
  /** Marca explícita de cancelamento, quando existir. */
  status?: string | null;
}

export interface CashEntryRow {
  entry_type: 'income' | 'expense' | string;
  amount: number | string;
  payment_method?: string | null;
  is_deleted?: boolean | null;
  source_type?: string | null;
  /** Categoria livre — usada para identificar sangrias, suprimentos etc. */
  category?: string | null;
}

export interface FiadoPaymentRow {
  amount_paid: number | string;
  payment_method: string;
  is_deleted?: boolean | null;
}

export interface FiadoChargeRow {
  amount: number | string;
  status?: string | null;
  is_deleted?: boolean | null;
}

// ---------- Utilidades ----------

const toNum = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v) || 0;

const isActive = (row: { is_deleted?: boolean | null }) =>
  !row.is_deleted;

const isCancelled = (row: { status?: string | null; is_deleted?: boolean | null }) =>
  row.is_deleted === true ||
  (typeof row.status === 'string' &&
    ['cancelled', 'cancelado', 'canceled', 'void', 'voided'].includes(
      row.status.toLowerCase()
    ));

// ---------- Bloco A: Caixa físico (dinheiro) ----------

export interface PhysicalCashBreakdown {
  openingBalance: number;
  cashIn: number;       // total de entradas em dinheiro
  cashOut: number;      // total de saídas em dinheiro
  expectedCash: number; // saldo esperado em dinheiro
  details: {
    salesCash: number;          // vendas PDV em dinheiro
    incomeCash: number;         // entradas income em dinheiro (suprimento, manual, fiado/spr em dinheiro via trigger, etc.)
    expenseCash: number;        // saídas expense em dinheiro (sangrias, despesas em dinheiro)
  };
}

/**
 * Calcula o saldo esperado em dinheiro físico.
 * Considera APENAS movimentos com payment_method='dinheiro'.
 *
 * IMPORTANTE: cash_entries com payment_method nulo são tratadas como dinheiro
 * por compatibilidade com lançamentos antigos onde o método não era exigido
 * (sangrias e suprimentos historicamente eram registrados sem método explícito).
 */
export function computePhysicalCash(params: {
  openingBalance: number | string;
  sales: SaleRow[];
  entries: CashEntryRow[];
}): PhysicalCashBreakdown {
  const opening = toNum(params.openingBalance);

  const activeSales = (params.sales || []).filter(
    (s) => isActive(s) && !isCancelled(s)
  );
  const activeEntries = (params.entries || []).filter(isActive);

  const salesCash = activeSales
    .filter((s) => isCash(s.payment_method))
    .reduce((sum, s) => sum + toNum(s.total_amount), 0);

  // Para entries: método nulo conta como dinheiro (legado).
  const entryIsCashLike = (e: CashEntryRow) =>
    e.payment_method == null || e.payment_method === '' || isCash(e.payment_method);

  const incomeCash = activeEntries
    .filter((e) => e.entry_type === 'income' && entryIsCashLike(e))
    .reduce((sum, e) => sum + toNum(e.amount), 0);

  const expenseCash = activeEntries
    .filter((e) => e.entry_type === 'expense' && entryIsCashLike(e))
    .reduce((sum, e) => sum + toNum(e.amount), 0);

  const cashIn = salesCash + incomeCash;
  const cashOut = expenseCash;
  const expectedCash = opening + cashIn - cashOut;

  return {
    openingBalance: opening,
    cashIn,
    cashOut,
    expectedCash,
    details: { salesCash, incomeCash, expenseCash },
  };
}

// ---------- Bloco B: Movimento financeiro do dia ----------

export interface FinancialMovement {
  salesByMethod: Record<string, number>;
  salesTotal: number;
  incomeByMethod: Record<string, number>;
  incomeTotal: number;
  expenseByMethod: Record<string, number>;
  expenseTotal: number;
  fiadoAcquired: number;     // fiado adquirido (NÃO compõe dinheiro)
  fiadoOpen: number;         // total em aberto/parcial
  fiadoPaymentsByMethod: Record<string, number>;
  fiadoPaymentsTotal: number;
  cancelledTotal: number;    // vendas/entradas excluídas ou canceladas
  reversedCashTotal: number; // estornos em dinheiro (saídas)
}

export function computeFinancialMovement(params: {
  sales: SaleRow[];
  entries: CashEntryRow[];
  fiadoCharges?: FiadoChargeRow[];
  fiadoPayments?: FiadoPaymentRow[];
}): FinancialMovement {
  const allSales = params.sales || [];
  const allEntries = params.entries || [];
  const charges = params.fiadoCharges || [];
  const fiadoPayments = params.fiadoPayments || [];

  const activeSales = allSales.filter((s) => isActive(s) && !isCancelled(s));

  const salesByMethod: Record<string, number> = {};
  activeSales.forEach((s) => {
    const k = s.payment_method || 'desconhecido';
    salesByMethod[k] = (salesByMethod[k] || 0) + toNum(s.total_amount);
  });
  const salesTotal = Object.values(salesByMethod).reduce((a, b) => a + b, 0);

  const activeEntries = allEntries.filter(isActive);
  const incomeByMethod: Record<string, number> = {};
  const expenseByMethod: Record<string, number> = {};
  activeEntries.forEach((e) => {
    const k = e.payment_method || 'dinheiro';
    if (e.entry_type === 'income') {
      incomeByMethod[k] = (incomeByMethod[k] || 0) + toNum(e.amount);
    } else if (e.entry_type === 'expense') {
      expenseByMethod[k] = (expenseByMethod[k] || 0) + toNum(e.amount);
    }
  });
  const incomeTotal = Object.values(incomeByMethod).reduce((a, b) => a + b, 0);
  const expenseTotal = Object.values(expenseByMethod).reduce((a, b) => a + b, 0);

  const activeCharges = charges.filter((c) => !c.is_deleted);
  const fiadoAcquired = activeCharges.reduce(
    (s, c) => s + toNum(c.amount),
    0
  );
  const fiadoOpen = activeCharges
    .filter((c) => c.status === 'open' || c.status === 'partial')
    .reduce((s, c) => s + toNum(c.amount), 0);

  const activeFiadoPayments = fiadoPayments.filter((p) => !p.is_deleted);
  const fiadoPaymentsByMethod: Record<string, number> = {};
  activeFiadoPayments.forEach((p) => {
    const k = p.payment_method || 'desconhecido';
    fiadoPaymentsByMethod[k] =
      (fiadoPaymentsByMethod[k] || 0) + toNum(p.amount_paid);
  });
  const fiadoPaymentsTotal = Object.values(fiadoPaymentsByMethod).reduce(
    (a, b) => a + b,
    0
  );

  const cancelledTotal =
    allSales
      .filter((s) => isCancelled(s))
      .reduce((s, r) => s + toNum(r.total_amount), 0) +
    allEntries
      .filter((e) => e.is_deleted)
      .reduce((s, e) => s + toNum(e.amount), 0);

  // Estornos em dinheiro: expense com categoria contendo "estorno"/"devolucao"
  const reversedCashTotal = activeEntries
    .filter(
      (e) =>
        e.entry_type === 'expense' &&
        (e.payment_method == null || isCash(e.payment_method)) &&
        typeof e.category === 'string' &&
        /estorno|devoluc|reembolso/i.test(e.category)
    )
    .reduce((s, e) => s + toNum(e.amount), 0);

  return {
    salesByMethod,
    salesTotal,
    incomeByMethod,
    incomeTotal,
    expenseByMethod,
    expenseTotal,
    fiadoAcquired,
    fiadoOpen,
    fiadoPaymentsByMethod,
    fiadoPaymentsTotal,
    cancelledTotal,
    reversedCashTotal,
  };
}

// ---------- Bloco C: Diferença do fechamento ----------

export type ClosingStatus = 'ok' | 'sobra' | 'falta';

export interface ClosingDifference {
  expectedCash: number;
  countedCash: number;
  difference: number;
  status: ClosingStatus;
  /** Tolerância de centavos para arredondamento de ponto flutuante. */
  isWithinTolerance: boolean;
}

export function computeClosingDifference(
  expectedCash: number,
  countedCash: number | string | null | undefined,
  toleranceCents = 0
): ClosingDifference {
  const counted = toNum(countedCash);
  const rawDiff = counted - expectedCash;
  // Normaliza para 2 casas para evitar -0.0000000001
  const difference = Math.round(rawDiff * 100) / 100;

  let status: ClosingStatus;
  if (Math.abs(difference) <= toleranceCents / 100) status = 'ok';
  else if (difference > 0) status = 'sobra';
  else status = 'falta';

  return {
    expectedCash,
    countedCash: counted,
    difference,
    status,
    isWithinTolerance: status === 'ok',
  };
}

// ---------- Helper único usado pelas telas ----------

export interface ClosingComputation {
  physical: PhysicalCashBreakdown;
  financial: FinancialMovement;
  difference: ClosingDifference | null;
}

export function computeClosing(params: {
  openingBalance: number | string;
  sales: SaleRow[];
  entries: CashEntryRow[];
  fiadoCharges?: FiadoChargeRow[];
  fiadoPayments?: FiadoPaymentRow[];
  countedCash?: number | string | null;
}): ClosingComputation {
  const physical = computePhysicalCash({
    openingBalance: params.openingBalance,
    sales: params.sales,
    entries: params.entries,
  });
  const financial = computeFinancialMovement(params);
  const difference =
    params.countedCash != null && params.countedCash !== ''
      ? computeClosingDifference(physical.expectedCash, params.countedCash)
      : null;
  return { physical, financial, difference };
}
