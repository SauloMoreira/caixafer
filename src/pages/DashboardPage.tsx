import { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO, PAYMENT_METHODS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Heart, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import BalanceEvolutionChart from '@/components/BalanceEvolutionChart';

interface DayStats {
  salesToday: number;
  incomeToday: number;
  expenseToday: number;
  balanceToday: number;
  fiadoOpen: number;
  fiadoReceived: number;
}

type ChartPeriod = 'day' | 'week' | 'month' | 'year';

function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Bom dia, ${name}! ☀️`;
  if (hour < 18) return `Boa tarde, ${name}!`;
  return `Boa noite, ${name}! 🌙`;
}

export default function DashboardPage() {
  const { profile, isAdmin, isVolunteer } = useAuth();
  const [stats, setStats] = useState<DayStats>({
    salesToday: 0, incomeToday: 0, expenseToday: 0,
    balanceToday: 0, fiadoOpen: 0, fiadoReceived: 0,
  });
  const [salesByMethod, setSalesByMethod] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart state
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('week');
  const [chartData, setChartData] = useState<{ label: string; saldo: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => { if (!isVolunteer) fetchStats(); }, [profile, isVolunteer]);
  useEffect(() => { if (!isVolunteer && profile) fetchChartData(); }, [chartPeriod, profile, isVolunteer]);

  if (isVolunteer) {
    return <Navigate to="/meu-spr" replace />;
  }

  const fetchStats = async () => {
    if (!profile) return;
    const today = todayISO();

    let salesQuery = supabase.from('sales').select('total_amount').eq('business_date', today);
    if (!isAdmin) salesQuery = salesQuery.eq('created_by', profile.id);
    const { data: salesData } = await salesQuery;
    const salesToday = salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;

    let entriesQuery = supabase.from('cash_entries').select('entry_type, amount').eq('business_date', today);
    if (!isAdmin) entriesQuery = entriesQuery.eq('created_by', profile.id);
    const { data: entriesData } = await entriesQuery;
    const incomeToday = entriesData?.filter(e => e.entry_type === 'income').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    const expenseToday = entriesData?.filter(e => e.entry_type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    const { data: fiadoData } = await supabase.from('spr_fiado_charges').select('amount, status');
    const fiadoOpen = fiadoData?.filter(f => f.status !== 'paid').reduce((sum, f) => sum + Number(f.amount), 0) || 0;

    const { data: fiadoPayments } = await supabase.from('spr_fiado_payments').select('amount_paid').eq('payment_date', today);
    const fiadoReceived = fiadoPayments?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;

    let methodQuery = supabase.from('sales').select('payment_method, total_amount').eq('business_date', today);
    if (!isAdmin) methodQuery = methodQuery.eq('created_by', profile.id);
    const { data: methodData } = await methodQuery;
    const methodMap: Record<string, number> = {};
    methodData?.forEach(s => {
      const pm = PAYMENT_METHODS.find(p => p.value === s.payment_method);
      const label = pm?.label || s.payment_method;
      methodMap[label] = (methodMap[label] || 0) + Number(s.total_amount);
    });
    setSalesByMethod(Object.entries(methodMap).map(([name, value]) => ({ name, value })));

    setStats({
      salesToday, incomeToday, expenseToday,
      balanceToday: salesToday + incomeToday - expenseToday,
      fiadoOpen, fiadoReceived,
    });
    setLoading(false);
  };

  const fetchChartData = async () => {
    if (!profile) return;
    setChartLoading(true);

    const now = new Date();
    let startDate: Date;
    let dateFormat: string;

    switch (chartPeriod) {
      case 'day':
        startDate = subDays(now, 7);
        dateFormat = 'dd/MM';
        break;
      case 'week':
        startDate = subWeeks(now, 8);
        dateFormat = 'dd/MM';
        break;
      case 'month':
        startDate = subMonths(now, 6);
        dateFormat = 'MMM';
        break;
      case 'year':
        startDate = subMonths(now, 12);
        dateFormat = 'MMM/yy';
        break;
    }

    const startStr = format(startDate, 'yyyy-MM-dd');

    // Fetch entries in range
    let entriesQuery = supabase
      .from('cash_entries')
      .select('entry_type, amount, business_date')
      .gte('business_date', startStr)
      .order('business_date');
    if (!isAdmin) entriesQuery = entriesQuery.eq('created_by', profile.id);
    const { data: entries } = await entriesQuery;

    // Fetch sales in range
    let salesQuery = supabase
      .from('sales')
      .select('total_amount, business_date')
      .gte('business_date', startStr)
      .order('business_date');
    if (!isAdmin) salesQuery = salesQuery.eq('created_by', profile.id);
    const { data: sales } = await salesQuery;

    // Build daily balances
    const dailyBalances: Record<string, number> = {};
    sales?.forEach(s => {
      const d = s.business_date;
      dailyBalances[d] = (dailyBalances[d] || 0) + Number(s.total_amount);
    });
    entries?.forEach(e => {
      const d = e.business_date;
      const val = e.entry_type === 'income' ? Number(e.amount) : -Number(e.amount);
      dailyBalances[d] = (dailyBalances[d] || 0) + val;
    });

    // Group by period
    let points: { label: string; saldo: number }[] = [];

    if (chartPeriod === 'day') {
      const days = eachDayOfInterval({ start: startDate, end: now });
      let cumulative = 0;
      points = days.map(d => {
        const key = format(d, 'yyyy-MM-dd');
        cumulative += dailyBalances[key] || 0;
        return { label: format(d, dateFormat, { locale: ptBR }), saldo: cumulative };
      });
    } else if (chartPeriod === 'week') {
      const weeks = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 1 });
      let cumulative = 0;
      points = weeks.map((weekStart, i) => {
        const weekEnd = i < weeks.length - 1 ? subDays(weeks[i + 1], 1) : now;
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        days.forEach(d => {
          cumulative += dailyBalances[format(d, 'yyyy-MM-dd')] || 0;
        });
        return { label: format(weekStart, dateFormat, { locale: ptBR }), saldo: cumulative };
      });
    } else {
      const months = eachMonthOfInterval({ start: startDate, end: now });
      let cumulative = 0;
      points = months.map((monthStart, i) => {
        const monthEnd = i < months.length - 1 ? subDays(months[i + 1], 1) : now;
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        days.forEach(d => {
          cumulative += dailyBalances[format(d, 'yyyy-MM-dd')] || 0;
        });
        return { label: format(monthStart, dateFormat, { locale: ptBR }), saldo: cumulative };
      });
    }

    setChartData(points);
    setChartLoading(false);
  };

  const statCards = [
    { label: 'Vendas Hoje', value: stats.salesToday, icon: ShoppingCart, color: 'text-primary' },
    { label: 'Entradas', value: stats.incomeToday, icon: TrendingUp, color: 'text-income' },
    { label: 'Saídas', value: stats.expenseToday, icon: TrendingDown, color: 'text-expense' },
    { label: 'Saldo', value: stats.balanceToday, icon: Wallet, color: stats.balanceToday >= 0 ? 'text-income' : 'text-expense' },
    { label: 'Fiado em Aberto', value: stats.fiadoOpen, icon: Heart, color: 'text-warning' },
    { label: 'Fiado Recebido', value: stats.fiadoReceived, icon: DollarSign, color: 'text-primary' },
  ];

  const COLORS = ['hsl(142, 60%, 40%)', 'hsl(168, 60%, 38%)', 'hsl(220, 25%, 10%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];

  const periodLabels: Record<ChartPeriod, string> = {
    day: '7 dias',
    week: '8 semanas',
    month: '6 meses',
    year: '12 meses',
  };

  const periodFilters: { key: ChartPeriod; label: string }[] = [
    { key: 'day', label: 'Dia' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 md:p-5">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.full_name} className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
            {profile?.full_name?.charAt(0)?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base md:text-lg font-semibold text-foreground truncate">
            {getGreeting(profile?.full_name?.split(' ')[0] || '')}
          </p>
          <p className="text-xs text-muted-foreground">
            {profile?.role === 'admin' ? 'Administrador' : 'Operador de Caixa'} • Resumo do dia
          </p>
        </div>
      </div>

      {/* Stat cards */}
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

      {/* ═══ BALANCE EVOLUTION CHART ═══ */}
      <Card className="overflow-hidden border-primary/10 shadow-sm">
        <CardHeader className="pb-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-primary" />
                Evolução do Saldo
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Últimos {periodLabels[chartPeriod]}
              </p>
            </div>
          </div>
          {/* Period filters */}
          <div className="flex gap-1.5">
            {periodFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setChartPeriod(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  chartPeriod === f.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4 pt-0 md:px-4">
          {chartLoading ? (
            <div className="flex items-center justify-center h-52 md:h-64">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            </div>
          ) : chartData.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-52 md:h-64 text-center gap-2">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Dados insuficientes para o gráfico.</p>
              <p className="text-xs text-muted-foreground">Continue registrando movimentações.</p>
            </div>
          ) : (
            <div className="h-52 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(168, 60%, 38%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(168, 60%, 38%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => {
                      if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                      return String(v);
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)',
                      fontSize: '13px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                    labelStyle={{ fontWeight: 600, marginBottom: 4, color: 'hsl(var(--foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    stroke="hsl(168, 60%, 38%)"
                    strokeWidth={2.5}
                    fill="url(#saldoGradient)"
                    dot={{ r: 3, fill: 'hsl(168, 60%, 38%)', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'hsl(168, 60%, 38%)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales by payment method */}
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
