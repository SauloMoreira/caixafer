import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Clock, User, Wallet } from 'lucide-react';

interface PeriodData {
  responsibleName: string;
  startTime: string;
  endTime: string | null;
  sales: number;
  income: number;
  expense: number;
  expectedBalance: number;
  saleCount: number;
  movementCount: number;
  paymentBreakdown: Record<string, number>;
}

interface Props {
  closingId: string;
  businessDate: string;
  openingBalance: number;
  currentStats: { sales: number; income: number; expense: number };
  currentSalesByMethod: Record<string, number>;
  closingCreatedAt: string;
}

export default function CashSessionPeriods({
  closingId,
  businessDate,
  openingBalance,
  currentStats,
  currentSalesByMethod,
  closingCreatedAt,
}: Props) {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeriods();
  }, [closingId]);

  const fetchPeriods = async () => {
    setLoading(true);

    // Fetch accepted transfers ordered by accepted_at
    const { data: transfers } = await supabase
      .from('cash_session_transfers')
      .select('*')
      .eq('cash_closing_id', closingId)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: true });

    if (!transfers || transfers.length === 0) {
      setPeriods([]);
      setLoading(false);
      return;
    }

    // Get all user names
    const userIds = new Set<string>();
    transfers.forEach(t => {
      userIds.add(t.from_user_id);
      userIds.add(t.to_user_id);
    });
    const { data: profiles } = await supabase.rpc('get_user_names', { _user_ids: Array.from(userIds) });
    const nameMap = Object.fromEntries((profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

    // Get current period sales by method (need to fetch all sales for the day to compute per-period)
    // For simplicity, use transfer snapshots for previous periods and subtract from totals for current
    const builtPeriods: PeriodData[] = [];
    let cumulativeSales = 0;
    let cumulativeIncome = 0;
    let cumulativeExpense = 0;
    let cumulativeSaleCount = 0;
    let cumulativeMovementCount = 0;
    let cumulativeCash = 0;
    let cumulativePix = 0;
    let cumulativeDebit = 0;
    let cumulativeCredit = 0;
    let cumulativeBankTransfer = 0;

    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      const prevSales = cumulativeSales;
      const prevIncome = cumulativeIncome;
      const prevExpense = cumulativeExpense;
      const prevSaleCount = cumulativeSaleCount;
      const prevMovementCount = cumulativeMovementCount;
      const prevCash = cumulativeCash;
      const prevPix = cumulativePix;
      const prevDebit = cumulativeDebit;
      const prevCredit = cumulativeCredit;
      const prevBankTransfer = cumulativeBankTransfer;

      // Update cumulatives from this transfer's snapshot
      cumulativeSales = Number(t.snapshot_sales_total || 0);
      cumulativeIncome = Number(t.snapshot_income_total || 0);
      cumulativeExpense = Number(t.snapshot_expense_total || 0);
      cumulativeSaleCount = Number(t.snapshot_sale_count || 0);
      cumulativeMovementCount = Number(t.snapshot_movement_count || 0);
      cumulativeCash = Number(t.snapshot_cash_total || 0);
      cumulativePix = Number(t.snapshot_pix_total || 0);
      cumulativeDebit = Number(t.snapshot_debit_total || 0);
      cumulativeCredit = Number(t.snapshot_credit_total || 0);
      cumulativeBankTransfer = Number(t.snapshot_bank_transfer_total || 0);

      const periodSales = cumulativeSales - prevSales;
      const periodIncome = cumulativeIncome - prevIncome;
      const periodExpense = cumulativeExpense - prevExpense;

      const paymentBreakdown: Record<string, number> = {};
      const periodCash = cumulativeCash - prevCash;
      const periodPix = cumulativePix - prevPix;
      const periodDebit = cumulativeDebit - prevDebit;
      const periodCredit = cumulativeCredit - prevCredit;
      const periodBankTransfer = cumulativeBankTransfer - prevBankTransfer;
      if (periodCash > 0) paymentBreakdown['dinheiro'] = periodCash;
      if (periodPix > 0) paymentBreakdown['pix'] = periodPix;
      if (periodDebit > 0) paymentBreakdown['debito'] = periodDebit;
      if (periodCredit > 0) paymentBreakdown['credito'] = periodCredit;
      if (periodBankTransfer > 0) paymentBreakdown['transferencia'] = periodBankTransfer;

      const startTime = i === 0 ? closingCreatedAt : transfers[i - 1].accepted_at || transfers[i - 1].requested_at;

      builtPeriods.push({
        responsibleName: nameMap[t.from_user_id] || 'Operador',
        startTime,
        endTime: t.accepted_at || t.requested_at,
        sales: periodSales,
        income: periodIncome,
        expense: periodExpense,
        expectedBalance: openingBalance + cumulativeSales + cumulativeIncome - cumulativeExpense,
        saleCount: cumulativeSaleCount - prevSaleCount,
        movementCount: cumulativeMovementCount - prevMovementCount,
        paymentBreakdown,
      });
    }

    // Current period (last transfer to now)
    const lastTransfer = transfers[transfers.length - 1];
    const currentSales = currentStats.sales - cumulativeSales;
    const currentIncome = currentStats.income - cumulativeIncome;
    const currentExpense = currentStats.expense - cumulativeExpense;

    const currentPaymentBreakdown: Record<string, number> = {};
    const methodKeys = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia'] as const;
    const cumulativePayments: Record<string, number> = {
      dinheiro: cumulativeCash,
      pix: cumulativePix,
      debito: cumulativeDebit,
      credito: cumulativeCredit,
      transferencia: cumulativeBankTransfer,
    };
    methodKeys.forEach(key => {
      const val = (currentSalesByMethod[key] || 0) - (cumulativePayments[key] || 0);
      if (val > 0) currentPaymentBreakdown[key] = val;
    });

    builtPeriods.push({
      responsibleName: nameMap[lastTransfer.to_user_id] || 'Operador atual',
      startTime: lastTransfer.accepted_at || lastTransfer.requested_at,
      endTime: null,
      sales: currentSales,
      income: currentIncome,
      expense: currentExpense,
      expectedBalance: openingBalance + currentStats.sales + currentStats.income - currentStats.expense,
      saleCount: 0, // We don't have exact per-period counts for current
      movementCount: 0,
      paymentBreakdown: currentPaymentBreakdown,
    });

    setPeriods(builtPeriods);
    setLoading(false);
  };

  if (loading || periods.length === 0) return null;

  const consolidatedExpected = openingBalance + currentStats.sales + currentStats.income - currentStats.expense;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        Períodos de Responsabilidade
      </div>

      {periods.map((period, idx) => {
        const isCurrentPeriod = idx === periods.length - 1;
        return (
          <Card key={idx} className={isCurrentPeriod ? 'border-primary/30 bg-primary/5' : ''}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  {period.responsibleName}
                </div>
                <Badge variant={isCurrentPeriod ? 'default' : 'secondary'} className="text-[10px]">
                  {isCurrentPeriod ? 'Período atual' : `Período ${idx + 1}`}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDateTime(period.startTime)}
                {' → '}
                {period.endTime ? formatDateTime(period.endTime) : 'agora'}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-muted-foreground">Vendas</p>
                  <p className="font-semibold text-primary">{formatCurrency(period.sales)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-muted-foreground">Entradas</p>
                  <p className="font-semibold text-emerald-600">{formatCurrency(period.income)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-muted-foreground">Saídas</p>
                  <p className="font-semibold text-destructive">{formatCurrency(period.expense)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5" title="Soma de todos os métodos de pagamento (não é dinheiro físico)">
                  <p className="text-muted-foreground">Movimento total</p>
                  <p className="font-semibold text-primary">{formatCurrency(
                    period.sales + period.income - period.expense
                  )}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Períodos refletem o movimento financeiro consolidado. O dinheiro físico esperado é apurado no fechamento.
              </p>

              {Object.keys(period.paymentBreakdown).length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {PAYMENT_METHODS.map(pm => {
                    const val = period.paymentBreakdown[pm.value];
                    if (!val) return null;
                    return (
                      <div key={pm.value} className="rounded bg-muted/40 p-1.5 text-center">
                        <p className="text-muted-foreground text-[10px]">{pm.label}</p>
                        <p className="font-medium">{formatCurrency(val)}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isCurrentPeriod && (period.saleCount > 0 || period.movementCount > 0) && (
                <p className="text-[11px] text-muted-foreground">
                  {period.saleCount} venda(s) · {period.movementCount} movimento(s)
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Consolidated total */}
      <Card className="border-primary/40 bg-primary/10">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-primary" />
            Total Consolidado do Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-background p-2.5">
              <p className="text-muted-foreground">Saldo inicial</p>
              <p className="font-semibold">{formatCurrency(openingBalance)}</p>
            </div>
            <div className="rounded-lg bg-background p-2.5">
              <p className="text-muted-foreground">Vendas totais</p>
              <p className="font-semibold text-primary">{formatCurrency(currentStats.sales)}</p>
            </div>
            <div className="rounded-lg bg-background p-2.5">
              <p className="text-muted-foreground">Entradas totais</p>
              <p className="font-semibold text-emerald-600">{formatCurrency(currentStats.income)}</p>
            </div>
            <div className="rounded-lg bg-background p-2.5">
              <p className="text-muted-foreground">Saídas totais</p>
              <p className="font-semibold text-destructive">{formatCurrency(currentStats.expense)}</p>
            </div>
            <div className="col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-muted-foreground text-xs">Movimento financeiro total do dia</p>
              <p className="text-base font-bold text-primary">{formatCurrency(currentStats.sales + currentStats.income - currentStats.expense)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground italic">
                Inclui PIX, cartões e transferências. O saldo esperado em dinheiro físico é apurado no card de Fechamento.
              </p>
            </div>
          </div>

          {Object.keys(currentSalesByMethod).length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
              {PAYMENT_METHODS.map(pm => {
                const val = currentSalesByMethod[pm.value] || 0;
                if (val === 0) return null;
                return (
                  <div key={pm.value} className="rounded bg-background p-1.5 text-center">
                    <p className="text-muted-foreground text-[10px]">{pm.label}</p>
                    <p className="font-medium">{formatCurrency(val)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
