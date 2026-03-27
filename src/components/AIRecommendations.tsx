import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, RotateCcw, Loader2, Brain, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  salgados: { icon: '🥟', label: 'Salgados' },
  doces: { icon: '🍬', label: 'Doces' },
  bolos: { icon: '🍰', label: 'Bolos' },
  agua: { icon: '💧', label: 'Água' },
  refrigerante: { icon: '🥤', label: 'Refrigerante' },
};

interface Recommendation {
  category: string;
  suggested_quantity: number;
  confidence: string;
  reasoning: string;
}

interface HistoricalSummary {
  avg_sold: number;
  avg_leftover: number;
  avg_exposed: number;
  shortage_count: number;
  restock_count: number;
  total_records: number;
  same_day_avg_sold: number;
  same_day_records: number;
}

interface Props {
  businessDate: string;
  userId: string;
  onRecommendationsLoaded?: (recs: Recommendation[]) => void;
}

export default function AIRecommendations({ businessDate, userId, onRecommendationsLoaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generalInsight, setGeneralInsight] = useState('');
  const [historicalSummary, setHistoricalSummary] = useState<Record<string, HistoricalSummary>>({});
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-recommendations`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ business_date: businessDate, user_id: userId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        if (resp.status === 429) {
          toast.error('Limite de requisições excedido. Tente novamente em alguns segundos.');
        } else if (resp.status === 402) {
          toast.error('Créditos de IA esgotados. Adicione créditos nas configurações.');
        } else {
          toast.error(err.error || 'Erro ao buscar recomendações');
        }
        return;
      }

      const data = await resp.json();
      setRecommendations(data.recommendations || []);
      setGeneralInsight(data.general_insight || '');
      setHistoricalSummary(data.historical_summary || {});
      setDayOfWeek(data.day_of_week || '');
      setLoaded(true);
      onRecommendationsLoaded?.(data.recommendations || []);
    } catch (e) {
      toast.error('Erro de conexão ao buscar recomendações');
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (c: string) => {
    const lower = c?.toLowerCase();
    if (lower === 'alta') return 'bg-income/10 text-income border-income/20';
    if (lower === 'média' || lower === 'media') return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-muted text-muted-foreground';
  };

  const toggleExpand = (cat: string) => {
    setExpandedCards(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (!loaded) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-sm">Recomendação Inteligente</p>
            <p className="text-xs text-muted-foreground">
              A IA analisa vendas, sobras e faltas dos últimos 30 dias para sugerir quantidades ideais de exposição.
            </p>
          </div>
          <Button
            onClick={fetchRecommendations}
            disabled={loading}
            className="h-11 gap-2"
            variant="default"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Recomendações
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Recomendações IA
          </CardTitle>
          <Badge variant="outline" className="text-[10px] capitalize">{dayOfWeek}</Badge>
        </div>
        {generalInsight && (
          <p className="text-xs text-muted-foreground mt-1">{generalInsight}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {recommendations.map(rec => {
          const meta = CATEGORY_META[rec.category] || { icon: '📦', label: rec.category };
          const hist = historicalSummary[rec.category];
          const expanded = expandedCards[rec.category] ?? false;

          return (
            <div
              key={rec.category}
              className="rounded-xl border bg-card p-3 transition-all"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() => toggleExpand(rec.category)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{meta.icon}</span>
                  <div className="text-left">
                    <p className="font-semibold text-sm">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Sugestão: <span className="font-bold text-primary text-sm">{rec.suggested_quantity}</span> un.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] capitalize ${confidenceColor(rec.confidence)}`}>
                    {rec.confidence}
                  </Badge>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {expanded && (
                <div className="mt-3 space-y-2.5 border-t pt-3">
                  {/* AI reasoning */}
                  <div className="rounded-lg bg-primary/5 p-2.5">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <Brain className="h-3 w-3 inline mr-1 text-primary" />
                      {rec.reasoning}
                    </p>
                  </div>

                  {/* Historical stats */}
                  {hist && hist.total_records > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Média vendida</p>
                        <p className="font-bold text-sm">{hist.avg_sold}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Média sobra</p>
                        <p className="font-bold text-sm">{hist.avg_leftover}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Média exposta</p>
                        <p className="font-bold text-sm">{hist.avg_exposed}</p>
                      </div>
                    </div>
                  )}

                  {/* Indicators */}
                  {hist && (
                    <div className="flex flex-wrap gap-1.5">
                      {hist.shortage_count > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Faltou {hist.shortage_count}x
                        </Badge>
                      )}
                      {hist.restock_count > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Repôs {hist.restock_count}x
                        </Badge>
                      )}
                      {hist.same_day_records > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {hist.same_day_avg_sold} vendidos ({dayOfWeek})
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {hist.total_records} dias de dados
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={fetchRecommendations}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
          Atualizar recomendações
        </Button>
      </CardContent>
    </Card>
  );
}
