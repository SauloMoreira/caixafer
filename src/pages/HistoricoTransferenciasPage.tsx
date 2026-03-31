import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, CalendarRange, Search } from 'lucide-react';

type TransferRow = {
  id: string;
  session_id?: string | null;
  cash_closing_id: string;
  business_date: string;
  from_user_id: string;
  to_user_id: string;
  requested_by?: string | null;
  requested_at: string;
  accepted_by?: string | null;
  accepted_at?: string | null;
  transfer_reason: string;
  notes?: string | null;
  status: string;
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
  from_name?: string;
  to_name?: string;
  requested_by_name?: string;
  accepted_by_name?: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  accepted: 'default',
  pending: 'outline',
  rejected: 'destructive',
  cancelled: 'secondary',
};

const PAYMENT_SNAPSHOT_FIELDS = [
  { key: 'snapshot_cash_total', label: PAYMENT_METHODS.find((item) => item.value === 'dinheiro')?.label || 'Dinheiro' },
  { key: 'snapshot_pix_total', label: PAYMENT_METHODS.find((item) => item.value === 'pix')?.label || 'PIX' },
  { key: 'snapshot_debit_total', label: PAYMENT_METHODS.find((item) => item.value === 'debito')?.label || 'Débito' },
  { key: 'snapshot_credit_total', label: PAYMENT_METHODS.find((item) => item.value === 'credito')?.label || 'Crédito' },
  { key: 'snapshot_bank_transfer_total', label: PAYMENT_METHODS.find((item) => item.value === 'transferencia')?.label || 'Transferência Bancária' },
  { key: 'snapshot_fiado_payment_total', label: 'Pagamento de fiado' },
] as const;

const SNAPSHOT_FIELDS = [
  'snapshot_initial_balance',
  'snapshot_sales_total',
  'snapshot_income_total',
  'snapshot_expense_total',
  'snapshot_expected_balance',
  'snapshot_cash_total',
  'snapshot_pix_total',
  'snapshot_debit_total',
  'snapshot_credit_total',
  'snapshot_bank_transfer_total',
  'snapshot_fiado_payment_total',
  'snapshot_movement_count',
  'snapshot_sale_count',
] as const;

