import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Heart, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DayStats {
  salesToday: number;
  incomeToday: number;
  expenseToday: number;
  balanceToday: number;
  fiadoOpen: number;
  fiadoReceived: number;
}

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DayStats>({
    salesToday: 0, incomeToday: 0, expenseToday: 0,
    balanceToday: 0, fiadoOpen: 0, fiadoReceived: 0,
  });
  const [salesByMethod, setSalesByMethod] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [profile]);

  const fetchStats = async () => {
    if (!profile) return;
    const today = todayISO();

    // Sales today
    let salesQuery = supabase.from('sales').select('total_amount').eq('business_date', today);
    if (!isAdmin) salesQuery = salesQuery.eq('created_by', profile.id);
    const { data: salesData } = await salesQuery;
    const salesToday = salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;

    // Cash entries today
    let entriesQuery = supabase.from('cash_entries').select('entry_type, amount').eq('business_date', today);
    if (!isAdmin) entriesQuery = entriesQuery.eq('created_by', profile.id);
    const { data: entriesData } = await entriesQuery;
    const incomeToday = entriesData?.filter(e => e.entry_type === 'income').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    const expenseToday = entriesData?.filter(e => e.entry_type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    // Fiado stats
    const { data: fiadoData } = await supabase.from('spr_fiado_charges').select('amount, status');
    const fiadoOpen = fiadoData?.filter(f => f.status !== 'paid').reduce((sum, f) => sum + Number(f.amount), 0) || 0;

    // Fiado received today
    const { data: fiadoPayments } = await supabase.from('spr_fiado_payments').select('amount_paid').eq('payment_date', today);
    const fiadoReceived = fiadoPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;

    // Sales by payment method
    let methodQuery = supabase.from('sales').select('payment_method, total_amount').eq('business_date', today);
    if (!isAdmin) methodQuery = methodQuery.eq('created_by', profile.id);
    const { data: methodData } = await methodQuery;
    const methodMap: Record<string, number> = {};
    methodData?.forEach(s => {
      const label = s.payment_method === 'pix' ? 'PIX' : s.payment_method === 'debito' ? 'Débito' : s.payment_method === 'credito' ? 'Crédito' : 'Transferência';
      methodMap[label] = (methodMap[label] || 0) + Number(s.total_amount);
    });
    setSalesByMethod(Object.entries(methodMap).map(([name, value]) => ({ name, value })));

    setStats({
      salesToday,
      incomeToday,
      expenseToday,
      balanceToday: salesToday + incomeToday - expenseToday,
      fiadoOpen,
      fiadoReceived,
    });
    setLoading(false);
  };

  const statCards = [
    { label: 'Vendas Hoje', value: stats.salesToday, icon: ShoppingCart, color: 'text-primary' },
    { label: 'Entradas', value: stats.incomeToday, icon: TrendingUp, color: 'text-income' },
    { label: 'Saídas', value: stats.expenseToday, icon: TrendingDown, color: 'text-expense' },
    { label: 'Saldo', value: stats.balanceToday, icon: Wallet, color: stats.balanceToday >= 0 ? 'text-income' : 'text-expense' },
    { label: 'Fiado em Aberto', value: stats.fiadoOpen, icon: Heart, color: 'text-warning' },
    { label: 'Fiado Recebido', value: stats.fiadoReceived, icon: DollarSign, color: 'text-primary' },
  ];

  const COLORS = ['hsl(168, 60%, 38%)', 'hsl(220, 25%, 10%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Olá, {profile?.full_name}! Resumo do dia.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map(card => (
          <Card key={card.label} className="stat-card">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className={`financial-value text-lg md:text-xl ${card.color}`}>
                {formatCurrency(card.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {salesByMethod.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-4 text-sm font-semibold">Vendas por Forma de Pagamento</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={salesByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                    {salesByMethod.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
