import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, Trophy, AlertTriangle,
  Calendar, Target, Zap, Loader2, BarChart3, Star,
  ArrowUpRight, ArrowDownRight, Minus, Lightbulb, ShieldAlert,
  Package, DollarSign, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import PurchaseIntelligenceSection from '@/components/PurchaseIntelligenceSection';

const PERIOD_OPTIONS = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último ano' },
];

const PRIORITY_CONFIG = {
  alta: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: ShieldAlert, label: 'Alta' },
  media: { color: 'bg-warning/10 text-warning border-warning/20', icon: AlertTriangle, label: 'Média' },
  baixa: { color: 'bg-primary/10 text-primary border-primary/20', icon: Lightbulb, label: 'Baixa' },
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--muted-foreground))',
];

export default function InteligenciaPage() {
  const [period, setPeriod] = useState('90');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('sales-intelligence', {
        body: { period_days: Number(period) },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      const msg = e?.message || 'Erro ao gerar análise';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const d = result?.data;
  const ai = result?.ai;
  const kpis = d?.kpis;

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 2) return <ArrowUpRight className="h-4 w-4 text-income" />;
    if (value < -2) return <ArrowDownRight className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-6 w-6 text-primary" />
        <h1 className="page-title">Inteligência Analítica</h1>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <p className="text-xs text-muted-foreground mb-1.5">Período de análise</p>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchAnalysis} disabled={loading} className="h-10 w-full sm:w-auto gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {loading ? 'Analisando...' : 'Gerar Análise'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {!result && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Brain className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="font-heading font-bold text-lg mb-2">Inteligência Analítica</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Selecione o período e clique em "Gerar Análise" para receber insights inteligentes sobre suas vendas e sugestões práticas de melhoria.
            </p>
          </CardContent>
        </Card>
      )}

      {result && d && (
        <>
          {/* AI Summary */}
          {ai?.summary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">Resumo Analítico</p>
                    <p className="text-sm leading-relaxed">{ai.summary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Faturamento</span>
                </div>
                <p className="text-lg font-bold text-primary">{formatCurrency(kpis.total_revenue)}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <TrendIcon value={kpis.revenue_change_pct} />
                  <span className="text-[10px] text-muted-foreground">{kpis.revenue_change_pct > 0 ? '+' : ''}{kpis.revenue_change_pct.toFixed(1)}% vs anterior</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Total Vendas</span>
                </div>
                <p className="text-lg font-bold">{kpis.total_sales}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <TrendIcon value={kpis.sales_change_pct} />
                  <span className="text-[10px] text-muted-foreground">{kpis.sales_change_pct > 0 ? '+' : ''}{kpis.sales_change_pct.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Ticket Médio</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(kpis.avg_ticket)}</p>
                <span className="text-[10px] text-muted-foreground">{kpis.active_days} dias ativos</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Méd. Diária</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(kpis.avg_daily_revenue)}</p>
                <span className="text-[10px] text-muted-foreground">por dia ativo</span>
              </CardContent>
            </Card>
          </div>

          {/* Champion Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {d.best_day && (
              <Card className="border-primary/10">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-medium text-primary">Melhor Dia</span>
                  </div>
                  <p className="font-heading font-bold text-sm">{d.best_day.day}</p>
                  <p className="text-[10px] text-muted-foreground">Méd. {formatCurrency(d.best_day.avg_revenue)}/dia</p>
                </CardContent>
              </Card>
            )}
            {d.best_period && (
              <Card className="border-primary/10">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-medium text-primary">Melhor Época</span>
                  </div>
                  <p className="font-heading font-bold text-sm">{d.best_period.period}</p>
                  <p className="text-[10px] text-muted-foreground">Méd. {formatCurrency(d.best_period.avg_daily_revenue)}/dia</p>
                </CardContent>
              </Card>
            )}
            {d.champion_revenue && (
              <Card className="border-primary/10">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-medium text-primary">Campeão Faturamento</span>
                  </div>
                  <p className="font-heading font-bold text-sm truncate">{d.champion_revenue.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(d.champion_revenue.total_revenue)}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Faturamento por dia da semana */}
          {d.day_of_week?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Faturamento por Dia da Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={d.day_of_week}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `R$${v}`} />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="avg_revenue" fill="hsl(var(--primary))" name="Méd. Faturamento" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Categorias - Pie chart */}
          {d.categories?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Faturamento por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={d.categories}
                        dataKey="revenue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percent }: any) => `${category} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={10}
                      >
                        {d.categories.map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Products Rankings */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* Top by quantity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-income" />
                  Mais Vendidos (quantidade)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {d.top_by_quantity?.slice(0, 7).map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{p.quantity_sold} un</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(p.total_revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top by revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Maior Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {d.top_by_revenue?.slice(0, 7).map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">{formatCurrency(p.total_revenue)}</p>
                        <p className="text-[10px] text-muted-foreground">{p.quantity_sold} un</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Least sold */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-warning" />
                  Menos Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {d.bottom_by_quantity?.slice(0, 7).map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-warning">{p.quantity_sold} un</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(p.total_revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Low turnover */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Menor Giro (méd. diária)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {d.low_turnover?.slice(0, 7).map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-destructive">{p.avg_daily_qty}/dia</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(p.total_revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Suggestions */}
          {ai?.suggestions?.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-2">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-sm font-bold">Sugestões da IA</h2>
              </div>
              <div className="space-y-3">
                {ai.suggestions.map((s: any, i: number) => {
                  const config = PRIORITY_CONFIG[s.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.baixa;
                  const PIcon = config.icon;
                  return (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                            <PIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                                {config.label}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mb-1">{s.insight}</p>
                            {s.opportunity && (
                              <p className="text-xs text-primary mb-1">💡 {s.opportunity}</p>
                            )}
                            <p className="text-sm text-foreground/80 mb-2">{s.action}</p>
                            {s.basis && (
                              <p className="text-[10px] text-muted-foreground italic">{s.basis}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Opportunities */}
          {ai?.opportunities?.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-2">
                <Star className="h-5 w-5 text-warning" />
                <h2 className="font-heading text-sm font-bold">Oportunidades de Melhoria</h2>
              </div>
              <div className="space-y-2">
                {ai.opportunities.map((o: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/10">
                        <Star className="h-3 w-3 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{o.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Trend */}
          {ai?.trends && (
            <Card className="border-muted">
              <CardContent className="p-4 flex items-center gap-3">
                {ai.trends.revenue_trend === 'alta' ? (
                  <TrendingUp className="h-5 w-5 text-income shrink-0" />
                ) : ai.trends.revenue_trend === 'queda' ? (
                  <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
                ) : (
                  <Minus className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div>
                  <p className="text-xs font-medium">Tendência de Faturamento</p>
                  <p className="text-sm text-muted-foreground">{ai.trends.revenue_trend_description}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
