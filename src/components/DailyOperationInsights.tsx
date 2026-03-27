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
import { toast } from 'sonner';
import { logSecurityEvent } from '@/lib/security';
import {
  Package, TrendingDown, TrendingUp, AlertTriangle,
  Check, RotateCcw, Save, ChevronDown, ChevronUp
} from 'lucide-react';

const CATEGORIES = [
  { value: 'salgados', label: 'Salgados', icon: '🥟', color: 'bg-amber-50 border-amber-200' },
  { value: 'doces', label: 'Doces', icon: '🍬', color: 'bg-pink-50 border-pink-200' },
  { value: 'bolos', label: 'Bolos', icon: '🍰', color: 'bg-purple-50 border-purple-200' },
  { value: 'agua', label: 'Água', icon: '💧', color: 'bg-blue-50 border-blue-200' },
  { value: 'refrigerante', label: 'Refrigerante', icon: '🥤', color: 'bg-green-50 border-green-200' },
];

interface CategoryData {
  id?: string;
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

export default function DailyOperationInsights({ businessDate, disabled = false }: Props) {
  const { profile } = useAuth();
  const [data, setData] = useState<Record<string, CategoryData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [warnings, setWarnings] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchData();
  }, [businessDate, profile]);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // Fetch existing insights
    const { data: existing } = await supabase
      .from('daily_operation_insights')
      .select('*')
      .eq('business_date', businessDate)
      .eq('user_id', profile.id);

    // Fetch sold quantities from sales
    const { data: salesData } = await supabase
      .from('sales')
      .select('id, is_deleted')
      .eq('business_date', businessDate)
      .eq('created_by', profile.id);

    const activeSaleIds = (salesData || [])
      .filter((s: any) => !s.is_deleted)
      .map((s: any) => s.id);

    let soldByCategory: Record<string, number> = {};
    if (activeSaleIds.length > 0) {
      const { data: items } = await supabase
        .from('sale_items')
        .select('quantity, product_id')
        .in('sale_id', activeSaleIds);

      if (items && items.length > 0) {
        const productIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))];
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, category')
            .in('id', productIds);

          const catMap: Record<string, string> = {};
          (products || []).forEach((p: any) => { catMap[p.id] = p.category; });

          items.forEach((item: any) => {
            const cat = catMap[item.product_id] || 'geral';
            const normalizedCat = normalizeCat(cat);
            soldByCategory[normalizedCat] = (soldByCategory[normalizedCat] || 0) + (item.quantity || 0);
          });
        }
      }
    }

    const result: Record<string, CategoryData> = {};
    CATEGORIES.forEach(cat => {
      const existingRow = (existing || []).find((e: any) => e.category === cat.value);
      const sold = soldByCategory[cat.value] || 0;
      if (existingRow) {
        result[cat.value] = {
          id: existingRow.id,
          category: cat.value,
          suggested_quantity: existingRow.suggested_quantity || 0,
          exposed_quantity: existingRow.exposed_quantity || 0,
          sold_quantity: sold || existingRow.sold_quantity || 0,
          leftover_quantity: existingRow.leftover_quantity || 0,
          had_shortage: existingRow.had_shortage || false,
          had_restock: existingRow.had_restock || false,
          notes: existingRow.notes || '',
        };
      } else {
        result[cat.value] = {
          category: cat.value,
          suggested_quantity: 0,
          exposed_quantity: 0,
          sold_quantity: sold,
          leftover_quantity: 0,
          had_shortage: false,
          had_restock: false,
          notes: '',
        };
      }
    });

    setData(result);
    setLoading(false);
  }, [businessDate, profile]);

  const normalizeCat = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('salgado')) return 'salgados';
    if (lower.includes('doce')) return 'doces';
    if (lower.includes('bolo')) return 'bolos';
    if (lower.includes('agua') || lower.includes('água')) return 'agua';
    if (lower.includes('refrigerante')) return 'refrigerante';
    return lower;
  };

  const updateField = (category: string, field: keyof CategoryData, value: any) => {
    setData(prev => {
      const updated = { ...prev[category], [field]: value };

      // Auto-calculate leftover when exposed changes
      if (field === 'exposed_quantity') {
        const exposed = Number(value) || 0;
        const sold = updated.sold_quantity || 0;
        updated.leftover_quantity = Math.max(0, exposed - sold);
      }

      return { ...prev, [category]: updated };
    });
  };

  useEffect(() => {
    // Validate
    const w: Record<string, string[]> = {};
    Object.entries(data).forEach(([cat, d]) => {
      const catWarnings: string[] = [];
      if (d.exposed_quantity > 0 && d.sold_quantity > d.exposed_quantity && !d.had_restock) {
        catWarnings.push('Vendido maior que exposto sem reposição marcada');
      }
      if (d.leftover_quantity > d.exposed_quantity && d.exposed_quantity > 0) {
        catWarnings.push('Sobra maior que quantidade exposta');
      }
      if (catWarnings.length > 0) w[cat] = catWarnings;
    });
    setWarnings(w);
  }, [data]);

  const toggleExpand = (cat: string) => {
    setExpandedCards(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      for (const cat of CATEGORIES) {
        const d = data[cat.value];
        if (!d) continue;

        const row = {
          business_date: businessDate,
          user_id: profile.id,
          category: cat.value,
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
          const oldData = { ...d };
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
            old_data: oldData as any,
            new_data: row as any,
            severity: 'info',
          });
        } else {
          const { data: inserted, error } = await supabase
            .from('daily_operation_insights')
            .insert(row)
            .select('id')
            .single();
          if (error) throw error;

          setData(prev => ({
            ...prev,
            [cat.value]: { ...prev[cat.value], id: inserted.id },
          }));

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-primary" />
          Operação do Dia
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Registre sobras, faltas e reposições para melhorar a inteligência do sistema.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {CATEGORIES.map(cat => {
          const d = data[cat.value];
          if (!d) return null;
          const expanded = expandedCards[cat.value] ?? false;
          const catWarnings = warnings[cat.value] || [];
          const hasData = d.exposed_quantity > 0 || d.had_shortage || d.had_restock;

          return (
            <div
              key={cat.value}
              className={`rounded-xl border p-3 transition-all ${cat.color}`}
            >
              {/* Header - always visible */}
              <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() => toggleExpand(cat.value)}
                disabled={disabled}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="font-semibold text-sm">{cat.label}</span>
                  {hasData && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      <Check className="h-3 w-3" />
                    </Badge>
                  )}
                  {catWarnings.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      <AlertTriangle className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasData && !expanded && (
                    <span className="text-xs text-muted-foreground">
                      {d.sold_quantity}v · {d.leftover_quantity}s
                    </span>
                  )}
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded content */}
              {expanded && (
                <div className="mt-3 space-y-3">
                  {/* Summary row */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Sugerido</p>
                      <p className="font-bold text-sm">{d.suggested_quantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Vendido</p>
                      <p className="font-bold text-sm text-primary">{d.sold_quantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Exposto</p>
                      <Input
                        type="number"
                        min="0"
                        value={d.exposed_quantity || ''}
                        onChange={e => updateField(cat.value, 'exposed_quantity', Math.max(0, Number(e.target.value)))}
                        className="h-8 text-center text-sm font-bold bg-background/80"
                        disabled={disabled}
                        placeholder="0"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Sobra</p>
                      <Input
                        type="number"
                        min="0"
                        value={d.leftover_quantity || ''}
                        onChange={e => updateField(cat.value, 'leftover_quantity', Math.max(0, Number(e.target.value)))}
                        className="h-8 text-center text-sm font-bold bg-background/80"
                        disabled={disabled}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                        <Label className="text-xs font-medium">Faltou produto?</Label>
                      </div>
                      <Switch
                        checked={d.had_shortage}
                        onCheckedChange={v => updateField(cat.value, 'had_shortage', v)}
                        disabled={disabled}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5 text-primary" />
                        <Label className="text-xs font-medium">Houve reposição?</Label>
                      </div>
                      <Switch
                        checked={d.had_restock}
                        onCheckedChange={v => updateField(cat.value, 'had_restock', v)}
                        disabled={disabled}
                      />
                    </div>
                  </div>

                  {/* Warnings */}
                  {catWarnings.length > 0 && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2">
                      {catWarnings.map((w, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <Textarea
                    placeholder="Observação (ex: evento especial, movimento atípico...)"
                    value={d.notes}
                    onChange={e => updateField(cat.value, 'notes', e.target.value)}
                    className="min-h-[60px] text-xs bg-background/80"
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Save button */}
        {!disabled && (
          <Button
            className="w-full h-12"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Operação do Dia'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
