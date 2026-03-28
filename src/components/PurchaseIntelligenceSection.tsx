import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, TrendingUp, AlertTriangle, PackageX } from 'lucide-react';

interface ProductStock {
  id: string;
  name: string;
  category: string;
  quantity_in_stock: number;
  minimum_stock_level: number | null;
  is_active: boolean;
}

interface Recommendation {
  product: ProductStock;
  avgDaily: number;
  daysRemaining: number;
  suggestedPurchase: number;
  urgency: 'critica' | 'alta' | 'media' | 'baixa';
  confidence: 'alta' | 'baixa';
}

const URGENCY_CONFIG = {
  critica: { label: 'Crítica', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: PackageX },
  alta: { label: 'Alta', color: 'bg-warning/10 text-warning border-warning/20', icon: AlertTriangle },
  media: { label: 'Média', color: 'bg-primary/10 text-primary border-primary/20', icon: TrendingUp },
  baixa: { label: 'Baixa', color: 'bg-muted text-muted-foreground border-border', icon: ShoppingCart },
};

export default function PurchaseIntelligenceSection() {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [consumption, setConsumption] = useState<Record<string, number>>({});
  const [coverageDays, setCoverageDays] = useState(15);
  const [historyDays] = useState(30);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, category, quantity_in_stock, minimum_stock_level, is_active')
      .eq('is_active', true)
      .order('name');
    if (prods) setProducts(prods as any);

    // Get recent consumption from stock_movements
    const since = new Date();
    since.setDate(since.getDate() - historyDays);
    const sinceStr = since.toISOString().split('T')[0];

    const { data: movements } = await supabase
      .from('stock_movements' as any)
      .select('product_id, quantity, movement_type, created_at')
      .in('movement_type', ['sale', 'fiado'])
      .gte('created_at', sinceStr);

    const map: Record<string, number> = {};
    (movements as any[] || []).forEach((m: any) => {
      map[m.product_id] = (map[m.product_id] || 0) + m.quantity;
    });
    setConsumption(map);
  };

  const recommendations: Recommendation[] = useMemo(() => {
    return products.map(p => {
      const totalConsumed = consumption[p.id] || 0;
      const avgDaily = totalConsumed / historyDays;
      const daysRemaining = avgDaily > 0 ? Math.floor(p.quantity_in_stock / avgDaily) : 999;
      const suggestedPurchase = Math.max(0, Math.ceil((avgDaily * coverageDays) - p.quantity_in_stock));
      const confidence: 'alta' | 'baixa' = totalConsumed >= 5 ? 'alta' : 'baixa';

      let urgency: Recommendation['urgency'] = 'baixa';
      if (p.quantity_in_stock <= 0) urgency = 'critica';
      else if (daysRemaining <= 3) urgency = 'alta';
      else if (daysRemaining <= 7) urgency = 'media';

      return { product: p, avgDaily, daysRemaining, suggestedPurchase, urgency, confidence };
    })
    .filter(r => r.suggestedPurchase > 0 || r.urgency === 'critica')
    .sort((a, b) => {
      const order = { critica: 0, alta: 1, media: 2, baixa: 3 };
      return order[a.urgency] - order[b.urgency];
    });
  }, [products, consumption, coverageDays, historyDays]);

  if (products.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Sugestão de Compra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Dias de cobertura desejados</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            value={coverageDays}
            onChange={e => setCoverageDays(parseInt(e.target.value) || 15)}
            className="h-10 w-32"
          />
        </div>

        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma recomendação de compra no momento. O estoque está adequado.
          </p>
        ) : (
          <div className="space-y-2">
            {recommendations.slice(0, 15).map(r => {
              const cfg = URGENCY_CONFIG[r.urgency];
              return (
                <div key={r.product.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.product.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.product.category}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ml-2 ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-2">
                    <div className="rounded bg-muted/50 p-1.5">
                      <p className="text-[9px] text-muted-foreground">Estoque</p>
                      <p className="text-xs font-bold">{r.product.quantity_in_stock}</p>
                    </div>
                    <div className="rounded bg-muted/50 p-1.5">
                      <p className="text-[9px] text-muted-foreground">Méd/dia</p>
                      <p className="text-xs font-bold">{r.avgDaily.toFixed(1)}</p>
                    </div>
                    <div className="rounded bg-primary/5 p-1.5">
                      <p className="text-[9px] text-primary font-medium">Comprar</p>
                      <p className="text-xs font-bold text-primary">{r.suggestedPurchase}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {r.daysRemaining < 999
                      ? `Duração estimada: ${r.daysRemaining} dia(s)`
                      : 'Sem consumo recente'}
                    {r.confidence === 'baixa' && ' • Baixa confiança (pouco histórico)'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
