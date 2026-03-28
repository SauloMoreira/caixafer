import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, PackageX, PackageCheck, ShoppingCart } from 'lucide-react';

interface ProductStock {
  id: string;
  name: string;
  category: string;
  quantity_in_stock: number;
  minimum_stock_level: number | null;
  is_active: boolean;
}

export default function StockInsightsSection() {
  const [products, setProducts] = useState<ProductStock[]>([]);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, category, quantity_in_stock, minimum_stock_level, is_active')
      .eq('is_active', true)
      .order('quantity_in_stock', { ascending: true })
      .then(({ data }) => {
        if (data) setProducts(data as any);
      });
  }, []);

  const zeroStock = products.filter(p => p.quantity_in_stock <= 0);
  const lowStock = products.filter(
    p => p.minimum_stock_level != null && p.quantity_in_stock > 0 && p.quantity_in_stock <= p.minimum_stock_level
  );

  if (zeroStock.length === 0 && lowStock.length === 0) return null;

  return (
    <>
      {/* Zero stock alert */}
      {zeroStock.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PackageX className="h-4 w-4 text-destructive" />
              Estoque Zerado ({zeroStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {zeroStock.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.category}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 shrink-0">
                    0 un
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <Card className="border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Estoque Baixo ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {lowStock.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.category} • Mínimo: {p.minimum_stock_level}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20 shrink-0">
                    {p.quantity_in_stock} un
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
