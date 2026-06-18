/**
 * Nova análise contábil — bateria adicional de cenários ponta a ponta.
 * Foco: validar a separação Caixa Físico vs Movimento Financeiro
 * em situações reais de operação (PDV + SPR + Fiado + sangrias + estornos).
 */
import { describe, it, expect } from 'vitest';
import {
  computeClosing,
  computePhysicalCash,
  computeFinancialMovement,
  computeClosingDifference,
  type SaleRow,
  type CashEntryRow,
  type FiadoChargeRow,
  type FiadoPaymentRow,
} from '../cash-accounting';

const s = (a: number, m: string, x: Partial<SaleRow> = {}): SaleRow => ({
  total_amount: a, payment_method: m, is_deleted: false, ...x,
});
const e = (
  t: 'income' | 'expense', a: number, m: string | null = 'dinheiro',
  x: Partial<CashEntryRow> = {}
): CashEntryRow => ({ entry_type: t, amount: a, payment_method: m, is_deleted: false, ...x });

describe('Nova análise contábil — cenários reais de operação', () => {
  it('Dia completo: PDV misto + SPR + sangria + suprimento — caixa fecha exato', () => {
    const r = computeClosing({
      openingBalance: 200,
      sales: [
        s(150, 'dinheiro'),       // PDV $
        s(80, 'pix'),             // PDV PIX
        s(40, 'debito'),          // PDV débito
        s(25, 'credito'),         // PDV crédito
      ],
      entries: [
        e('income', 100, 'dinheiro', { category: 'suprimento' }),
        e('income', 50, 'dinheiro', { source_type: 'spr_fiado_payment' }), // fiado $
        e('income', 30, 'pix', { source_type: 'spr_fiado_payment' }),      // fiado PIX (NÃO conta)
        e('expense', 60, 'dinheiro', { category: 'sangria' }),
        e('expense', 20, 'dinheiro', { category: 'despesa' }),
      ],
      countedCash: 420, // 200 + 150 + 100 + 50 − 60 − 20
    });
    expect(r.physical.expectedCash).toBe(420);
    expect(r.difference?.status).toBe('ok');
    // Movimento financeiro retém TODOS os métodos:
    expect(r.financial.salesTotal).toBe(295);
    expect(r.financial.salesByMethod['pix']).toBe(80);
    expect(r.financial.incomeByMethod['pix']).toBe(30);
  });

  it('Caixa com FALTA: operador esqueceu sangria de 50 antes da contagem', () => {
    const r = computeClosing({
      openingBalance: 100,
      sales: [s(200, 'dinheiro')],
      entries: [e('expense', 50, 'dinheiro', { category: 'sangria' })],
      countedCash: 250, // deveria ter 250; mas se imaginar erro de digitação...
    });
    expect(r.physical.expectedCash).toBe(250);
    expect(r.difference?.difference).toBe(0);

    // Agora simula esquecimento: contou 200 (sem reduzir a sangria que já saiu)
    const r2 = computeClosingDifference(250, 200);
    expect(r2.status).toBe('falta');
    expect(r2.difference).toBe(-50);
  });

  it('Caixa com SOBRA: cliente pagou em dinheiro mas venda foi registrada como PIX por engano', () => {
    // Esperado conta só PIX. Mas o dinheiro físico está lá.
    const r = computeClosing({
      openingBalance: 100,
      sales: [s(80, 'pix')],
      entries: [],
      countedCash: 180,
    });
    expect(r.physical.expectedCash).toBe(100);
    expect(r.difference?.status).toBe('sobra');
    expect(r.difference?.difference).toBe(80);
    // Sinal de auditoria: sobra = total de vendas PIX → suspeita
    expect(r.financial.salesByMethod['pix']).toBe(80);
  });

  it('Fiado adquirido durante o dia NÃO afeta o esperado em dinheiro', () => {
    const charges: FiadoChargeRow[] = [
      { amount: 120, status: 'open', is_deleted: false },
      { amount: 40, status: 'partial', is_deleted: false },
    ];
    const r = computeClosing({
      openingBalance: 50,
      sales: [s(30, 'dinheiro')],
      entries: [],
      fiadoCharges: charges,
      countedCash: 80,
    });
    expect(r.physical.expectedCash).toBe(80);
    expect(r.difference?.status).toBe('ok');
    expect(r.financial.fiadoAcquired).toBe(160);
    expect(r.financial.fiadoOpen).toBe(160);
  });

  it('Estorno em dinheiro reduz o esperado e aparece como reversedCashTotal', () => {
    const r = computeClosing({
      openingBalance: 100,
      sales: [s(200, 'dinheiro')],
      entries: [e('expense', 50, 'dinheiro', { category: 'estorno PDV' })],
      countedCash: 250,
    });
    expect(r.physical.expectedCash).toBe(250);
    expect(r.financial.reversedCashTotal).toBe(50);
  });

  it('Venda em PIX cancelada não impacta nada e aparece em cancelledTotal', () => {
    const r = computeClosing({
      openingBalance: 100,
      sales: [
        s(50, 'pix', { status: 'cancelled' }),
        s(30, 'dinheiro'),
      ],
      entries: [],
      countedCash: 130,
    });
    expect(r.physical.expectedCash).toBe(130);
    expect(r.financial.salesTotal).toBe(30);
    expect(r.financial.cancelledTotal).toBe(50);
  });

  it('Consolidação por pagamento de fiado em múltiplos métodos no mesmo dia', () => {
    const fp: FiadoPaymentRow[] = [
      { amount_paid: 100, payment_method: 'dinheiro' },
      { amount_paid: 60, payment_method: 'pix' },
      { amount_paid: 40, payment_method: 'debito' },
    ];
    // Trigger handle_fiado_payment cria entries correspondentes
    const entries = fp.map((p) =>
      e('income', p.amount_paid, p.payment_method, { source_type: 'spr_fiado_payment' })
    );
    const r = computeClosing({
      openingBalance: 0,
      sales: [],
      entries,
      fiadoPayments: fp,
      countedCash: 100, // só o dinheiro entra no físico
    });
    expect(r.physical.expectedCash).toBe(100);
    expect(r.difference?.status).toBe('ok');
    expect(r.financial.fiadoPaymentsTotal).toBe(200);
    expect(r.financial.fiadoPaymentsByMethod['pix']).toBe(60);
  });

  it('Caso extremo: zero vendas, só abertura, contagem igual', () => {
    const r = computeClosing({
      openingBalance: 75.5,
      sales: [], entries: [], countedCash: 75.5,
    });
    expect(r.physical.expectedCash).toBe(75.5);
    expect(r.difference?.status).toBe('ok');
  });

  it('Robustez: strings em vez de números são convertidas', () => {
    const r = computePhysicalCash({
      openingBalance: '100' as any,
      sales: [{ total_amount: '50.50' as any, payment_method: 'dinheiro' }],
      entries: [{ entry_type: 'expense', amount: '0.50' as any, payment_method: 'dinheiro' }],
    });
    expect(r.expectedCash).toBe(150);
  });

  it('Tolerância de centavos: 0.01 de diferença com toleranceCents=1 deve ser OK', () => {
    const d = computeClosingDifference(100, 100.01, 1);
    expect(d.status).toBe('ok');
    expect(d.isWithinTolerance).toBe(true);
  });

  it('Auditoria: soma de financial.salesByMethod confere com salesTotal', () => {
    const fm = computeFinancialMovement({
      sales: [s(10, 'dinheiro'), s(20, 'pix'), s(30, 'debito'), s(40, 'credito')],
      entries: [],
    });
    const sum = Object.values(fm.salesByMethod).reduce<number>((a, b) => a + b, 0);
    expect(sum).toBe(fm.salesTotal);
    expect(fm.salesTotal).toBe(100);
  });

  it('Invariante: dinheiro físico nunca inclui métodos não-dinheiro', () => {
    const methods = ['pix', 'debito', 'credito', 'transferencia'];
    methods.forEach((m) => {
      const r = computePhysicalCash({
        openingBalance: 0,
        sales: [s(999, m)],
        entries: [e('income', 999, m)],
      });
      expect(r.expectedCash).toBe(0);
    });
  });
});
