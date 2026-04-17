import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO, PAYMENT_METHODS, DOCUMENT_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BookOpen, ShoppingBag, Banknote, HeartHandshake, Store } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Enums']['payment_method'];
type DocumentType = Database['public']['Enums']['document_type'];

export const QUICK_INCOME_CATEGORIES = [
  { value: 'biblioteca', label: 'Biblioteca', icon: BookOpen },
  { value: 'bazar', label: 'Bazar', icon: ShoppingBag },
  { value: 'mensalidade', label: 'Mensalidade', icon: Banknote },
  { value: 'doacao', label: 'Doação', icon: HeartHandshake },
  { value: 'balcao', label: 'Balcão', icon: Store },
] as const;

type QuickCategory = typeof QUICK_INCOME_CATEGORIES[number]['value'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: QuickCategory | null;
}

export default function QuickIncomeDialog({ open, onOpenChange, category }: Props) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('dinheiro');
  const [docType, setDocType] = useState<DocumentType>('sem_documento');
  const [docRef, setDocRef] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setPayMethod('dinheiro');
      setDocType('sem_documento');
      setDocRef('');
      setNotes('');
    }
  }, [open]);

  const catInfo = QUICK_INCOME_CATEGORIES.find(c => c.value === category);
  if (!catInfo) return null;

  const Icon = catInfo.icon;

  const confirm = async () => {
    if (!profile) return;
    const val = Number(amount);
    if (!val || val <= 0) { toast.error('Informe um valor válido.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from('cash_entries').insert({
        entry_type: 'income',
        category: catInfo.value,
        description: `Entrada rápida - ${catInfo.label}`,
        business_date: todayISO(),
        amount: val,
        payment_method: payMethod,
        document_type: docType,
        document_reference: docRef || null,
        notes: notes || null,
        created_by: profile.id,
        source_type: 'quick_income',
      });
      if (error) throw error;

      toast.success(`${catInfo.label}: ${formatCurrency(val)} registrado!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao registrar entrada: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {catInfo.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="h-12 text-lg"
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div>
            <Label>Forma de Pagamento</Label>
            <Select value={payMethod} onValueChange={v => setPayMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Documento</Label>
            <Select value={docType} onValueChange={v => setDocType(v as DocumentType)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>{DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Referência do Documento</Label>
            <Input value={docRef} onChange={e => setDocRef(e.target.value)} className="h-12" placeholder="Opcional" />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-12" placeholder="Opcional" />
          </div>

          <Button className="h-12 w-full text-base" onClick={confirm} disabled={loading}>
            {loading ? 'Registrando...' : `Confirmar ${formatCurrency(Number(amount) || 0)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
