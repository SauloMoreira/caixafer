import { describe, it, expect } from 'vitest';
import {
  computePhysicalCash,
  computeFinancialMovement,
  computeClosingDifference,
  computeClosing,
  type SaleRow,
  type CashEntryRow,
  type FiadoChargeRow,
  type FiadoPaymentRow,
} from '../cash-accounting';

// Helpers
const sale = (amount: number, method: string, extra: Partial<SaleRow> = {}): SaleRow => ({
  total_amount: amount,
  payment_method: method,
  is_deleted: false,
  ...extra,
});
const entry = (
  type: 'income' | 'expense',
  amount: number,
  method: string | null = 'dinheiro',
  extra: Partial<CashEntryRow> = {}
): CashEntryRow => ({
  entry_type: type,
  amount,
  payment_method: method,
  is_deleted: false,
  ...extra,
});

describe('Cash Accounting — Cenários contábeis obrigatórios', () => {
  it('Cenário 1: Caixa sem diferença (100 + 50 PDV$ + 20 Fiado$ − 30 sangria = 140)', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [sale(50, 'dinheiro')],
      entries: [
        // pagamento de fiado em dinheiro (gerado pelo trigger handle_fiado_payment)
        entry('income', 20, 'dinheiro', { source_type: 'spr_fiado_payment' }),
        // sangria
        entry('expense', 30, 'dinheiro', { category: 'sangria' }),
      ],
    });
    expect(result.expectedCash).toBe(140);

    const diff = computeClosingDifference(result.expectedCash, 140);
    expect(diff.difference).toBe(0);
    expect(diff.status).toBe('ok');
  });

  it('Cenário 2: PIX NÃO entra no dinheiro físico (esperado = 100)', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [sale(50, 'pix')],
      entries: [],
    });
    expect(result.expectedCash).toBe(100);
    expect(result.details.salesCash).toBe(0);
  });

  it('Cenário 3: Cartão (crédito/débito) NÃO entra no dinheiro físico (esperado = 100)', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [sale(80, 'credito'), sale(40, 'debito')],
      entries: [],
    });
    expect(result.expectedCash).toBe(100);
  });

  it('Cenário 4: Fiado adquirido NÃO entra como dinheiro (esperado = 100)', () => {
    // Fiado adquirido NÃO gera venda nem cash_entry — não deve afetar dinheiro.
    const charges: FiadoChargeRow[] = [{ amount: 60, status: 'open', is_deleted: false }];
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [],
      entries: [],
    });
    expect(result.expectedCash).toBe(100);

    // E aparece como informação no movimento financeiro:
    const fm = computeFinancialMovement({
      sales: [],
      entries: [],
      fiadoCharges: charges,
    });
    expect(fm.fiadoAcquired).toBe(60);
    expect(fm.fiadoOpen).toBe(60);
  });

  it('Cenário 5: Pagamento de fiado em dinheiro entra no caixa (esperado = 160)', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [],
      entries: [
        entry('income', 60, 'dinheiro', { source_type: 'spr_fiado_payment' }),
      ],
    });
    expect(result.expectedCash).toBe(160);
  });

  it('Cenário 6: Sangria reduz o esperado (100 + 100 venda$ − 50 sangria = 150)', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [sale(100, 'dinheiro')],
      entries: [entry('expense', 50, 'dinheiro', { category: 'sangria' })],
    });
    expect(result.expectedCash).toBe(150);
  });
});

describe('Cash Accounting — Regras complementares', () => {
  it('Pagamento de fiado via PIX NÃO infla o dinheiro físico (mesmo com entry income gerado pelo trigger)', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [],
      entries: [
        // Trigger atual cria income com o método original (pix). Não deve entrar no dinheiro.
        entry('income', 200, 'pix', { source_type: 'spr_fiado_payment' }),
      ],
    });
    expect(result.expectedCash).toBe(100);
  });

  it('cash_entries com payment_method nulo são tratadas como dinheiro (legado)', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [],
      entries: [
        entry('expense', 30, null, { category: 'sangria' }), // sangria antiga sem método
      ],
    });
    expect(result.expectedCash).toBe(70);
  });

  it('Vendas excluídas (is_deleted) não entram em nada', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [sale(50, 'dinheiro', { is_deleted: true })],
      entries: [],
    });
    expect(result.expectedCash).toBe(100);
  });

  it('Vendas canceladas (status=cancelled) não entram no dinheiro', () => {
    const result = computePhysicalCash({
      openingBalance: 100,
      sales: [sale(50, 'dinheiro', { status: 'cancelled' })],
      entries: [],
    });
    expect(result.expectedCash).toBe(100);
  });

  it('Movimento financeiro separa por método e calcula totais', () => {
    const fm = computeFinancialMovement({
      sales: [
        sale(100, 'dinheiro'),
        sale(50, 'pix'),
        sale(30, 'debito'),
        sale(20, 'credito'),
        sale(10, 'dinheiro', { is_deleted: true }), // cancelada
      ],
      entries: [
        entry('income', 25, 'dinheiro'),
        entry('expense', 15, 'dinheiro', { category: 'sangria' }),
      ],
    });
    expect(fm.salesTotal).toBe(200);
    expect(fm.salesByMethod['dinheiro']).toBe(100);
    expect(fm.salesByMethod['pix']).toBe(50);
    expect(fm.cancelledTotal).toBe(10);
    expect(fm.incomeTotal).toBe(25);
    expect(fm.expenseTotal).toBe(15);
  });

  it('Diferença: zero = ok, positivo = sobra, negativo = falta', () => {
    expect(computeClosingDifference(100, 100).status).toBe('ok');
    expect(computeClosingDifference(100, 120).status).toBe('sobra');
    expect(computeClosingDifference(100, 120).difference).toBe(20);
    expect(computeClosingDifference(100, 80).status).toBe('falta');
    expect(computeClosingDifference(100, 80).difference).toBe(-20);
  });

  it('Diferença lida com ponto flutuante (arredonda para 2 casas)', () => {
    const r = computeClosingDifference(100.1 + 0.2, 100.3);
    expect(r.difference).toBe(0);
    expect(r.status).toBe('ok');
  });

  it('computeClosing integra tudo numa chamada só', () => {
    const c = computeClosing({
      openingBalance: 100,
      sales: [sale(50, 'dinheiro'), sale(80, 'pix')],
      entries: [entry('expense', 30, 'dinheiro', { category: 'sangria' })],
      countedCash: 120,
    });
    expect(c.physical.expectedCash).toBe(120);
    expect(c.financial.salesByMethod['pix']).toBe(80);
    expect(c.difference?.status).toBe('ok');
  });

  it('Pagamentos de fiado consolidados aparecem por método sem duplicar', () => {
    const fp: FiadoPaymentRow[] = [
      { amount_paid: 30, payment_method: 'dinheiro' },
      { amount_paid: 20, payment_method: 'pix' },
    ];
    const fm = computeFinancialMovement({ sales: [], entries: [], fiadoPayments: fp });
    expect(fm.fiadoPaymentsTotal).toBe(50);
    expect(fm.fiadoPaymentsByMethod['dinheiro']).toBe(30);
    expect(fm.fiadoPaymentsByMethod['pix']).toBe(20);
  });
});
