import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { ArrowRightLeft, CheckCircle2, Wallet } from 'lucide-react';

interface TransferSnapshot {
  id: string;
  from_name?: string;
  requested_at: string;
  accepted_at?: string | null;
  transfer_reason: string;
  notes?: string | null;
  snapshot_initial_balance?: number | null;
  snapshot_sales_total?: number | null;
  snapshot_income_total?: number | null;
  snapshot_expense_total?: number | null;
  snapshot_expected_balance?: number | null;
  snapshot_cash_total?: number | null;
  snapshot_pix_total?: number | null;
  snapshot_debit_total?: number | null;
  snapshot_credit_total?: number | null;
  snapshot_bank_transfer_total?: number | null;
  snapshot_fiado_payment_total?: number | null;
  snapshot_movement_count?: number | null;
  snapshot_sale_count?: number | null;
}

interface Props {
  transfer: TransferSnapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_SNAPSHOT_FIELDS = [
  { key: 'snapshot_cash_total', label: PAYMENT_METHODS.find((item) => item.value === 'dinheiro')?.label || 'Dinheiro' },
  { key: 'snapshot_pix_total', label: PAYMENT_METHODS.find((item) => item.value === 'pix')?.label || 'PIX' },
  { key: 'snapshot_debit_total', label: PAYMENT_METHODS.find((item) => item.value === 'debito')?.label || 'Débito' },
  { key: 'snapshot_credit_total', label: PAYMENT_METHODS.find((item) => item.value === 'credito')?.label || 'Crédito' },
  { key: 'snapshot_bank_transfer_total', label: PAYMENT_METHODS.find((item) => item.value === 'transferencia')?.label || 'Transferência Bancária' },
  { key: 'snapshot_fiado_payment_total', label: 'Pagamento de fiado' },
] as const;

export default function CashTransferReceivedDialog({ transfer, open, onOpenChange }: Props) {
  if (!transfer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-lg flex-col overflow-hidden p-0 sm:max-h-[85vh] sm:w-full">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Caixa recebido com sucesso
          </DialogTitle>
          <DialogDescription>
            Confira o estado da sessão assumida antes de continuar operando.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 px-6 pb-6 pt-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <p>
                      Caixa recebido de <strong>{transfer.from_name || 'Operador anterior'}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Solicitação: {formatDateTime(transfer.requested_at)}
                    </p>
                    {transfer.accepted_at && (
                      <p className="text-xs text-muted-foreground">
                        Aceito em: {formatDateTime(transfer.accepted_at)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline" className="text-[10px]">{transfer.transfer_reason}</Badge>
                      {transfer.snapshot_sale_count != null && (
                        <Badge variant="secondary" className="text-[10px]">{transfer.snapshot_sale_count} venda(s)</Badge>
                      )}
                      {transfer.snapshot_movement_count != null && (
                        <Badge variant="secondary" className="text-[10px]">{transfer.snapshot_movement_count} movimento(s)</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {transfer.notes && <p className="text-xs text-muted-foreground">Observações: {transfer.notes}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wallet className="h-4 w-4 text-primary" />
                  Resumo do caixa recebido
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Saldo inicial</p>
                  <p className="font-semibold">{formatCurrency(Number(transfer.snapshot_initial_balance || 0))}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Vendas acumuladas</p>
                  <p className="font-semibold">{formatCurrency(Number(transfer.snapshot_sales_total || 0))}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Entradas</p>
                  <p className="font-semibold">{formatCurrency(Number(transfer.snapshot_income_total || 0))}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  <p className="font-semibold">{formatCurrency(Number(transfer.snapshot_expense_total || 0))}</p>
                </div>
                <div className="col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">Saldo esperado</p>
                  <p className="text-base font-semibold text-primary">{formatCurrency(Number(transfer.snapshot_expected_balance || 0))}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Formas de pagamento acumuladas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {PAYMENT_SNAPSHOT_FIELDS.map((item) => {
                  const value = Number(transfer[item.key] || 0);
                  return (
                    <div key={item.key} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-semibold">{formatCurrency(value)}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t px-6 py-4">
          <Button className="h-11 w-full" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}