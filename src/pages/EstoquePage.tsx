import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, todayISO, toLocalISODate } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, Search, AlertTriangle, PackageX, PackageCheck, Settings,
} from 'lucide-react';

interface ProductStock {
  id: string;
  name: string;
  category: string;
  quantity_in_stock: number;
  minimum_stock_level: number | null;
  unit_price: number;
  is_active: boolean;
}

type StockStatus = 'normal' | 'low' | 'zero' | 'no_min';

function getStockStatus(p: ProductStock): StockStatus {
  if (p.quantity_in_stock <= 0) return 'zero';
  if (p.minimum_stock_level != null && p.quantity_in_stock <= p.minimum_stock_level) return 'low';
  if (p.minimum_stock_level == null) return 'no_min';
  return 'normal';
}

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'bg-primary/10 text-primary border-primary/20' },
  low: { label: 'Baixo', color: 'bg-warning/10 text-warning border-warning/20' },
  zero: { label: 'Zerado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  no_min: { label: 'Sem mínimo', color: 'bg-muted text-muted-foreground border-border' },
};

export default function EstoquePage() {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalISODate(d);
  });
  const [endDate, setEndDate] = useState(todayISO());
  const [consumption, setConsumption] = useState<Record<string, { sold: number; fiado: number }>>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchConsumption();
  }, [startDate, endDate]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, category, quantity_in_stock, minimum_stock_level, unit_price, is_active')
      .order('name');
    if (data) setProducts(data as any);
  };

  const fetchConsumption = async () => {
    // Sales consumption
    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('product_id, quantity, sale_id')
      .not('product_id', 'is', null);

    // Filter by date via sales table
    const { data: sales } = await supabase
      .from('sales')
      .select('id, business_date')
      .gte('business_date', startDate)
      .lte('business_date', endDate)
      .eq('is_deleted', false);

    const salesIds = new Set(sales?.map(s => s.id) || []);

    // Fiado consumption
    const { data: fiadoItems } = await supabase
      .from('spr_fiado_charge_items')
      .select('product_id, quantity, charge_id')
      .not('product_id', 'is', null);

    const { data: charges } = await supabase
      .from('spr_fiado_charges')
      .select('id, business_date')
      .gte('business_date', startDate)
      .lte('business_date', endDate);

    const chargeIds = new Set(charges?.map(c => c.id) || []);

    const map: Record<string, { sold: number; fiado: number }> = {};
    saleItems?.forEach(si => {
      if (si.product_id && salesIds.has(si.sale_id)) {
        if (!map[si.product_id]) map[si.product_id] = { sold: 0, fiado: 0 };
        map[si.product_id].sold += si.quantity;
      }
    });
    fiadoItems?.forEach(fi => {
      if (fi.product_id && chargeIds.has(fi.charge_id)) {
        if (!map[fi.product_id]) map[fi.product_id] = { sold: 0, fiado: 0 };
        map[fi.product_id].fiado += fi.quantity;
      }
    });
    setConsumption(map);
  };

  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const enriched = useMemo(() => {
    return products.map(p => {
      const c = consumption[p.id] || { sold: 0, fiado: 0 };
      const totalConsumed = c.sold + c.fiado;
      const avgDaily = totalConsumed / days;
      const status = getStockStatus(p);
      return { ...p, ...c, totalConsumed, avgDaily, status };
    });
  }, [products, consumption, days]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
    }
    if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter);
    }
    return list;
  }, [enriched, search, statusFilter]);

  const totalZero = enriched.filter(p => p.status === 'zero').length;
  const totalLow = enriched.filter(p => p.status === 'low').length;
  const totalNoMin = enriched.filter(p => p.status === 'no_min').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6 text-primary" />
        <h1 className="page-title">Relatório de Estoque</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="stat-card flex flex-col items-center py-3">
          <PackageX className="h-4 w-4 text-destructive mb-1" />
          <span className="text-lg font-bold text-destructive">{totalZero}</span>
          <span className="text-[10px] text-muted-foreground">Zerados</span>
        </div>
        <div className="stat-card flex flex-col items-center py-3">
          <AlertTriangle className="h-4 w-4 text-warning mb-1" />
          <span className="text-lg font-bold text-warning">{totalLow}</span>
          <span className="text-[10px] text-muted-foreground">Estoque Baixo</span>
        </div>
        <div className="stat-card flex flex-col items-center py-3">
          <Settings className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-lg font-bold">{totalNoMin}</span>
          <span className="text-[10px] text-muted-foreground">Sem Mínimo</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10" />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="zero">Zerado</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="no_min">Sem mínimo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          filtered.map(p => {
            const statusCfg = STATUS_CONFIG[p.status];
            return (
              <Card key={p.id} className={`overflow-hidden ${!p.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.category}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ml-2 ${statusCfg.color}`}>
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-1.5">
                      <p className="text-[9px] text-muted-foreground">Estoque</p>
                      <p className={`text-sm font-bold ${p.quantity_in_stock <= 0 ? 'text-destructive' : ''}`}>
                        {p.quantity_in_stock}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-1.5">
                      <p className="text-[9px] text-muted-foreground">Mínimo</p>
                      <p className="text-sm font-bold">{p.minimum_stock_level ?? '—'}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-1.5">
                      <p className="text-[9px] text-muted-foreground">Vendido</p>
                      <p className="text-sm font-bold text-primary">{p.sold}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-1.5">
                      <p className="text-[9px] text-muted-foreground">Fiado</p>
                      <p className="text-sm font-bold">{p.fiado}</p>
                    </div>
                  </div>
                  {p.avgDaily > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Consumo médio: {p.avgDaily.toFixed(1)} un/dia • Duração estimada: {p.quantity_in_stock > 0 ? Math.floor(p.quantity_in_stock / p.avgDaily) : 0} dia(s)
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
