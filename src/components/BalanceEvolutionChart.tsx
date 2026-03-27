import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BarChart3, CalendarIcon, X } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts';
import { cn } from '@/lib/utils';
import {
  format, subDays, subWeeks, subMonths,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  differenceInDays, isAfter, isBefore, startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ChartPeriod = 'day' | 'week' | 'month' | 'year';

const periodLabels: Record<ChartPeriod, string> = {
  day: '7 dias', week: '8 semanas', month: '6 meses', year: '12 meses',
};

const periodFilters: { key: ChartPeriod; label: string }[] = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'year', label: 'Ano' },
];

export default function BalanceEvolutionChart() {
  const { profile, isAdmin } = useAuth();
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('week');
  const [chartData, setChartData] = useState<{ label: string; saldo: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Custom date range
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [dateError, setDateError] = useState('');

  const applyCustomRange = useCallback(() => {
    if (!customFrom || !customTo) {
      setDateError('Selecione as duas datas.');
      return;
    }
    if (isAfter(customFrom, customTo)) {
      setDateError('Data inicial deve ser anterior à final.');
      return;
    }
    setDateError('');
    setIsCustom(true);
  }, [customFrom, customTo]);

  const clearCustomRange = useCallback(() => {
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setIsCustom(false);
    setDateError('');
  }, []);

  useEffect(() => {
    if (profile) fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPeriod, profile, isCustom, customFrom, customTo]);

  const fetchChartData = async () => {
    if (!profile) return;
    setChartLoading(true);

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    let dateFormat: string;

    if (isCustom && customFrom && customTo) {
      startDate = startOfDay(customFrom);
      endDate = startOfDay(customTo);
      const span = differenceInDays(endDate, startDate);
      dateFormat = span > 90 ? 'MMM/yy' : span > 30 ? 'dd/MM' : 'dd/MM';
    } else {
      switch (chartPeriod) {
        case 'day':
          startDate = subDays(now, 7); dateFormat = 'dd/MM'; break;
        case 'week':
          startDate = subWeeks(now, 8); dateFormat = 'dd/MM'; break;
        case 'month':
          startDate = subMonths(now, 6); dateFormat = 'MMM'; break;
        case 'year':
          startDate = subMonths(now, 12); dateFormat = 'MMM/yy'; break;
      }
    }

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    let entriesQuery = supabase
      .from('cash_entries')
      .select('entry_type, amount, business_date')
      .gte('business_date', startStr)
      .lte('business_date', endStr)
      .order('business_date');
    if (!isAdmin) entriesQuery = entriesQuery.eq('created_by', profile.id);
    const { data: entries } = await entriesQuery;

    let salesQuery = supabase
      .from('sales')
      .select('total_amount, business_date')
      .gte('business_date', startStr)
      .lte('business_date', endStr)
      .order('business_date');
    if (!isAdmin) salesQuery = salesQuery.eq('created_by', profile.id);
    const { data: sales } = await salesQuery;

    const dailyBalances: Record<string, number> = {};
    sales?.forEach(s => {
      dailyBalances[s.business_date] = (dailyBalances[s.business_date] || 0) + Number(s.total_amount);
    });
    entries?.forEach(e => {
      const val = e.entry_type === 'income' ? Number(e.amount) : -Number(e.amount);
      dailyBalances[e.business_date] = (dailyBalances[e.business_date] || 0) + val;
    });

    let points: { label: string; saldo: number }[] = [];
    const span = differenceInDays(endDate, startDate);

    if (isCustom || chartPeriod === 'day' || (isCustom && span <= 60)) {
      // Day-level or custom short range
      if (!isCustom && chartPeriod !== 'day' && span > 60) {
        // use monthly
      }
      const useMonthly = span > 90;
      const useWeekly = span > 30 && span <= 90;

      if (useMonthly) {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        let cum = 0;
        points = months.map((ms, i) => {
          const me = i < months.length - 1 ? subDays(months[i + 1], 1) : endDate;
          eachDayOfInterval({ start: ms, end: me }).forEach(d => {
            cum += dailyBalances[format(d, 'yyyy-MM-dd')] || 0;
          });
          return { label: format(ms, dateFormat, { locale: ptBR }), saldo: cum };
        });
      } else if (useWeekly) {
        const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
        let cum = 0;
        points = weeks.map((ws, i) => {
          const we = i < weeks.length - 1 ? subDays(weeks[i + 1], 1) : endDate;
          eachDayOfInterval({ start: ws, end: we }).forEach(d => {
            cum += dailyBalances[format(d, 'yyyy-MM-dd')] || 0;
          });
          return { label: format(ws, 'dd/MM', { locale: ptBR }), saldo: cum };
        });
      } else {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        let cum = 0;
        points = days.map(d => {
          cum += dailyBalances[format(d, 'yyyy-MM-dd')] || 0;
          return { label: format(d, 'dd/MM', { locale: ptBR }), saldo: cum };
        });
      }
    } else if (chartPeriod === 'week') {
      const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
      let cum = 0;
      points = weeks.map((ws, i) => {
        const we = i < weeks.length - 1 ? subDays(weeks[i + 1], 1) : endDate;
        eachDayOfInterval({ start: ws, end: we }).forEach(d => {
          cum += dailyBalances[format(d, 'yyyy-MM-dd')] || 0;
        });
        return { label: format(ws, dateFormat, { locale: ptBR }), saldo: cum };
      });
    } else {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      let cum = 0;
      points = months.map((ms, i) => {
        const me = i < months.length - 1 ? subDays(months[i + 1], 1) : endDate;
        eachDayOfInterval({ start: ms, end: me }).forEach(d => {
          cum += dailyBalances[format(d, 'yyyy-MM-dd')] || 0;
        });
        return { label: format(ms, dateFormat, { locale: ptBR }), saldo: cum };
      });
    }

    setChartData(points);
    setChartLoading(false);
  };

  const subtitleText = isCustom && customFrom && customTo
    ? `${format(customFrom, 'dd/MM/yyyy')} — ${format(customTo, 'dd/MM/yyyy')}`
    : `Últimos ${periodLabels[chartPeriod]}`;

  return (
    <Card className="overflow-hidden border-primary/10 shadow-sm">
      <CardHeader className="pb-2 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-4.5 w-4.5 text-primary" />
              Evolução do Saldo
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitleText}</p>
          </div>
        </div>

        {/* Quick filters + custom date */}
        <div className="flex flex-wrap items-center gap-1.5">
          {periodFilters.map(f => (
            <button
              key={f.key}
              onClick={() => { setChartPeriod(f.key); clearCustomRange(); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                !isCustom && chartPeriod === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f.label}
            </button>
          ))}

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          {/* Date from */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  customFrom
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {customFrom ? format(customFrom, 'dd/MM/yy') : 'De'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={setCustomFrom}
                disabled={d => isAfter(d, new Date())}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Date to */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  customTo
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {customTo ? format(customTo, 'dd/MM/yy') : 'Até'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={setCustomTo}
                disabled={d => isAfter(d, new Date())}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Apply / Clear */}
          {(customFrom || customTo) && !isCustom && (
            <Button size="sm" variant="default" className="h-7 px-3 text-xs rounded-lg" onClick={applyCustomRange}>
              Aplicar
            </Button>
          )}
          {isCustom && (
            <button
              onClick={clearCustomRange}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>

        {dateError && (
          <p className="text-xs text-destructive font-medium">{dateError}</p>
        )}
      </CardHeader>

      <CardContent className="px-2 pb-4 pt-0 md:px-4">
        {chartLoading ? (
          <div className="flex items-center justify-center h-52 md:h-64">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-52 md:h-64 text-center gap-2">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {isCustom ? 'Nenhum dado encontrado neste período.' : 'Dados insuficientes para o gráfico.'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCustom ? 'Tente selecionar um intervalo diferente.' : 'Continue registrando movimentações.'}
            </p>
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
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false} axisLine={false}
                  tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
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
                  type="monotone" dataKey="saldo"
                  stroke="hsl(168, 60%, 38%)" strokeWidth={2.5}
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
  );
}
