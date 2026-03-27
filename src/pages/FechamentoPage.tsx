import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO, formatDate } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Unlock, Printer, Share2, FileText } from 'lucide-react';

export default function FechamentoPage() {
  const { profile, isAdmin } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [closing, setClosing] = useState<any>(null);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [countedBalance, setCountedBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [stats, setStats] = useState({ sales: 0, income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [date, profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);

    // Get closing
    let closingQuery = supabase.from('cash_closings').select('*').eq('business_date', date);
    if (!isAdmin) closingQuery = closingQuery.eq('user_id', profile.id);
    const { data: closingData } = await closingQuery.maybeSingle();
    setClosing(closingData);
    if (closingData) {
      setOpeningBalance(String(closingData.opening_balance));
      setCountedBalance(closingData.counted_balance != null ? String(closingData.counted_balance) : '');
      setNotes(closingData.notes || '');
    }

    // Get stats
    let salesQuery = supabase.from('sales').select('total_amount').eq('business_date', date);
    if (!isAdmin) salesQuery = salesQuery.eq('created_by', profile.id);
    const { data: salesData } = await salesQuery;
    const sales = salesData?.reduce((s, r) => s + Number(r.total_amount), 0) || 0;

    let entriesQuery = supabase.from('cash_entries').select('entry_type, amount').eq('business_date', date);
    if (!isAdmin) entriesQuery = entriesQuery.eq('created_by', profile.id);
    const { data: entriesData } = await entriesQuery;
    const income = entriesData?.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0) || 0;
    const expense = entriesData?.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0) || 0;

    setStats({ sales, income, expense });
    setLoading(false);
  };

  const expectedBalance = Number(openingBalance) + stats.sales + stats.income - stats.expense;
  const difference = countedBalance ? Number(countedBalance) - expectedBalance : null;

  const saveClosing = async (close = false) => {
    if (!profile) return;
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

  const handlePrint = () => window.print();
  const handleShare = async () => {
    const text = `Fechamento Caixa da FER\nData: ${formatDate(date)}\nOperador: ${profile?.full_name}\nVendas: ${formatCurrency(stats.sales)}\nEntradas: ${formatCurrency(stats.income)}\nSaídas: ${formatCurrency(stats.expense)}\nSaldo Esperado: ${formatCurrency(expectedBalance)}\n${countedBalance ? `Saldo Contado: ${formatCurrency(Number(countedBalance))}\nDiferença: ${formatCurrency(difference || 0)}` : ''}`;
    if (navigator.share) {
      await navigator.share({ title: 'Fechamento de Caixa', text });
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <h1 className="page-title">Fechamento de Caixa</h1>
      <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {closing?.status === 'closed' ? <Lock className="h-4 w-4 text-income" /> : <Unlock className="h-4 w-4 text-warning" />}
            {closing?.status === 'closed' ? 'Caixa Fechado' : 'Caixa Aberto'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Saldo Inicial (R$)</Label>
            <Input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-12" disabled={closing?.status === 'closed' && !isAdmin} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card"><p className="text-xs text-muted-foreground">Vendas</p><p className="financial-value text-primary">{formatCurrency(stats.sales)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Entradas</p><p className="financial-value financial-positive">{formatCurrency(stats.income)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Saídas</p><p className="financial-value financial-negative">{formatCurrency(stats.expense)}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Saldo Esperado</p><p className="financial-value text-primary">{formatCurrency(expectedBalance)}</p></div>
          </div>

          <div>
            <Label>Saldo Contado (R$)</Label>
            <Input type="number" value={countedBalance} onChange={e => setCountedBalance(e.target.value)} className="h-12" disabled={closing?.status === 'closed' && !isAdmin} />
          </div>
          {difference !== null && (
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Diferença</p>
              <p className={`financial-value text-xl ${difference >= 0 ? 'financial-positive' : 'financial-negative'}`}>{formatCurrency(difference)}</p>
            </div>
          )}
          <div><Label>Observações</Label><Input value={notes} onChange={e => setNotes(e.target.value)} disabled={closing?.status === 'closed' && !isAdmin} /></div>

          {(closing?.status !== 'closed' || isAdmin) && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => saveClosing(false)}>Salvar</Button>
              <Button className="flex-1 h-12" onClick={() => saveClosing(true)}>Fechar Caixa</Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handlePrint}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
            <Button variant="outline" className="flex-1" onClick={handleShare}><Share2 className="mr-1 h-4 w-4" />Compartilhar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
