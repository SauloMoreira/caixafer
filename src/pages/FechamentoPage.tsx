import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO, formatDate, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Lock, Unlock, Printer, Share2, FileText, AlertTriangle, RotateCcw, History, Shield, ChevronDown, ChevronUp, Edit, Sparkles, ArrowRightLeft, ShieldAlert, User, Calendar, Clock } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { logSecurityEvent } from '@/lib/security';
import BluetoothPrintButton from '@/components/BluetoothPrintButton';
import { printClosing } from '@/lib/bluetooth-printer';
import CriticalActionDialog from '@/components/CriticalActionDialog';
import CashCorrectionReview from '@/components/CashCorrectionReview';
import DailyOperationInsights from '@/components/DailyOperationInsights';
import AIRecommendations from '@/components/AIRecommendations';
import CashTransferDialog from '@/components/CashTransferDialog';
import PendingTransferBanner from '@/components/PendingTransferBanner';
import CashTransferHistory from '@/components/CashTransferHistory';
import { useQuery } from '@tanstack/react-query';

const REOPEN_REASONS = [
  { value: 'ajuste_operacional', label: 'Ajuste operacional' },
  { value: 'correcao_lancamento', label: 'Correção de lançamento' },
  { value: 'nova_venda', label: 'Nova venda após fechamento' },
  { value: 'acerto_administrativo', label: 'Acerto administrativo' },
  { value: 'outro', label: 'Outro' },
];

const ADMIN_CLOSE_REASONS = [
  { value: 'operador_ausente', label: 'Operador ausente' },
  { value: 'esquecimento_fechamento', label: 'Esquecimento de fechamento' },
  { value: 'contingencia_operacional', label: 'Contingência operacional' },
  { value: 'correcao_emergencial', label: 'Correção emergencial' },
  { value: 'necessidade_administrativa', label: 'Necessidade administrativa' },
  { value: 'outro', label: 'Outro' },
];

