import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, todayISO, toLocalISODate } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, PackageCheck,
  RotateCcw, PackageX, Lightbulb, BarChart3,
} from 'lucide-react';
import StockInsightsSection from '@/components/StockInsightsSection';

const CATEGORY_LABELS: Record<string, string> = {
  salgados: 'Salgados',
  doces: 'Doces',
  bolos: 'Bolos',
  agua: 'Água',
  refrigerante: 'Refrigerante',
};

const CATEGORY_COLORS: Record<string, string> = {
  salgados: 'hsl(var(--primary))',
  doces: 'hsl(var(--chart-2))',
  bolos: 'hsl(var(--chart-3))',
  agua: 'hsl(var(--chart-4))',
  refrigerante: 'hsl(var(--chart-5))',
};

interface InsightRow {
  business_date: string;
  category: string;
  suggested_quantity: number | null;
  exposed_quantity: number | null;
  sold_quantity: number | null;
  leftover_quantity: number | null;
  had_shortage: boolean;
  had_restock: boolean;
}

interface CategorySummary {
  category: string;
  label: string;
  totalExposed: number;
  totalSold: number;
  totalLeftover: number;
  shortageDays: number;
  restockDays: number;
  totalDays: number;
  utilizationRate: number; // sold / exposed %
  wasteRate: number; // leftover / exposed %
  avgExposed: number;
  avgSold: number;
  avgLeftover: number;
}

