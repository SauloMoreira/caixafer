import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO, formatDate, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Unlock, Printer, Share2, FileText, AlertTriangle } from 'lucide-react';

export default function FechamentoPage() {
  const { profile, isAdmin } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [closing, setClosing] = useState<any>(null);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [countedBalance, setCountedBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [stats, setStats] = useState({ sales: 0, income: 0, expense: 0 });
  const [salesByMethod, setSalesByMethod] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchData(); }, [date, profile]);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // Get closing for selected date
    let closingQuery = supabase.from('cash_closings').select('*').eq('business_date', date);
    if (!isAdmin) closingQuery = closingQuery.eq('user_id', profile.id);
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
    }

    // Check for pending previous days
    const { data: pendingClosings } = await supabase
      .from('cash_closings')
      .select('business_date')
      .eq('user_id', profile.id)
      .eq('status', 'open')
      .lt('business_date', date)
      .order('business_date', { ascending: true })
      .limit(1);
    setPendingDate(pendingClosings?.[0]?.business_date || null);

    // Get stats
    let salesQuery = supabase.from('sales').select('total_amount, payment_method').eq('business_date', date);
    if (!isAdmin) salesQuery = salesQuery.eq('created_by', profile.id);
    const { data: salesData } = await salesQuery;
    const sales = salesData?.reduce((s, r) => s + Number(r.total_amount), 0) || 0;

    // Sales by payment method
    const methodTotals: Record<string, number> = {};
    salesData?.forEach(s => {
      const key = s.payment_method as string;
      methodTotals[key] = (methodTotals[key] || 0) + Number(s.total_amount);
    });
    setSalesByMethod(methodTotals);

    let entriesQuery = supabase.from('cash_entries').select('entry_type, amount').eq('business_date', date);
    if (!isAdmin) entriesQuery = entriesQuery.eq('created_by', profile.id);
    const { data: entriesData } = await entriesQuery;
    const income = entriesData?.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0) || 0;
    const expense = entriesData?.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0) || 0;

    setStats({ sales, income, expense });
    setLoading(false);
  }, [date, profile, isAdmin]);

  const expectedBalance = Number(openingBalance) + stats.sales + stats.income - stats.expense;
  const difference = countedBalance ? Number(countedBalance) - expectedBalance : null;

  const openCashRegister = async () => {
    if (!profile) return;
    if (pendingDate) {
      toast.error(`Feche o caixa do dia ${formatDate(pendingDate)} antes de abrir um novo.`);
      return;
    }
    const { error } = await supabase.from('cash_closings').insert({
      business_date: date,
      user_id: profile.id,
      opening_balance: Number(openingBalance),
      notes: notes || null,
      status: 'open' as const,
    });
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Caixa aberto!'); fetchData(); }
  };

  const saveClosing = async (close = false) => {
    if (!profile) return;
    if (close && !countedBalance) {
      toast.error('Informe o saldo contado antes de fechar o caixa.');
      return;
    }
    const data = {
      business_date: date,
      user_id: profile.id,
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

    let error;
    if (closing) {
      ({ error } = await supabase.from('cash_closings').update(data).eq('id', closing.id));
    } else {
      ({ error } = await supabase.from('cash_closings').insert(data));
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

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <h1 className="page-title">Fechamento de Caixa</h1>
      <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12" />

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

      {/* No closing exists for this date */}
      {!closing && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Unlock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="font-heading text-lg font-bold">Nenhum caixa para {formatDate(date)}</h2>
              <p className="text-sm text-muted-foreground">Abra o caixa para iniciar as operações do dia.</p>
            </div>
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
          </CardContent>
        </Card>
      )}

      {/* Closing exists */}
      {closing && (
        <Card ref={reportRef}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {closing.status === 'closed' ? <Lock className="h-4 w-4 text-income" /> : <Unlock className="h-4 w-4 text-warning" />}
              {closing.status === 'closed' ? 'Caixa Fechado' : 'Caixa Aberto'}
            </CardTitle>
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

            {(closing.status !== 'closed' || isAdmin) && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-12" onClick={() => saveClosing(false)}>Salvar</Button>
                <Button className="flex-1 h-12" onClick={() => saveClosing(true)}>Fechar Caixa</Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handlePrint}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
              <Button variant="outline" className="flex-1" onClick={handlePrint}><FileText className="mr-1 h-4 w-4" />PDF</Button>
              <Button variant="outline" className="flex-1" onClick={handleShare}><Share2 className="mr-1 h-4 w-4" />Compartilhar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