export default function FechamentoPage() {
  const { profile, isAdmin, hasOperationalOverride } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [closing, setClosing] = useState<any>(null);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [countedBalance, setCountedBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [stats, setStats] = useState({ sales: 0, income: 0, expense: 0 });
  const [salesByMethod, setSalesByMethod] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [existingOpenByOther, setExistingOpenByOther] = useState<{ responsibleName: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Reopen state
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenCustomReason, setReopenCustomReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [closingHistory, setClosingHistory] = useState<any[]>([]);
  const [showCorrectionReview, setShowCorrectionReview] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  // Admin override close state
  const [showAdminCloseDialog, setShowAdminCloseDialog] = useState(false);
  const [adminCloseReason, setAdminCloseReason] = useState('');
  const [adminCloseCustomReason, setAdminCloseCustomReason] = useState('');
  const [adminCloseNotes, setAdminCloseNotes] = useState('');
  const [adminCloseLoading, setAdminCloseLoading] = useState(false);
  const { data: responsibilityNames = {} } = useQuery({
    queryKey: ['cash-closing-responsibility-names', closing?.user_id, closing?.current_responsible_id],
    queryFn: async () => {
      const ids = [closing?.user_id, closing?.current_responsible_id].filter(Boolean) as string[];
      if (ids.length === 0) return {};
      const { data } = await supabase.rpc('get_user_names', { _user_ids: Array.from(new Set(ids)) });
      return Object.fromEntries((data || []).map((item: { id: string; full_name: string }) => [item.id, item.full_name]));
    },
    enabled: !!closing,
  });

  useEffect(() => { fetchData(); }, [date, profile]);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setExistingOpenByOther(null);

    // Get closing for selected date (latest version)
    let closingQuery = supabase.from('cash_closings').select('*').eq('business_date', date);
    if (!isAdmin && !hasOperationalOverride) closingQuery = closingQuery.or(`user_id.eq.${profile.id},current_responsible_id.eq.${profile.id}`);
    closingQuery = closingQuery.eq('is_latest_version', true);
    const { data: closingData } = await closingQuery.maybeSingle();
    setClosing(closingData);
    if (closingData) {
      setOpeningBalance(String(closingData.opening_balance));
      setCountedBalance(closingData.counted_balance != null ? String(closingData.counted_balance) : '');
      setNotes(closingData.notes || '');
    } else {
      setOpeningBalance('0');
      setCountedBalance('');
      setNotes('');

      // Check if another user already has an open cash session for this date (bypass RLS)
      if (!hasOperationalOverride) {
        const { data: sessions } = await supabase.rpc('get_open_cash_session_today');
        if (sessions && sessions.length > 0 && sessions[0].current_responsible_id !== profile.id) {
          setExistingOpenByOther({ responsibleName: sessions[0].responsible_name || 'outro operador' });
        }
      }
    }

    // Check for pending previous days
    const { data: pendingClosings } = await supabase
      .from('cash_closings')
      .select('business_date')
      .or(`user_id.eq.${profile.id},current_responsible_id.eq.${profile.id}`)
      .eq('status', 'open')
      .lt('business_date', date)
      .order('business_date', { ascending: true })
      .limit(1);
    setPendingDate(pendingClosings?.[0]?.business_date || null);

    // Get stats
    let salesQuery = supabase.from('sales').select('total_amount, payment_method, is_deleted').eq('business_date', date);
    if (!isAdmin) salesQuery = salesQuery.eq('created_by', profile.id);
    const { data: salesData } = await salesQuery;
    const activeSales = salesData?.filter((s: any) => !s.is_deleted) || [];
    const sales = activeSales.reduce((s: number, r: any) => s + Number(r.total_amount), 0);

    const methodTotals: Record<string, number> = {};
    activeSales.forEach((s: any) => {
      const key = s.payment_method as string;
      methodTotals[key] = (methodTotals[key] || 0) + Number(s.total_amount);
    });
    setSalesByMethod(methodTotals);

    let entriesQuery = supabase.from('cash_entries').select('entry_type, amount, is_deleted').eq('business_date', date);
    if (!isAdmin) entriesQuery = entriesQuery.eq('created_by', profile.id);
    const { data: entriesData } = await entriesQuery;
    const activeEntries = entriesData?.filter((e: any) => !e.is_deleted) || [];
    const income = activeEntries.filter((e: any) => e.entry_type === 'income').reduce((s: number, e: any) => s + Number(e.amount), 0);
    const expense = activeEntries.filter((e: any) => e.entry_type === 'expense').reduce((s: number, e: any) => s + Number(e.amount), 0);

    setStats({ sales, income, expense });
    setLoading(false);
  }, [date, profile, isAdmin]);

  const fetchHistory = useCallback(async () => {
    if (!closing || !isAdmin) return;
    const { data } = await supabase
      .from('cash_closings')
      .select('*')
      .eq('business_date', date)
      .eq('user_id', closing.user_id)
      .order('closing_version', { ascending: false });
    setClosingHistory(data || []);
  }, [closing, date, isAdmin]);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, fetchHistory]);

  const expectedBalance = Number(openingBalance) + stats.sales + stats.income - stats.expense;
  const difference = countedBalance ? Number(countedBalance) - expectedBalance : null;

  const canReopen = closing?.status === 'closed' && (
    isAdmin || (date === todayISO())
  );

  const handleReopen = async () => {
    if (!profile || !closing) return;
    const reason = reopenReason === 'outro' ? reopenCustomReason : REOPEN_REASONS.find(r => r.value === reopenReason)?.label || reopenReason;
    if (!reason.trim()) {
      toast.error('Informe o motivo da reabertura.');
      return;
    }

    // Save snapshot of closing state before reopen
    const snapshot = {
      closing_version: closing.closing_version,
      closed_at: closing.closed_at,
      counted_balance: closing.counted_balance,
      expected_balance: closing.expected_balance,
      difference_amount: closing.difference_amount,
      sales_total: closing.sales_total,
      income_total: closing.income_total,
      expense_total: closing.expense_total,
      opening_balance: closing.opening_balance,
      notes: closing.notes,
    };

    const { error } = await supabase.from('cash_closings').update({
      status: 'open' as any,
      reopened_by: profile.id,
      reopened_at: new Date().toISOString(),
      reopen_reason: reason,
      previous_closing_snapshot: snapshot,
      closing_version: closing.closing_version + 1,
    }).eq('id', closing.id);

    if (error) {
      toast.error('Erro ao reabrir: ' + error.message);
    } else {
      toast.success('Caixa reaberto com sucesso! O histórico foi preservado.');
      setShowReopenDialog(false);
      const wasCorrection = reopenReason === 'correcao_lancamento';
      setReopenReason('');
      setReopenCustomReason('');
      await fetchData();
      if (wasCorrection) {
        setShowCorrectionReview(true);
      }
    }
  };

  const openCashRegister = async () => {
    if (!profile) return;
    if (pendingDate) {
      toast.error(`Feche o caixa do dia ${formatDate(pendingDate)} antes de abrir um novo.`);
      return;
    }
    if (existingOpenByOther) {
      toast.error(`Caixa já foi aberto por ${existingOpenByOther.responsibleName}.`);
      return;
    }
    const { error } = await supabase.from('cash_closings').insert({
      business_date: date,
      user_id: profile.id,
      opening_balance: Number(openingBalance),
      notes: notes || null,
      status: 'open' as const,
    });
    if (error) {
      if (error.message.includes('idx_one_open_cash_per_day') || error.message.includes('unique') || error.message.includes('duplicate')) {
        toast.error('Já existe um caixa aberto para este dia.');
        // Log blocked attempt
        const { logSecurityEvent } = await import('@/lib/security');
        logSecurityEvent({
          event_type: 'cash_open_blocked_existing_open_session',
          entity_type: 'cash_closings',
          action: 'INSERT_BLOCKED',
          business_date: date,
          severity: 'medium',
          notes: `Tentativa de abertura bloqueada. Já existe caixa aberto no dia ${date}.`,
        });
        fetchData();
      } else {
        toast.error('Erro: ' + error.message);
      }
    } else {
      toast.success('Caixa aberto!');
      fetchData();
    }
  };

  const saveClosing = async (close = false) => {
    if (!profile) return;
    if (close && !countedBalance) {
      toast.error('Informe o saldo contado antes de fechar o caixa.');
      return;
    }
    const updateData = {
      opening_balance: Number(openingBalance),
      sales_total: stats.sales,
      income_total: stats.income,
      expense_total: stats.expense,
      expected_balance: expectedBalance,
      counted_balance: countedBalance ? Number(countedBalance) : null,
      difference_amount: difference,
      notes: notes || null,
      status: close ? 'closed' as const : 'open' as const,
      closed_at: close ? new Date().toISOString() : null,
    };
    const insertData = {
      ...updateData,
      business_date: date,
      user_id: profile.id,
    };

    let error;
    if (closing) {
      ({ error } = await supabase.from('cash_closings').update(updateData).eq('id', closing.id));
    } else {
      ({ error } = await supabase.from('cash_closings').insert(insertData));
    }
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(close ? 'Caixa fechado!' : 'Salvo!'); fetchData(); }
  };

  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) { window.print(); return; }
    const printWindow = window.open('', '_blank', 'width=500,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Fechamento ${formatDate(date)}</title>
      <style>
        body { margin: 0; padding: 15mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6; }
        h2 { text-align: center; margin-bottom: 8px; }
        .row { display: flex; justify-content: space-between; }
        .sep { border-bottom: 1px dashed #999; margin: 8px 0; }
        .bold { font-weight: bold; }
        @media print { @page { size: 80mm auto; margin: 5mm; } }
      </style></head><body>
        <h2>CANTINA DA FER</h2>
        <p style="text-align:center;font-size:11px;color:#666;">Fechamento de Caixa</p>
        <div class="sep"></div>
        <div class="row"><span>Data:</span><span class="bold">${formatDate(date)}</span></div>
        <div class="row"><span>Operador:</span><span>${profile?.full_name}</span></div>
        <div class="sep"></div>
        <div class="row"><span>Saldo Inicial:</span><span>${formatCurrency(Number(openingBalance))}</span></div>
        <div class="row"><span>Vendas:</span><span>${formatCurrency(stats.sales)}</span></div>
        <div class="row"><span>Entradas:</span><span>${formatCurrency(stats.income)}</span></div>
        <div class="row"><span>Saídas:</span><span>${formatCurrency(stats.expense)}</span></div>
        <div class="sep"></div>
        <div class="row bold"><span>Saldo Esperado:</span><span>${formatCurrency(expectedBalance)}</span></div>
        ${countedBalance ? `
          <div class="row"><span>Saldo Contado:</span><span>${formatCurrency(Number(countedBalance))}</span></div>
          <div class="row bold"><span>Diferença:</span><span>${formatCurrency(difference || 0)}</span></div>
        ` : ''}
        ${notes ? `<div class="sep"></div><p>Obs: ${notes}</p>` : ''}
        <div class="sep"></div>
        <p style="text-align:center;font-size:10px;color:#666;">Caixa da FER - Todos os direitos reservados</p>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleShare = async () => {
    const text = `Fechamento Caixa da FER\nData: ${formatDate(date)}\nOperador: ${profile?.full_name}\nSaldo Inicial: ${formatCurrency(Number(openingBalance))}\nVendas: ${formatCurrency(stats.sales)}\nEntradas: ${formatCurrency(stats.income)}\nSaídas: ${formatCurrency(stats.expense)}\nSaldo Esperado: ${formatCurrency(expectedBalance)}\n${countedBalance ? `Saldo Contado: ${formatCurrency(Number(countedBalance))}\nDiferença: ${formatCurrency(difference || 0)}` : ''}`;
    if (navigator.share) {
      await navigator.share({ title: 'Fechamento de Caixa', text });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  if (showCorrectionReview && closing) {
    return (
      <div className="max-w-xl mx-auto">
        <CashCorrectionReview
          businessDate={date}
          closingId={closing.id}
          onClose={() => setShowCorrectionReview(false)}
          onDataChanged={fetchData}
        />
      </div>
    );
  }

  const wasReopened = closing?.reopened_at != null;
  const closingVersion = closing?.closing_version || 1;

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <h1 className="page-title">Fechamento de Caixa</h1>
      <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12" />

      {/* Pending transfer banner */}
      <PendingTransferBanner
        onTransferAccepted={fetchData}
        onTransferStatusChanged={fetchData}
      />

      {/* Warning for pending previous day */}
      {pendingDate && date !== pendingDate && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/20 p-3 text-warning text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Caixa anterior pendente</p>
            <p>O caixa do dia <strong>{formatDate(pendingDate)}</strong> está em aberto. Feche-o antes de abrir um novo dia.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setDate(pendingDate)}>
              Ir para {formatDate(pendingDate)}
            </Button>
          </div>
        </div>
      )}

      {/* AI Recommendations - always visible */}
      {profile && (
        <AIRecommendations
          businessDate={date}
          userId={profile.id}
        />
      )}

      {/* No closing exists for this date */}
      {!closing && (
        <>
          {existingOpenByOther && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Lock className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
                <div className="space-y-1">
                  <p className="font-semibold text-destructive">Caixa já aberto</p>
                  <p className="text-sm text-destructive/90">
                    Caixa já foi aberto por <strong>{existingOpenByOther.responsibleName}</strong>.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Se você precisa fazer o caixa, solicite a transferência da responsabilidade.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Unlock className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-heading text-lg font-bold">Nenhum caixa para {formatDate(date)}</h2>
                <p className="text-sm text-muted-foreground">Abra o caixa para iniciar as operações do dia.</p>
              </div>
              {!existingOpenByOther && (
                <div className="w-full max-w-xs space-y-3">
                  <div>
                    <Label>Saldo Inicial (R$)</Label>
                    <Input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-12" />
                  </div>
                  <Button className="h-12 w-full" onClick={openCashRegister} disabled={!!pendingDate}>
                    <Unlock className="mr-2 h-4 w-4" />
                    Abrir Caixa
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Closing exists */}
      {closing && (
        <>
          {/* Reopen badge banner */}
          {wasReopened && (
            <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
              <RotateCcw className="h-4 w-4 shrink-0 mt-0.5 text-accent-foreground" />
              <div className="space-y-0.5">
                <p className="font-semibold text-accent-foreground">
                  Caixa reaberto
                  <Badge variant="outline" className="ml-2 text-[10px]">v{closingVersion}</Badge>
                </p>
                <p className="text-muted-foreground text-xs">
                  Motivo: {closing.reopen_reason} · {closing.reopened_at ? formatDateTime(closing.reopened_at) : ''}
                </p>
              </div>
            </div>
          )}

          <Card ref={reportRef}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  {closing.status === 'closed' ? <Lock className="h-4 w-4 text-income" /> : <Unlock className="h-4 w-4 text-warning" />}
                  {closing.status === 'closed' ? 'Caixa Fechado' : 'Caixa Aberto'}
                  {wasReopened && closing.status === 'closed' && (
                    <Badge variant="secondary" className="text-[10px]">Fechado novamente</Badge>
                  )}
                </CardTitle>
                {closingVersion > 1 && (
                  <Badge variant="outline" className="text-[10px] font-mono">v{closingVersion}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Saldo Inicial (R$)</Label>
                <Input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-12" disabled={closing.status === 'closed' && !isAdmin} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="stat-card"><p className="text-xs text-muted-foreground">Vendas</p><p className="financial-value text-primary">{formatCurrency(stats.sales)}</p></div>
                <div className="stat-card"><p className="text-xs text-muted-foreground">Entradas</p><p className="financial-value financial-positive">{formatCurrency(stats.income)}</p></div>
                <div className="stat-card"><p className="text-xs text-muted-foreground">Saídas</p><p className="financial-value financial-negative">{formatCurrency(stats.expense)}</p></div>
                <div className="stat-card"><p className="text-xs text-muted-foreground">Saldo Esperado</p><p className="financial-value text-primary">{formatCurrency(expectedBalance)}</p></div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1 text-xs">
                <p className="font-semibold text-primary">Histórico de responsabilidade</p>
                <p className="text-muted-foreground">Aberto por: <strong>{responsibilityNames[closing.user_id] || profile?.full_name || '—'}</strong></p>
                <p className="text-muted-foreground">Responsável atual: <strong>{responsibilityNames[closing.current_responsible_id] || '—'}</strong></p>
                <p className="text-muted-foreground">Transferências realizadas: <strong>{closing.transfer_count || 0}</strong></p>
              </div>

              {Object.keys(salesByMethod).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Vendas por Forma de Pagamento</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(pm => {
                      const val = salesByMethod[pm.value] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={pm.value} className="stat-card">
                          <p className="text-xs text-muted-foreground">{pm.label}</p>
                          <p className="financial-value text-sm text-primary">{formatCurrency(val)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <Label>Saldo Contado (R$)</Label>
                <Input type="number" value={countedBalance} onChange={e => setCountedBalance(e.target.value)} className="h-12" disabled={closing.status === 'closed' && !isAdmin} />
              </div>
              {difference !== null && (
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Diferença</p>
                  <p className={`financial-value text-xl ${difference >= 0 ? 'financial-positive' : 'financial-negative'}`}>{formatCurrency(difference)}</p>
                </div>
              )}
              <div><Label>Observações</Label><Input value={notes} onChange={e => setNotes(e.target.value)} disabled={closing.status === 'closed' && !isAdmin} /></div>
            </CardContent>
          </Card>

          {/* Daily Operation Insights */}
          <DailyOperationInsights
            businessDate={date}
            disabled={closing.status === 'closed' && !isAdmin}
          />

          <Card>
            <CardContent className="space-y-4 pt-6">
              {/* Action buttons */}
              {closing.status !== 'closed' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-12" onClick={() => saveClosing(false)}>Salvar</Button>
                    <Button className="flex-1 h-12" onClick={() => saveClosing(true)}>Fechar Caixa</Button>
                  </div>
                  {/* Transfer button */}
                  <Button
                    variant="outline"
                    className="w-full h-11 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => setShowTransferDialog(true)}
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Transferir Caixa
                  </Button>
                  {wasReopened && (
                    <Button
                      variant="outline"
                      className="w-full h-11 border-primary/30 text-primary hover:bg-primary/5"
                      onClick={() => setShowCorrectionReview(true)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Revisar Lançamentos
                    </Button>
                  )}
                </div>
              )}

              {/* Reopen button */}
              {canReopen && (
                <Button
                  variant="outline"
                  className="w-full h-12 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
                  onClick={() => setShowReopenDialog(true)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reabrir Caixa
                </Button>
              )}

              <div className="grid grid-cols-4 gap-2">
                <Button variant="outline" className="h-12 flex-col gap-1" onClick={handlePrint}><Printer className="h-4 w-4" /><span className="text-[10px]">Imprimir</span></Button>
                <Button variant="outline" className="h-12 flex-col gap-1" onClick={handlePrint}><FileText className="h-4 w-4" /><span className="text-[10px]">PDF</span></Button>
                <Button variant="outline" className="h-12 flex-col gap-1" onClick={handleShare}><Share2 className="h-4 w-4" /><span className="text-[10px]">Compartilhar</span></Button>
                <BluetoothPrintButton
                  onPrint={async () => {
                    const methodMap: Record<string, { label: string; value: number }> = {};
                    PAYMENT_METHODS.forEach(pm => {
                      const val = salesByMethod[pm.value] || 0;
                      if (val > 0) methodMap[pm.value] = { label: pm.label, value: val };
                    });
                    await printClosing({
                      date,
                      operatorName: profile?.full_name || '',
                      openingBalance: Number(openingBalance),
                      sales: stats.sales,
                      income: stats.income,
                      expense: stats.expense,
                      expectedBalance,
                      countedBalance: countedBalance ? Number(countedBalance) : null,
                      difference,
                      salesByMethod: methodMap,
                      notes,
                      version: closing?.closing_version,
                      status: closing?.status || 'open',
                    });
                  }}
                />
              </div>

              {/* History toggle for admin */}
              {isAdmin && closingVersion > 1 && (
                <Button
                  variant="ghost"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="mr-2 h-4 w-4" />
                  Histórico de versões ({closingVersion})
                  {showHistory ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Version history */}
          {showHistory && isAdmin && closingHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="h-4 w-4" />
                  Histórico de Fechamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {closingHistory.map((ver, idx) => {
                  const snap = ver.previous_closing_snapshot;
                  return (
                    <div key={ver.id} className={`rounded-lg border p-3 space-y-1 text-xs ${ver.is_latest_version ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          Versão {ver.closing_version}
                          {ver.is_latest_version && <Badge className="ml-2 text-[9px]">Atual</Badge>}
                        </span>
                        <Badge variant={ver.status === 'closed' ? 'secondary' : 'outline'} className="text-[9px]">
                          {ver.status === 'closed' ? 'Fechado' : 'Aberto'}
                        </Badge>
                      </div>
                      {ver.closed_at && <p className="text-muted-foreground">Fechado em: {formatDateTime(ver.closed_at)}</p>}
                      {ver.reopened_at && (
                        <div className="text-muted-foreground space-y-0.5">
                          <p>Reaberto em: {formatDateTime(ver.reopened_at)}</p>
                          <p>Motivo: {ver.reopen_reason}</p>
                        </div>
                      )}
                      {snap && (
                        <div className="mt-1 rounded bg-muted/50 p-2 space-y-0.5">
                          <p className="font-medium text-muted-foreground">Snapshot v{snap.closing_version}:</p>
                          <p>Saldo esperado: {formatCurrency(snap.expected_balance)}</p>
                          <p>Saldo contado: {snap.counted_balance != null ? formatCurrency(snap.counted_balance) : '—'}</p>
                          <p>Diferença: {snap.difference_amount != null ? formatCurrency(snap.difference_amount) : '—'}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Transfer History */}
          {closing && <CashTransferHistory closingId={closing.id} />}
        </>
      )}

      {/* Reopen Dialog */}
      <CriticalActionDialog
        open={showReopenDialog}
        onOpenChange={setShowReopenDialog}
        title="Reabrir Caixa"
        description={`Deseja reabrir o caixa de ${formatDate(date)}?`}
        severity="warning"
        confirmLabel="Reabrir Caixa"
        onConfirm={handleReopen}
        summary={[
          { label: 'Data', value: formatDate(date) },
          { label: 'Versão atual', value: `v${closingVersion}` },
          { label: 'Nova versão', value: `v${closingVersion + 1}` },
        ]}
      >
        <div className="space-y-3 mt-2">
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
            <Shield className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <div className="space-y-1">
              <p>O histórico anterior será <strong>totalmente preservado</strong>.</p>
              <p>A reabertura será registrada em <strong>auditoria</strong>.</p>
              <p>Um novo fechamento poderá ser realizado depois.</p>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Motivo da reabertura *</Label>
            <Select value={reopenReason} onValueChange={setReopenReason}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {REOPEN_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reopenReason === 'outro' && (
            <div>
              <Label className="text-xs font-semibold">Descreva o motivo *</Label>
              <Input
                value={reopenCustomReason}
                onChange={e => setReopenCustomReason(e.target.value)}
                placeholder="Motivo da reabertura..."
                className="mt-1"
              />
            </div>
          )}
        </div>
      </CriticalActionDialog>

      {/* Cash Transfer Dialog */}
      {closing && (
        <CashTransferDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          closingId={closing.id}
          businessDate={date}
          currentStats={stats}
          openingBalance={Number(openingBalance)}
          onTransferred={fetchData}
        />
      )}
    </div>
  );
}
