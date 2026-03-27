import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { PenLine } from 'lucide-react';

export interface ManualItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: ManualItem) => void;
}

export default function ManualItemDialog({ open, onOpenChange, onAdd }: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setQuantity(1);
      setUnitPrice('');
      setNotes('');
    }
  }, [open]);

  const lineTotal = quantity * (Number(unitPrice) || 0);

  const confirm = () => {
    if (!name.trim()) { toast.error('Informe o nome do item.'); return; }
    const price = Number(unitPrice);
    if (!price || price <= 0) { toast.error('Informe um valor unitário válido.'); return; }
    if (quantity <= 0) { toast.error('Quantidade inválida.'); return; }

    onAdd({
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      quantity,
      unitPrice: price,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            Item Avulso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome do item *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-12" placeholder="Ex: Salgado especial" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} className="h-12" min={1} />
            </div>
            <div>
              <Label>Valor unitário (R$)</Label>
              <Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="h-12" placeholder="0,00" />
            </div>
          </div>
          {lineTotal > 0 && (
            <div className="flex justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="financial-value text-base font-bold text-primary">{formatCurrency(lineTotal)}</span>
            </div>
          )}
          <div>
            <Label>Observação</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-12" placeholder="Opcional" />
          </div>
          <Button className="h-12 w-full text-base" onClick={confirm}>
            Adicionar ao Carrinho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
