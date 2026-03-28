import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; quantity_in_stock: number } | null;
  onAdjusted?: () => void;
}

const MOVEMENT_TYPES = [
  { value: 'purchase_entry', label: 'Entrada de Mercadoria' },
  { value: 'manual_adjustment', label: 'Ajuste de Inventário' },
  { value: 'loss', label: 'Perda / Quebra' },
  { value: 'restock', label: 'Reposição' },
];

export default function StockAdjustmentDialog({ open, onOpenChange, product, onAdjusted }: Props) {
  const { profile } = useAuth();
  const [movementType, setMovementType] = useState('purchase_entry');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!product) return null;

  const isDecrease = movementType === 'loss';
  const quantityNum = parseInt(quantity) || 0;
  const newStock = isDecrease
    ? product.quantity_in_stock - quantityNum
    : movementType === 'manual_adjustment'
      ? quantityNum // manual_adjustment sets to exact value
      : product.quantity_in_stock + quantityNum;

  const handleSave = async () => {
    if (!profile || quantityNum <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    if (isDecrease && quantityNum > product.quantity_in_stock) {
      toast.error('Quantidade de perda maior que o estoque atual.');
      return;
    }

    setLoading(true);
    try {
      let effectiveQuantity = quantityNum;
      let effectiveNewStock = newStock;

      if (movementType === 'manual_adjustment') {
        // Adjustment sets exact value
        effectiveQuantity = Math.abs(quantityNum - product.quantity_in_stock);
        effectiveNewStock = quantityNum;
      }

      // Update product stock
      await supabase
        .from('products')
        .update({ quantity_in_stock: effectiveNewStock } as any)
        .eq('id', product.id);

      // Record movement
      await supabase.from('stock_movements' as any).insert({
        product_id: product.id,
        movement_type: movementType,
        quantity: effectiveQuantity,
        previous_stock: product.quantity_in_stock,
        new_stock: effectiveNewStock,
        notes: notes || null,
        created_by: profile.id,
      });

      toast.success('Estoque atualizado com sucesso!');
      onAdjusted?.();
      onOpenChange(false);
      setQuantity('');
      setNotes('');
      setMovementType('purchase_entry');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Ajustar Estoque
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">{product.name}</p>
            <p className="text-xs text-muted-foreground">
              Estoque atual: <strong>{product.quantity_in_stock}</strong> unidade(s)
            </p>
          </div>

          <div>
            <Label>Tipo de Movimentação</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              {movementType === 'manual_adjustment' ? 'Novo valor do estoque' : 'Quantidade'}
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="h-12"
              placeholder={movementType === 'manual_adjustment' ? 'Ex: 50' : 'Ex: 10'}
            />
          </div>

          {quantityNum > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm">
              <p>
                Estoque atual: <strong>{product.quantity_in_stock}</strong>
              </p>
              <p>
                Novo estoque:{' '}
                <strong className={newStock <= 0 ? 'text-destructive' : 'text-primary'}>
                  {movementType === 'manual_adjustment' ? quantityNum : newStock}
                </strong>
              </p>
            </div>
          )}

          <div>
            <Label>Motivo / Observações</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-12"
              placeholder="Ex: Compra semanal"
            />
          </div>

          <Button className="h-12 w-full" onClick={handleSave} disabled={loading || quantityNum <= 0}>
            {loading ? 'Salvando...' : 'Confirmar Ajuste'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
