import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO, PAYMENT_METHODS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Heart, Wallet, ArrowUpDown, Lock, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import BalanceEvolutionChart from '@/components/BalanceEvolutionChart';
import PendingTransferBanner from '@/components/PendingTransferBanner';

interface DayStats {
  salesToday: number;
  incomeToday: number;
  expenseToday: number;
  balanceToday: number;
  fiadoOpen: number;
  fiadoReceived: number;
}

function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Bom dia, ${name}! ☀️`;
  if (hour < 18) return `Boa tarde, ${name}!`;
  return `Boa noite, ${name}! 🌙`;
}

const QUICK_ACTIONS = [
  {
    to: '/pdv',
    icon: ShoppingCart,
    label: 'PDV',
    subtitle: 'Registrar venda e entradas rápidas',
    gradient: 'from-primary/15 to-primary/5',
    iconColor: 'text-primary',
    borderColor: 'border-primary/20 hover:border-primary/40',
  },
  {
    to: '/spr',
    icon: Heart,
    label: 'SPR',
    subtitle: 'Gestão de fiado e voluntários',
    gradient: 'from-[hsl(340,60%,50%)]/15 to-[hsl(340,60%,50%)]/5',
    iconColor: 'text-[hsl(340,60%,50%)]',
    borderColor: 'border-[hsl(340,60%,50%)]/20 hover:border-[hsl(340,60%,50%)]/40',
  },
  {
    to: '/movimentos',
    icon: ArrowUpDown,
    label: 'Movimentos',
    subtitle: 'Ver lançamentos do dia',
    gradient: 'from-income/15 to-income/5',
    iconColor: 'text-income',
    borderColor: 'border-income/20 hover:border-income/40',
  },
  {
    to: '/fechamento',
    icon: Lock,
    label: 'Fechamento',
    subtitle: 'Conferir e fechar caixa',
    gradient: 'from-warning/15 to-warning/5',
    iconColor: 'text-warning',
    borderColor: 'border-warning/20 hover:border-warning/40',
  },
];

export default function DashboardPage() {
  const { profile, isAdmin, isVolunteer, isCashier } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DayStats>({
    salesToday: 0, incomeToday: 0, expenseToday: 0,
    balanceToday: 0, fiadoOpen: 0, fiadoReceived: 0,
  });
  const [salesByMethod, setSalesByMethod] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isVolunteer) fetchStats(); }, [profile, isVolunteer]);

  if (isVolunteer) {
    return <Navigate to="/meu-consumo" replace />;
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

  const statCards = isCashier
    ? [
        { label: 'Vendas Hoje', value: stats.salesToday, icon: ShoppingCart, color: 'text-primary' },
        { label: 'Entradas', value: stats.incomeToday, icon: TrendingUp, color: 'text-income' },
        { label: 'Saídas', value: stats.expenseToday, icon: TrendingDown, color: 'text-expense' },
        { label: 'Saldo', value: stats.balanceToday, icon: Wallet, color: stats.balanceToday >= 0 ? 'text-income' : 'text-expense' },
      ]
    : [
        { label: 'Vendas Hoje', value: stats.salesToday, icon: ShoppingCart, color: 'text-primary' },
        { label: 'Entradas', value: stats.incomeToday, icon: TrendingUp, color: 'text-income' },
        { label: 'Saídas', value: stats.expenseToday, icon: TrendingDown, color: 'text-expense' },
        { label: 'Saldo', value: stats.balanceToday, icon: Wallet, color: stats.balanceToday >= 0 ? 'text-income' : 'text-expense' },
        { label: 'Fiado em Aberto', value: stats.fiadoOpen, icon: Heart, color: 'text-warning' },
        { label: 'Fiado Recebido', value: stats.fiadoReceived, icon: DollarSign, color: 'text-primary' },
      ];

  const COLORS = ['hsl(142, 60%, 40%)', 'hsl(168, 60%, 38%)', 'hsl(220, 25%, 10%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];

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
          <img key={profile.avatar_url} src={profile.avatar_url} alt={profile.full_name} className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0" />
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
            {isAdmin ? 'Administrador' : 'Operador de Caixa'} • Resumo do dia
          </p>
        </div>
      </div>

      {/* ═══ PENDING TRANSFER BANNER ═══ */}
      {(isCashier || isAdmin) && (
        <PendingTransferBanner
          onTransferAccepted={() => window.location.reload()}
          onTransferStatusChanged={() => window.location.reload()}
        />
      )}

      {/* ═══ CASHIER QUICK ACTIONS ═══ */}
      {isCashier && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 px-1">
            Acesso Rápido
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className={`group relative overflow-hidden rounded-2xl border-2 ${action.borderColor} bg-gradient-to-br ${action.gradient} p-5 text-left transition-all duration-200 active:scale-[0.97] hover:shadow-lg`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-background/80 shadow-sm ${action.iconColor}`}>
                      <action.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className={`grid grid-cols-2 gap-3 ${isAdmin ? 'md:grid-cols-3 lg:grid-cols-6' : 'md:grid-cols-4'}`}>
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

      {/* ═══ BALANCE EVOLUTION CHART — Admin only ═══ */}
      {isAdmin && <BalanceEvolutionChart />}

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
