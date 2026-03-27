import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { todayISO, formatDate } from '@/lib/constants';
import { toast } from 'sonner';
import { AlertTriangle, Lock, Unlock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  pendingDate?: string | null;
  onOpened: () => void;
}

export default function CashOpeningDialog({ open, onOpenChange, userId, pendingDate, onOpened }: Props) {
  const [openingBalance, setOpeningBalance] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingOpenByOther, setExistingOpenByOther] = useState<{ responsibleName: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setExistingOpenByOther(null);
    // Check if another user already has an open session today
    (async () => {
      const { data: openSessions } = await supabase
        .from('cash_closings')
        .select('current_responsible_id')
        .eq('business_date', todayISO())
        .eq('status', 'open')
        .eq('is_latest_version', true)
        .limit(1);
      if (openSessions && openSessions.length > 0 && openSessions[0].current_responsible_id !== userId) {
        const { data: names } = await supabase.rpc('get_user_names', { _user_ids: [openSessions[0].current_responsible_id] });
        setExistingOpenByOther({ responsibleName: names?.[0]?.full_name || 'outro operador' });
      }
    })();
  }, [open, userId]);

  const handleOpen = async () => {
    if (pendingDate) {
      toast.error(`Feche o caixa do dia ${formatDate(pendingDate)} antes de abrir um novo.`);
      return;
    }
    if (existingOpenByOther) {
      toast.error(`Caixa já foi aberto por ${existingOpenByOther.responsibleName}.`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('cash_closings').insert({
      business_date: todayISO(),
      user_id: userId,
      current_responsible_id: userId,
      opening_balance: Number(openingBalance),
      notes: notes || null,
      status: 'open' as const,
    });
    if (error) {
      if (error.message.includes('idx_one_open_cash_per_day') || error.message.includes('unique') || error.message.includes('duplicate')) {
        toast.error('Já existe um caixa aberto para hoje.');
        const { logSecurityEvent } = await import('@/lib/security');
        logSecurityEvent({
          event_type: 'cash_open_blocked_existing_open_session',
          entity_type: 'cash_closings',
          action: 'INSERT_BLOCKED',
          business_date: todayISO(),
          severity: 'medium',
          notes: `Tentativa de abertura bloqueada via PDV. Já existe caixa aberto.`,
        });
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

  const isBlocked = !!pendingDate || !!existingOpenByOther;

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

        {existingOpenByOther && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-1">
            <div className="flex items-start gap-2">
              <Lock className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive">Caixa já aberto</p>
                <p className="text-sm text-destructive/90">
                  Caixa já foi aberto por <strong>{existingOpenByOther.responsibleName}</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  Se você precisa fazer o caixa, solicite a transferência da responsabilidade.
                </p>
              </div>
            </div>
          </div>
        )}

        {!existingOpenByOther && (
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
              disabled={loading || isBlocked}
            >
              {loading ? 'Abrindo...' : 'Abrir Caixa do Dia'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