export default function HistoricoTransferenciasPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [businessDate, setBusinessDate] = useState('');
  const [status, setStatus] = useState('all');
  const [sessionSearch, setSessionSearch] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRow | null>(null);

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['cash-transfer-history-admin'],
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_session_transfers')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const transferRows = (data || []) as TransferRow[];
      const userIds = Array.from(new Set(
        transferRows.flatMap((transfer) => [transfer.from_user_id, transfer.to_user_id, transfer.requested_by, transfer.accepted_by].filter(Boolean) as string[])
      ));

      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: names } = await supabase.rpc('get_user_names', { _user_ids: userIds });
        nameMap = Object.fromEntries((names || []).map((item: { id: string; full_name: string }) => [item.id, item.full_name]));
      }

      return transferRows.map((transfer) => ({
        ...transfer,
        session_id: transfer.session_id || transfer.cash_closing_id,
        from_name: nameMap[transfer.from_user_id] || 'Desconhecido',
        to_name: nameMap[transfer.to_user_id] || 'Desconhecido',
        requested_by_name: transfer.requested_by ? (nameMap[transfer.requested_by] || 'Desconhecido') : '—',
        accepted_by_name: transfer.accepted_by ? (nameMap[transfer.accepted_by] || 'Desconhecido') : '—',
      }));
    },
  });

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      if (status !== 'all' && transfer.status !== status) return false;
      if (dateFrom && transfer.requested_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && transfer.requested_at.slice(0, 10) > dateTo) return false;
      if (businessDate && transfer.business_date !== businessDate) return false;
      if (sessionSearch) {
        const search = sessionSearch.toLowerCase();
        const sessionId = (transfer.session_id || transfer.cash_closing_id || '').toLowerCase();
        if (!sessionId.includes(search)) return false;
      }
      if (personSearch) {
        const search = personSearch.toLowerCase();
        const haystack = [transfer.from_name, transfer.to_name, transfer.requested_by_name, transfer.accepted_by_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [businessDate, dateFrom, dateTo, personSearch, sessionSearch, status, transfers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ArrowRightLeft className="h-6 w-6 text-primary" />
        <div>
          <h1 className="page-title">Histórico de Transferências de Caixa</h1>
          <p className="text-sm text-muted-foreground">Consulte snapshots completos e a trilha operacional de cada transferência.</p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Data da solicitação</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data operacional</Label>
            <Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="accepted">Aceita</SelectItem>
                <SelectItem value="rejected">Recusada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Session ID</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={sessionSearch} onChange={(e) => setSessionSearch(e.target.value)} className="pl-9" placeholder="Buscar sessão" />
            </div>
          </div>
          <div className="space-y-1.5 xl:col-span-5">
            <Label>Operadores</Label>
            <Input value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Buscar por quem transferiu ou recebeu" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Transferências encontradas</p>
            <p className="text-2xl font-semibold">{filteredTransfers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aceitas</p>
            <p className="text-2xl font-semibold text-primary">{filteredTransfers.filter((item) => item.status === 'accepted').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-semibold">{filteredTransfers.filter((item) => item.status === 'pending').length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando histórico...</CardContent></Card>
        ) : filteredTransfers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma transferência encontrada com os filtros atuais.
            </CardContent>
          </Card>
        ) : (
          filteredTransfers.map((transfer) => (
            <Card key={transfer.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setSelectedTransfer(transfer)}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{transfer.from_name} → {transfer.to_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(transfer.requested_at)} • data operacional {formatDate(transfer.business_date)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[transfer.status] || 'outline'} className="text-[10px]">{STATUS_LABELS[transfer.status] || transfer.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Sessão</p>
                    <p className="truncate font-medium">{transfer.session_id || transfer.cash_closing_id}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Motivo</p>
                    <p className="font-medium">{transfer.transfer_reason}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Saldo esperado</p>
                     <p className="font-medium">{formatSnapshotCurrency(transfer.snapshot_expected_balance)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Aceita em</p>
                    <p className="font-medium">{transfer.accepted_at ? formatDateTime(transfer.accepted_at) : '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selectedTransfer} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
        <DialogContent className="h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-3xl overflow-hidden p-0 md:h-[min(90dvh,800px)] md:w-full">
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="shrink-0 border-b px-4 pt-4 pb-3 pr-12 sm:px-6 sm:pt-6 sm:pb-4 sm:pr-14">
              <DialogTitle className="flex items-start gap-2 text-sm leading-snug sm:items-center sm:text-base">
                <CalendarRange className="h-5 w-5 text-primary" />
                Detalhes da transferência
              </DialogTitle>
              <DialogDescription className="sr-only">
                Visualize o histórico completo da transferência e o snapshot do caixa salvo no momento da aceitação.
              </DialogDescription>
            </DialogHeader>
          {selectedTransfer && (
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] sm:px-6 sm:pt-4 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="space-y-4">
                <Card>
                  <CardContent className="grid gap-3 p-3 sm:p-4 md:grid-cols-2">
                    <Detail label="Sessão" value={selectedTransfer.session_id || selectedTransfer.cash_closing_id} />
                    <Detail label="Data operacional" value={formatDate(selectedTransfer.business_date)} />
                    <Detail label="De" value={selectedTransfer.from_name || '—'} />
                    <Detail label="Para" value={selectedTransfer.to_name || '—'} />
                    <Detail label="Solicitada por" value={selectedTransfer.requested_by_name || '—'} />
                    <Detail label="Aceita por" value={selectedTransfer.accepted_by_name || '—'} />
                    <Detail label="Solicitada em" value={formatDateTime(selectedTransfer.requested_at)} />
                    <Detail label="Aceita em" value={selectedTransfer.accepted_at ? formatDateTime(selectedTransfer.accepted_at) : '—'} />
                    <Detail label="Status" value={STATUS_LABELS[selectedTransfer.status] || selectedTransfer.status} />
                    <Detail label="Motivo" value={selectedTransfer.transfer_reason} />
                    <Detail label="Observações" value={selectedTransfer.notes || '—'} className="md:col-span-2" />
                  </CardContent>
                </Card>

                {hasTransferSnapshot(selectedTransfer) ? (
                  <>
                    <Card>
                      <CardHeader className="pb-2 sm:pb-3">
                        <CardTitle className="text-sm">Resumo do caixa no momento da aceitação</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-3">
                        <Metric label="Saldo inicial" value={selectedTransfer.snapshot_initial_balance} />
                        <Metric label="Vendas" value={selectedTransfer.snapshot_sales_total} />
                        <Metric label="Entradas" value={selectedTransfer.snapshot_income_total} />
                        <Metric label="Saídas" value={selectedTransfer.snapshot_expense_total} />
                        <Metric label="Saldo esperado" value={selectedTransfer.snapshot_expected_balance} highlight />
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Contagens</p>
                          <p className="font-semibold">
                            {formatSnapshotCount(selectedTransfer.snapshot_sale_count, 'venda')} • {formatSnapshotCount(selectedTransfer.snapshot_movement_count, 'movimento')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2 sm:pb-3">
                        <CardTitle className="text-sm">Totais por forma de pagamento</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3 p-3 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-3">
                        {PAYMENT_SNAPSHOT_FIELDS.map((item) => (
                          <Metric key={item.key} label={item.label} value={selectedTransfer[item.key]} />
                        ))}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Resumo do caixa no momento da aceitação</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        O snapshot desta transferência ainda não estava disponível no histórico; atualize a lista para carregar os dados reais já salvos.
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function hasTransferSnapshot(transfer: TransferRow) {
  return SNAPSHOT_FIELDS.some((field) => transfer[field] !== null && transfer[field] !== undefined);
}

function formatSnapshotCurrency(value?: number | null) {
  return value === null || value === undefined ? '—' : formatCurrency(Number(value));
}

function formatSnapshotCount(value: number | null | undefined, singularLabel: string) {
  if (value === null || value === undefined) return `— ${singularLabel}(s)`;
  return `${value} ${singularLabel}(s)`;
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value?: number | null; highlight?: boolean }) {
  return (
    <div className={`min-w-0 rounded-lg p-3 ${highlight ? 'border border-primary/20 bg-primary/5' : 'bg-muted/50'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`break-words text-sm font-semibold leading-snug sm:text-base ${highlight ? 'text-primary' : ''}`}>{formatSnapshotCurrency(value)}</p>
    </div>
  );
}