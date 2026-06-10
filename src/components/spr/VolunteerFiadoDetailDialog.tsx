import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Download, Loader2, Sparkles, ArrowDownToLine, ArrowUpFromLine, User, AlertTriangle } from 'lucide-react';
import { useVolunteerFiadoHistory, PeriodRange } from '@/hooks/useVolunteerFiadoHistory';
import { formatCurrency } from '@/lib/constants';
import { exportVolunteerHistoryCSV, buildLocalAISummary } from '@/lib/volunteer-history-export';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteerId: string | null;
  mode?: 'admin' | 'self';
}

type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'custom';

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeFor(key: PeriodKey, customFrom: string, customTo: string): PeriodRange {
  const today = new Date();
  const t = isoDate(today);
  if (key === 'today') return { from: t, to: t };
  if (key === '7d') { const d = new Date(); d.setDate(d.getDate() - 6); return { from: isoDate(d), to: t }; }
  if (key === '30d') { const d = new Date(); d.setDate(d.getDate() - 29); return { from: isoDate(d), to: t }; }
  if (key === 'month') { const d = new Date(today.getFullYear(), today.getMonth(), 1); return { from: isoDate(d), to: t }; }
  return { from: customFrom || t, to: customTo || t };
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const PM_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferência',
};

export default function VolunteerFiadoDetailDialog({ open, onOpenChange, volunteerId, mode = 'admin' }: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' && mode === 'admin';

  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const range = useMemo(() => rangeFor(periodKey, customFrom, customTo), [periodKey, customFrom, customTo]);
  const periodLabel = `${range.from} a ${range.to}`;

  const { data, isLoading } = useVolunteerFiadoHistory(volunteerId, range);

  const handleExport = () => {
    if (!data) return;
    exportVolunteerHistoryCSV(data, periodLabel);
  };

  const aiSummary = data ? buildLocalAISummary(data, periodLabel) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-5xl w-[98vw] max-h-[calc(100dvh-1rem)] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg truncate">
                {data?.volunteer?.full_name || 'Carregando...'}
              </DialogTitle>
              {data && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant={data.summary.status === 'paid' ? 'secondary' : data.summary.status === 'partial' ? 'outline' : 'destructive'}>
                    {data.summary.status === 'paid' ? 'Quitado' : data.summary.status === 'partial' ? 'Parcial' : 'Em aberto'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Saldo atual: <strong className="text-foreground">{formatCurrency(data.summary.current_balance)}</strong></span>
                </div>
              )}
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={handleExport} disabled={!data} className="shrink-0">
                <Download className="h-4 w-4 mr-1" />CSV
              </Button>
            )}
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as PeriodKey)}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {periodKey === 'custom' && (
              <>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 w-[150px]" />
                <span className="text-xs text-muted-foreground">até</span>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 w-[150px]" />
              </>
            )}
          </div>
        </DialogHeader>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && data && (
          <ScrollArea className="flex-1">
            <div className="px-4 pb-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <SummaryCard label="Devido anterior" value={data.previousBalance} tone="warning" />
                <SummaryCard label="Adquirido (período)" value={data.summary.acquired_total} tone="expense" />
                <SummaryCard label="Pago (período)" value={data.summary.paid_total} tone="income" />
                <SummaryCard label="Saldo atual" value={data.summary.current_balance} tone={data.summary.current_balance > 0 ? 'expense' : 'income'} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                <div>Lançamentos no período: <strong className="text-foreground">{data.charges.length}</strong></div>
                <div>Pagamentos no período: <strong className="text-foreground">{data.paymentGroups.length}</strong></div>
                <div>Último pagamento: <strong className="text-foreground">{data.summary.last_payment_at ? fmtDateTime(data.summary.last_payment_at) : '—'}</strong></div>
              </div>

              {/* AI / Summary block */}
              <Card className="mt-3 border-primary/30 bg-primary/5">
                <CardContent className="p-3 flex gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm leading-relaxed">{aiSummary}</p>
                </CardContent>
              </Card>

              <Tabs defaultValue="resumo" className="mt-3">
                <TabsList className="w-full flex-wrap h-auto">
                  <TabsTrigger value="resumo" className="flex-1">Resumo</TabsTrigger>
                  <TabsTrigger value="adquiridos" className="flex-1">Fiados ({data.charges.length})</TabsTrigger>
                  <TabsTrigger value="pagamentos" className="flex-1">Pagamentos ({data.paymentGroups.length})</TabsTrigger>
                  <TabsTrigger value="timeline" className="flex-1">Linha do tempo</TabsTrigger>
                  {isAdmin && <TabsTrigger value="auditoria" className="flex-1">Auditoria</TabsTrigger>}
                </TabsList>

                <TabsContent value="resumo" className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Últimos movimentos do período:</p>
                  {data.timeline.slice(-8).reverse().map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs sm:text-sm border-b py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {t.kind === 'charge' ? <ArrowUpFromLine className="h-3.5 w-3.5 text-expense shrink-0" /> : <ArrowDownToLine className="h-3.5 w-3.5 text-income shrink-0" />}
                        <span className="truncate">{t.description}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className={t.kind === 'charge' ? 'text-expense' : 'text-income'}>
                          {t.kind === 'charge' ? '-' : '+'}{formatCurrency(t.kind === 'charge' ? t.debit : t.credit)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{fmtDateTime(t.occurred_at)}</div>
                      </div>
                    </div>
                  ))}
                  {data.timeline.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Sem movimentos no período.</p>}
                </TabsContent>

                <TabsContent value="adquiridos" className="mt-3 space-y-2">
                  {data.charges.map(c => (
                    <Card key={c.id}>
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.description || 'Fiado'}</p>
                            <p className="text-[11px] text-muted-foreground">{fmtDateTime(c.created_at)} · {c.created_by_name || '—'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="financial-value text-sm">{formatCurrency(c.amount)}</p>
                            <Badge variant="outline" className="text-[10px] mt-0.5">{c.status === 'paid' ? 'Pago' : c.status === 'partial' ? 'Parcial' : 'Em aberto'}</Badge>
                          </div>
                        </div>
                        {c.items.length > 0 && (
                          <div className="text-[11px] text-muted-foreground pl-2 border-l-2 border-muted">
                            {c.items.map(i => <div key={i.id}>{i.quantity}× {i.product_name} — {formatCurrency(i.line_total)}</div>)}
                          </div>
                        )}
                        {c.notes && <p className="text-[11px] italic text-muted-foreground">{c.notes}</p>}
                      </CardContent>
                    </Card>
                  ))}
                  {data.charges.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhum fiado adquirido no período.</p>}
                </TabsContent>

                <TabsContent value="pagamentos" className="mt-3 space-y-2">
                  {data.paymentGroups.map(g => (
                    <Collapsible key={g.group_id}>
                      <Card>
                        <CollapsibleTrigger className="w-full">
                          <CardContent className="p-3 flex items-center justify-between gap-2">
                            <div className="text-left min-w-0">
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                {PM_LABELS[g.payment_method] || g.payment_method}
                                {g.items.length > 1 && <Badge variant="secondary" className="text-[10px]">{g.items.length} itens</Badge>}
                                {!g.hasGroupId && <Badge variant="outline" className="text-[10px] text-warning border-warning/40">Sem agrupamento</Badge>}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{fmtDateTime(g.created_at)} · {g.created_by_name || '—'}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <p className="financial-value text-sm text-income">{formatCurrency(g.total_paid)}</p>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-1 text-[11px] text-muted-foreground border-t pt-2">
                            <div>ID operação: <code className="text-[10px]">{g.group_id.slice(0, 8)}</code></div>
                            {g.document_reference && <div>Ref.: {g.document_reference}</div>}
                            {g.notes && <div className="italic">{g.notes}</div>}
                            <div className="pt-1">
                              <p className="font-medium text-foreground mb-1">Itens baixados:</p>
                              {g.items.map(it => (
                                <div key={it.id} className="flex justify-between border-b py-1">
                                  <span className="truncate">{it.charge_description || `Fiado #${it.fiado_charge_id.slice(0, 6)}`}</span>
                                  <span className="text-income">{formatCurrency(it.amount_paid)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                  {data.paymentGroups.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhum pagamento no período.</p>}
                </TabsContent>

                <TabsContent value="timeline" className="mt-3">
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Data</th>
                          <th className="text-left p-2">Movimento</th>
                          <th className="text-right p-2">Débito</th>
                          <th className="text-right p-2">Crédito</th>
                          <th className="text-right p-2">Saldo após</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t bg-muted/20">
                          <td className="p-2 italic" colSpan={4}>Saldo anterior ao período</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(data.previousBalance)}</td>
                        </tr>
                        {data.timeline.map((t, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 whitespace-nowrap">{fmtDateTime(t.occurred_at)}</td>
                            <td className="p-2">
                              <div className="font-medium">{t.kind === 'charge' ? 'Fiado adquirido' : 'Pagamento'}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{t.description}</div>
                              {t.user_name && <div className="text-[10px] text-muted-foreground">por {t.user_name}</div>}
                            </td>
                            <td className="p-2 text-right text-expense">{t.debit > 0 ? formatCurrency(t.debit) : '—'}</td>
                            <td className="p-2 text-right text-income">{t.credit > 0 ? formatCurrency(t.credit) : '—'}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(t.balance_after)}</td>
                          </tr>
                        ))}
                        {data.timeline.length === 0 && (
                          <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sem movimentos no período.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {isAdmin && (
                  <TabsContent value="auditoria" className="mt-3 space-y-3">
                    <AuditSection title="Usuários que lançaram fiado" entries={
                      Object.entries(data.charges.reduce<Record<string, number>>((acc, c) => {
                        const k = c.created_by_name || '—'; acc[k] = (acc[k] || 0) + c.amount; return acc;
                      }, {})).map(([name, total]) => ({ name, total, count: data.charges.filter(c => (c.created_by_name || '—') === name).length }))
                    } />
                    <AuditSection title="Usuários que receberam pagamentos" entries={
                      Object.entries(data.paymentGroups.reduce<Record<string, number>>((acc, g) => {
                        const k = g.created_by_name || '—'; acc[k] = (acc[k] || 0) + g.total_paid; return acc;
                      }, {})).map(([name, total]) => ({ name, total, count: data.paymentGroups.filter(g => (g.created_by_name || '—') === name).length }))
                    } />
                    {data.paymentGroups.filter(g => !g.hasGroupId).length > 0 && (
                      <Card className="border-warning/40 bg-warning/5">
                        <CardContent className="p-3 flex gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-medium">Pagamentos sem agrupamento:</p>
                            <p className="text-muted-foreground">{data.paymentGroups.filter(g => !g.hasGroupId).length} pagamento(s) podem não estar consolidados corretamente.</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'income' | 'expense' | 'warning' }) {
  const cls = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-warning';
  return (
    <Card>
      <CardContent className="p-2.5">
        <p className="text-[10px] sm:text-[11px] text-muted-foreground">{label}</p>
        <p className={`financial-value text-sm sm:text-base ${cls}`}>{formatCurrency(value)}</p>
      </CardContent>
    </Card>
  );
}

function AuditSection({ title, entries }: { title: string; entries: Array<{ name: string; total: number; count: number }> }) {
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{title}</p>
        <div className="space-y-1">
          {entries.map(e => (
            <div key={e.name} className="flex justify-between text-xs">
              <span>{e.name} <span className="text-muted-foreground">({e.count})</span></span>
              <span className="font-medium">{formatCurrency(e.total)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
