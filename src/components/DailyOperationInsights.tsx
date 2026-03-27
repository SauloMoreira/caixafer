import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { logSecurityEvent } from '@/lib/security';
import ProductImage from '@/components/ProductImage';
import {
  Package, TrendingDown, RotateCcw, Save, Check, AlertTriangle
} from 'lucide-react';

interface ProductInsight {
  id?: string;
  product_id: string;
  product_name: string;
  product_image?: string | null;
  category: string;
  suggested_quantity: number;
  exposed_quantity: number;
  sold_quantity: number;
  leftover_quantity: number;
  had_shortage: boolean;
  had_restock: boolean;
  notes: string;
}

interface Props {
  businessDate: string;
  disabled?: boolean;
}

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  salgados: { icon: '🥟', color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' },
  doces: { icon: '🍬', color: 'bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800' },
  bolos: { icon: '🍰', color: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800' },
  agua: { icon: '💧', color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' },
  refrigerante: { icon: '🥤', color: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' },
  geral: { icon: '📦', color: 'bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-800' },
};

function getCategoryMeta(cat: string) {
  const key = cat.toLowerCase();
  return CATEGORY_META[key] || CATEGORY_META.geral;
}

export default function DailyOperationInsights({ businessDate, disabled = false }: Props) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<ProductInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<Record<string, string[]>>({});

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // Fetch active products
    const { data: activeProducts } = await supabase
      .from('products')
      .select('id, name, category, image_url')
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (!activeProducts || activeProducts.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    // Fetch existing insights for this date
    const { data: existing } = await supabase
      .from('daily_operation_insights')
      .select('*')
      .eq('business_date', businessDate)
      .eq('user_id', profile.id)
      .not('product_id', 'is', null);

    // Fetch sold quantities from sales
    const { data: salesData } = await supabase
      .from('sales')
      .select('id, is_deleted')
      .eq('business_date', businessDate)
      .eq('created_by', profile.id);

    const activeSaleIds = (salesData || [])
      .filter((s: any) => !s.is_deleted)
      .map((s: any) => s.id);

    let soldByProduct: Record<string, number> = {};
    if (activeSaleIds.length > 0) {
      const { data: items } = await supabase
        .from('sale_items')
        .select('quantity, product_id')
        .in('sale_id', activeSaleIds);

      (items || []).forEach((item: any) => {
        if (item.product_id) {
          soldByProduct[item.product_id] = (soldByProduct[item.product_id] || 0) + (item.quantity || 0);
        }
      });
    }

    // Build product insights
    const result: ProductInsight[] = activeProducts.map((p: any) => {
      const existingRow = (existing || []).find((e: any) => e.product_id === p.id);
      const sold = soldByProduct[p.id] || 0;

      if (existingRow) {
        return {
          id: existingRow.id,
          product_id: p.id,
          product_name: p.name,
          product_image: p.image_url,
          category: p.category,
          suggested_quantity: existingRow.suggested_quantity || 0,
          exposed_quantity: existingRow.exposed_quantity || 0,
          sold_quantity: sold || existingRow.sold_quantity || 0,
          leftover_quantity: existingRow.leftover_quantity || 0,
          had_shortage: existingRow.had_shortage || false,
          had_restock: existingRow.had_restock || false,
          notes: existingRow.notes || '',
        };
      }
      return {
        product_id: p.id,
        product_name: p.name,
        product_image: p.image_url,
        category: p.category,
        suggested_quantity: 0,
        exposed_quantity: 0,
        sold_quantity: sold,
        leftover_quantity: 0,
        had_shortage: false,
        had_restock: false,
        notes: '',
      };
    });

    setProducts(result);
    setLoading(false);
  }, [businessDate, profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Validate
  useEffect(() => {
    const w: Record<string, string[]> = {};
    products.forEach(d => {
      const pWarnings: string[] = [];
      if (d.exposed_quantity > 0 && d.sold_quantity > d.exposed_quantity && !d.had_restock) {
        pWarnings.push('Vendido maior que exposto sem reposição');
      }
      if (d.leftover_quantity > d.exposed_quantity && d.exposed_quantity > 0) {
        pWarnings.push('Sobra maior que quantidade exposta');
      }
      if (pWarnings.length > 0) w[d.product_id] = pWarnings;
    });
    setWarnings(w);
  }, [products]);

  const updateField = (productId: string, field: keyof ProductInsight, value: any) => {
    setProducts(prev => prev.map(p => {
      if (p.product_id !== productId) return p;
      const updated = { ...p, [field]: value };
      if (field === 'exposed_quantity') {
        const exposed = Number(value) || 0;
        updated.leftover_quantity = Math.max(0, exposed - (updated.sold_quantity || 0));
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      for (const d of products) {
        const row = {
          business_date: businessDate,
          user_id: profile.id,
          category: d.category,
          product_id: d.product_id,
          suggested_quantity: d.suggested_quantity,
          exposed_quantity: d.exposed_quantity,
          sold_quantity: d.sold_quantity,
          leftover_quantity: d.leftover_quantity,
          had_shortage: d.had_shortage,
          had_restock: d.had_restock,
          notes: d.notes || null,
          updated_at: new Date().toISOString(),
        };

        if (d.id) {
          const { error } = await supabase
            .from('daily_operation_insights')
            .update(row)
            .eq('id', d.id);
          if (error) throw error;

          await logSecurityEvent({
            event_type: 'operation_day_updated',
            entity_type: 'daily_operation_insights',
            entity_id: d.id,
            action: 'UPDATE',
            business_date: businessDate,
            new_data: row as any,
            severity: 'info',
          });
        } else {
          // Only save if user entered data
          const hasData = d.exposed_quantity > 0 || d.leftover_quantity > 0 || d.had_shortage || d.had_restock || (d.notes && d.notes.trim());
          if (!hasData) continue;

          const { data: inserted, error } = await supabase
            .from('daily_operation_insights')
            .insert(row)
            .select('id')
            .single();
          if (error) throw error;

          setProducts(prev => prev.map(p =>
            p.product_id === d.product_id ? { ...p, id: inserted.id } : p
          ));

          await logSecurityEvent({
            event_type: 'operation_day_created',
            entity_type: 'daily_operation_insights',
            entity_id: inserted.id,
            action: 'INSERT',
            business_date: businessDate,
            new_data: row as any,
            severity: 'info',
          });
        }
      }

      toast.success('Operação do dia salva com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Nenhum produto ativo cadastrado.
        </CardContent>
      </Card>
    );
  }

  // Group products by category
  const grouped: Record<string, ProductInsight[]> = {};
  products.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  const categories = Object.keys(grouped).sort();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-primary" />
          Operação do Dia
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Registre sobras, faltas e reposições por produto para melhorar a inteligência do sistema.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Accordion type="multiple" className="space-y-2">
          {categories.map(cat => {
            const catProducts = grouped[cat];
            const meta = getCategoryMeta(cat);
            const filledCount = catProducts.filter(p => p.exposed_quantity > 0 || p.had_shortage || p.had_restock).length;
            const catHasWarnings = catProducts.some(p => warnings[p.product_id]?.length > 0);

            return (
              <AccordionItem key={cat} value={cat} className={`rounded-xl border ${meta.color} overflow-hidden`}>
                <AccordionTrigger className="px-3 py-3 hover:no-underline">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-lg">{meta.icon}</span>
                    <span className="font-semibold text-sm capitalize">{cat}</span>
                    <span className="text-xs text-muted-foreground">({catProducts.length})</span>
                    {filledCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto mr-2">
                        <Check className="h-3 w-3 mr-0.5" />{filledCount}
                      </Badge>
                    )}
                    {catHasWarnings && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        <AlertTriangle className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-3">
                    {catProducts.map(product => (
                      <ProductInsightCard
                        key={product.product_id}
                        product={product}
                        warnings={warnings[product.product_id] || []}
                        disabled={disabled}
                        onUpdate={updateField}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {!disabled && (
          <Button className="w-full h-12 mt-2" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Operação do Dia'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Sub-component: each product row
// ──────────────────────────────────────────────

interface ProductCardProps {
  product: ProductInsight;
  warnings: string[];
  disabled: boolean;
  onUpdate: (productId: string, field: keyof ProductInsight, value: any) => void;
}

function ProductInsightCard({ product, warnings, disabled, onUpdate }: ProductCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasData = product.exposed_quantity > 0 || product.had_shortage || product.had_restock;
  const pid = product.product_id;

  return (
    <div className="rounded-lg border bg-background/60 p-2.5 space-y-2">
      {/* Product header */}
      <button
        type="button"
        className="flex w-full items-center gap-2.5 text-left"
        onClick={() => !disabled && setExpanded(!expanded)}
        disabled={disabled && !expanded}
      >
        <ProductImage src={product.product_image} size="sm" alt={product.product_name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{product.product_name}</p>
          {!expanded && hasData && (
            <p className="text-[10px] text-muted-foreground">
              {product.sold_quantity}v · {product.leftover_quantity}s
              {product.had_shortage && ' · faltou'}
            </p>
          )}
        </div>
        {hasData && !expanded && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
            <Check className="h-3 w-3" />
          </Badge>
        )}
        {warnings.length > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
            <AlertTriangle className="h-3 w-3" />
          </Badge>
        )}
      </button>

      {/* Expanded fields */}
      {expanded && (
        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Sugerido</p>
              <p className="font-bold text-sm">{product.suggested_quantity}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Vendido</p>
              <p className="font-bold text-sm text-primary">{product.sold_quantity}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Exposto</p>
              <Input
                type="number"
                min="0"
                value={product.exposed_quantity || ''}
                onChange={e => onUpdate(pid, 'exposed_quantity', Math.max(0, Number(e.target.value)))}
                className="h-8 text-center text-sm font-bold bg-background"
                disabled={disabled}
                placeholder="0"
              />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Sobra</p>
              <Input
                type="number"
                min="0"
                value={product.leftover_quantity || ''}
                onChange={e => onUpdate(pid, 'leftover_quantity', Math.max(0, Number(e.target.value)))}
                className="h-8 text-center text-sm font-bold bg-background"
                disabled={disabled}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <Label className="text-xs font-medium">Faltou produto?</Label>
              </div>
              <Switch
                checked={product.had_shortage}
                onCheckedChange={v => onUpdate(pid, 'had_shortage', v)}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                <Label className="text-xs font-medium">Houve reposição?</Label>
              </div>
              <Switch
                checked={product.had_restock}
                onCheckedChange={v => onUpdate(pid, 'had_restock', v)}
                disabled={disabled}
              />
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}

          <Textarea
            placeholder="Observação (ex: evento especial, movimento atípico...)"
            value={product.notes}
            onChange={e => onUpdate(pid, 'notes', e.target.value)}
            className="min-h-[50px] text-xs bg-background"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
