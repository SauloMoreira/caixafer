import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate, todayISO } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function RelatoriosPage() {
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [salesTotal, setSalesTotal] = useState(0);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [dailyData, setDailyData] = useState<{ date: string; vendas: number; entradas: number; saidas: number }[]>([]);

  useEffect(() => { fetchReport(); }, [startDate, endDate]);

  const fetchReport = async () => {
    const { data: sales } = await supabase.from('sales').select('business_date, total_amount').gte('business_date', startDate).lte('business_date', endDate);
    const { data: entries } = await supabase.from('cash_entries').select('business_date, entry_type, amount').gte('business_date', startDate).lte('business_date', endDate);

    setSalesTotal(sales?.reduce((s, r) => s + Number(r.total_amount), 0) || 0);
    setIncomeTotal(entries?.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0) || 0);
    setExpenseTotal(entries?.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0) || 0);

    // Daily breakdown
    const days: Record<string, { vendas: number; entradas: number; saidas: number }> = {};
    sales?.forEach(s => {
      if (!days[s.business_date]) days[s.business_date] = { vendas: 0, entradas: 0, saidas: 0 };
      days[s.business_date].vendas += Number(s.total_amount);
    });
    entries?.forEach(e => {
      if (!days[e.business_date]) days[e.business_date] = { vendas: 0, entradas: 0, saidas: 0 };
      if (e.entry_type === 'income') days[e.business_date].entradas += Number(e.amount);
      else days[e.business_date].saidas += Number(e.amount);
    });
    setDailyData(Object.entries(days).sort().map(([date, d]) => ({ date: formatDate(date), ...d })));
  };

  return (
    <div className="space-y-4">
      <h1 className="page-title">Relatórios</h1>
      <div className="flex gap-3">
        <div className="flex-1"><Label>De</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12" /></div>
        <div className="flex-1"><Label>Até</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12" /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground">Vendas</p><p className="financial-value text-primary">{formatCurrency(salesTotal)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Entradas</p><p className="financial-value financial-positive">{formatCurrency(incomeTotal)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Saídas</p><p className="financial-value financial-negative">{formatCurrency(expenseTotal)}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Saldo Líquido</p><p className="financial-value text-primary">{formatCurrency(salesTotal + incomeTotal - expenseTotal)}</p></div>
      </div>

      {dailyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Movimentação por Dia</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="vendas" fill="hsl(168, 60%, 38%)" name="Vendas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="entradas" fill="hsl(142, 60%, 40%)" name="Entradas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" fill="hsl(0, 72%, 51%)" name="Saídas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
