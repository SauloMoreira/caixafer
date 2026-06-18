import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PhysicalCashBreakdown, FinancialMovement, ClosingDifference } from '@/lib/cash-accounting';

interface Props {
  businessDate: string;
  operatorName?: string;
  physical: PhysicalCashBreakdown;
  financial: FinancialMovement;
  difference: ClosingDifference | null;
}

export default function CashClosingAIReview({
  businessDate,
  operatorName,
  physical,
  financial,
  difference,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-cash-closing', {
        body: {
          businessDate,
          operatorName,
          openingBalance: physical.openingBalance,
          cashIn: physical.cashIn,
          cashOut: physical.cashOut,
          expectedCash: physical.expectedCash,
          countedCash: difference?.countedCash ?? null,
          difference: difference?.difference ?? null,
          status: difference?.status ?? null,
          salesByMethod: financial.salesByMethod,
          incomeByMethod: financial.incomeByMethod,
          expenseByMethod: financial.expenseByMethod,
          fiadoPaymentsByMethod: financial.fiadoPaymentsByMethod,
          cancelledTotal: financial.cancelledTotal,
          cashSalesTotal: physical.details.salesCash,
          cashIncomeTotal: physical.details.incomeCash,
          cashExpenseTotal: physical.details.expenseCash,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis((data as any)?.analysis || 'Sem resposta da IA.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao analisar caixa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Análise da IA para Conferência do Caixa
          </span>
          <Button
            size="sm"
            variant={analysis ? 'outline' : 'default'}
            onClick={handleAnalyze}
            disabled={loading}
            className="h-8"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Analisando...
              </>
            ) : analysis ? 'Reanalisar' : 'Analisar'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!analysis && !loading && (
          <p className="text-xs text-muted-foreground">
            Gere um parecer da IA com causas possíveis da diferença, pagamentos em PIX/cartão
            que não devem compor o dinheiro físico, e ações de conferência. A IA não altera dados.
          </p>
        )}
        {loading && (
          <p className="text-xs text-muted-foreground">Consultando a IA...</p>
        )}
        {analysis && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {analysis}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
