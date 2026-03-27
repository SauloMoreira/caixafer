import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { todayISO, formatDate } from '@/lib/constants';
import { toast } from 'sonner';
import { AlertTriangle, Unlock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  pendingDate?: string | null; // if there's a previous day that needs closing
  onOpened: () => void;
}

export default function CashOpeningDialog({ open, onOpenChange, userId, pendingDate, onOpened }: Props) {
  const [openingBalance, setOpeningBalance] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    if (pendingDate) {
      toast.error(`Feche o caixa do dia ${formatDate(pendingDate)} antes de abrir um novo.`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('cash_closings').insert({
      business_date: todayISO(),
      user_id: userId,
      opening_balance: Number(openingBalance),
      notes: notes || null,
      status: 'open' as const,
    });
    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast.error('Já existe caixa aberto para hoje.');
      } else {
        toast.error('Erro ao abrir caixa: ' + error.message);
      }
    } else {
      toast.success('Caixa aberto com sucesso!');
      onOpened();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-primary" />
            Abrir Caixa
          </DialogTitle>
          <DialogDescription>Informe o saldo inicial para iniciar o dia.</DialogDescription>
        </DialogHeader>

        {pendingDate && (
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-warning text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>O caixa do dia <strong>{formatDate(pendingDate)}</strong> está em aberto. Feche-o antes de abrir um novo dia.</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label>Saldo Inicial (R$)</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              className="h-12"
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
          <Button
            className="h-12 w-full"
            onClick={handleOpen}
            disabled={loading || !!pendingDate}
          >
            {loading ? 'Abrindo...' : 'Abrir Caixa do Dia'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