export default function InsightsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalISODate(d);
  });
  const [endDate, setEndDate] = useState(todayISO());
  const [data, setData] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('daily_operation_insights')
      .select('business_date, category, suggested_quantity, exposed_quantity, sold_quantity, leftover_quantity, had_shortage, had_restock')
      .gte('business_date', startDate)
      .lte('business_date', endDate)
      .order('business_date', { ascending: true });
    setData(rows || []);
    setLoading(false);
  };

  // Aggregate by category
  const summaries: CategorySummary[] = Object.entries(
    (data || []).reduce<Record<string, InsightRow[]>>((acc, row) => {
      if (!acc[row.category]) acc[row.category] = [];
      acc[row.category].push(row);
      return acc;
    }, {})
  ).map(([category, rows]) => {
    const totalExposed = rows.reduce((s, r) => s + (r.exposed_quantity || 0), 0);
    const totalSold = rows.reduce((s, r) => s + (r.sold_quantity || 0), 0);
    const totalLeftover = rows.reduce((s, r) => s + (r.leftover_quantity || 0), 0);
    const shortageDays = rows.filter(r => r.had_shortage).length;
    const restockDays = rows.filter(r => r.had_restock).length;
    const totalDays = rows.length;
    return {
      category,
      label: CATEGORY_LABELS[category] || category,
      totalExposed,
      totalSold,
      totalLeftover,
      shortageDays,
      restockDays,
      totalDays,
      utilizationRate: totalExposed > 0 ? (totalSold / totalExposed) * 100 : 0,
      wasteRate: totalExposed > 0 ? (totalLeftover / totalExposed) * 100 : 0,
      avgExposed: totalDays > 0 ? totalExposed / totalDays : 0,
      avgSold: totalDays > 0 ? totalSold / totalDays : 0,
      avgLeftover: totalDays > 0 ? totalLeftover / totalDays : 0,
    };
  }).sort((a, b) => b.utilizationRate - a.utilizationRate);

  // Daily trend data for chart
  const dailyMap: Record<string, Record<string, { sold: number; leftover: number; exposed: number }>> = {};
  (data || []).forEach(row => {
    if (!dailyMap[row.business_date]) dailyMap[row.business_date] = {};
    dailyMap[row.business_date][row.category] = {
      sold: row.sold_quantity || 0,
      leftover: row.leftover_quantity || 0,
      exposed: row.exposed_quantity || 0,
    };
  });

  const dailyChartData = Object.entries(dailyMap).sort().map(([date, cats]) => {
    const totalSold = Object.values(cats).reduce((s, c) => s + c.sold, 0);
    const totalLeftover = Object.values(cats).reduce((s, c) => s + c.leftover, 0);
    const totalExposed = Object.values(cats).reduce((s, c) => s + c.exposed, 0);
    return {
      date: formatDate(date),
      vendido: totalSold,
      sobra: totalLeftover,
      exposto: totalExposed,
      aproveitamento: totalExposed > 0 ? Math.round((totalSold / totalExposed) * 100) : 0,
    };
  });

  // Radar data
  const radarData = summaries.map(s => ({
    category: s.label,
    aproveitamento: Math.round(s.utilizationRate),
    desperdicio: Math.round(s.wasteRate),
    falta: Math.round((s.shortageDays / Math.max(s.totalDays, 1)) * 100),
  }));

  // Top-level KPIs
  const totalExposedAll = summaries.reduce((s, c) => s + c.totalExposed, 0);
  const totalSoldAll = summaries.reduce((s, c) => s + c.totalSold, 0);
  const totalLeftoverAll = summaries.reduce((s, c) => s + c.totalLeftover, 0);
  const totalShortageDays = summaries.reduce((s, c) => s + c.shortageDays, 0);
  const totalRestockDays = summaries.reduce((s, c) => s + c.restockDays, 0);
  const overallUtilization = totalExposedAll > 0 ? (totalSoldAll / totalExposedAll) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-6 w-6 text-primary" />
        <h1 className="page-title">Insights Operacionais</h1>
      </div>

      {/* Date filter */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Sem dados operacionais</p>
            <p className="text-sm text-muted-foreground">Registre a operação do dia no fechamento de caixa para alimentar os insights.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stock Insights */}
          <StockInsightsSection />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Aproveitamento</span>
                </div>
                <p className="text-2xl font-bold text-primary">{Math.round(overallUtilization)}%</p>
                <Progress value={overallUtilization} className="mt-2 h-1.5" />
              </CardContent>
            </Card>

            <Card className="border-warning/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-warning" />
                  <span className="text-xs text-muted-foreground">Sobra Total</span>
                </div>
                <p className="text-2xl font-bold text-warning">{totalLeftoverAll}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalExposedAll > 0 ? Math.round((totalLeftoverAll / totalExposedAll) * 100) : 0}% do exposto
                </p>
              </CardContent>
            </Card>

            <Card className="border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PackageX className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Dias com Falta</span>
                </div>
                <p className="text-2xl font-bold text-destructive">{totalShortageDays}</p>
                <p className="text-xs text-muted-foreground mt-1">ocorrências no período</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Reposições</span>
                </div>
                <p className="text-2xl font-bold">{totalRestockDays}</p>
                <p className="text-xs text-muted-foreground mt-1">ocorrências no período</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend Chart */}
          {dailyChartData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Evolução Diária
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="vendido" fill="hsl(var(--primary))" name="Vendido" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="sobra" fill="hsl(var(--warning))" name="Sobra" radius={[2, 2, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Radar Chart */}
          {radarData.length > 2 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Comparação por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} />
                    <Radar name="Aproveitamento %" dataKey="aproveitamento" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    <Radar name="Desperdício %" dataKey="desperdicio" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.15} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Category Detail Cards */}
          <h2 className="font-heading text-sm font-bold mt-2">Detalhamento por Categoria</h2>
          <div className="space-y-3">
            {summaries.map(s => {
              const isGood = s.utilizationRate >= 70;
              const isWarning = s.wasteRate >= 40;
              const hasShortage = s.shortageDays > 0;
              return (
                <Card key={s.category} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[s.category] || 'hsl(var(--muted-foreground))' }}
                        />
                        <span className="font-heading font-bold text-sm">{s.label}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {isGood && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Bom</Badge>}
                        {isWarning && <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Sobra alta</Badge>}
                        {hasShortage && <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Faltou</Badge>}
                        {s.restockDays > 0 && <Badge variant="outline" className="text-[10px]">Repôs</Badge>}
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Taxa de aproveitamento</span>
                        <span className="font-medium">{Math.round(s.utilizationRate)}%</span>
                      </div>
                      <Progress value={s.utilizationRate} className="h-2" />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Méd. Exposto</p>
                        <p className="text-sm font-bold">{s.avgExposed.toFixed(1)}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Méd. Vendido</p>
                        <p className="text-sm font-bold text-primary">{s.avgSold.toFixed(1)}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Méd. Sobra</p>
                        <p className="text-sm font-bold text-warning">{s.avgLeftover.toFixed(1)}</p>
                      </div>
                    </div>

                    {/* Shortage/restock info */}
                    {(hasShortage || s.restockDays > 0) && (
                      <div className="flex gap-3 mt-3 text-xs">
                        {hasShortage && (
                          <div className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Faltou em {s.shortageDays} dia(s)</span>
                          </div>
                        )}
                        {s.restockDays > 0 && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <RotateCcw className="h-3 w-3" />
                            <span>Repôs em {s.restockDays} dia(s)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
