import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { todayISO, formatCurrency } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowRightLeft, Shield } from 'lucide-react';

const TRANSFER_REASONS = [
  { value: 'troca_turno', label: 'Troca de turno' },
  { value: 'saida_antecipada', label: 'Saída antecipada' },
  { value: 'pausa_operacional', label: 'Pausa operacional' },
  { value: 'continuidade_atendimento', label: 'Necessidade de continuidade do atendimento' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closingId: string;
  businessDate: string;
  currentStats: { sales: number; income: number; expense: number };
  openingBalance: number;
  onTransferred: () => void;
}

export default function CashTransferDialog({ open, onOpenChange, closingId, businessDate, currentStats, openingBalance, onTransferred }: Props) {
  const { profile } = useAuth();
  const [cashiers, setCashiers] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedCashier, setSelectedCashier] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    // Fetch active approved cashiers (excluding self)
    supabase
      .rpc('get_eligible_transfer_cashiers', { _exclude_user_id: profile.id })
      .then(({ data }) => {
        if (data) setCashiers(data as { id: string; full_name: string }[]);
      });
  }, [open, profile]);

  const handleSubmit = async () => {
    if (!profile || !selectedCashier || !reason) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    const finalReason = reason === 'outro' ? customReason : TRANSFER_REASONS.find(r => r.value === reason)?.label || reason;
    if (!finalReason.trim()) {
      toast.error('Informe o motivo da transferência.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('cash_session_transfers').insert({
      cash_closing_id: closingId,
      business_date: businessDate,
      from_user_id: profile.id,
      to_user_id: selectedCashier,
      transfer_reason: finalReason,
      notes: notes || null,
    } as any);

    if (error) {
      toast.error('Erro ao solicitar transferência: ' + error.message);
    } else {
      toast.success('Transferência solicitada! Aguardando aceitação.');
      onOpenChange(false);
      setSelectedCashier('');
      setReason('');
      setCustomReason('');
      setNotes('');
      onTransferred();
    }
    setLoading(false);
  };

  const expectedBalance = openingBalance + currentStats.sales + currentStats.income - currentStats.expense;
  const selectedName = cashiers.find(c => c.id === selectedCashier)?.full_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden p-0 sm:max-h-[85vh] sm:w-full">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir Caixa
          </DialogTitle>
          <DialogDescription>
            Solicite a transferência de responsabilidade do caixa para outro operador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-4 pt-4 safe-bottom">
            {/* Current session summary */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <p className="font-medium">Resumo da sessão atual</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Saldo inicial:</span><span className="text-right font-medium">{formatCurrency(openingBalance)}</span>
                <span>Vendas:</span><span className="text-right font-medium">{formatCurrency(currentStats.sales)}</span>
                <span>Entradas:</span><span className="text-right font-medium">{formatCurrency(currentStats.income)}</span>
                <span>Saídas:</span><span className="text-right font-medium">{formatCurrency(currentStats.expense)}</span>
                <span className="font-semibold">Saldo esperado:</span><span className="text-right font-semibold">{formatCurrency(expectedBalance)}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">De</Label>
              <Input value={profile?.full_name || ''} disabled className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-semibold">Para *</Label>
              <Select value={selectedCashier} onValueChange={setSelectedCashier}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o operador" />
                </SelectTrigger>
                <SelectContent>
                  {cashiers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Motivo *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFER_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              {reason === 'outro' && (
                <>
                  <Label className="text-xs font-semibold">Descreva o motivo *</Label>
                  <Input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Motivo..." className="mt-1" />
                </>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações (opcional)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações..." className="mt-1" />
            </div>

            {/* Security notice */}
            <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div className="space-y-1">
                <p>A responsabilidade será transferida <strong>somente após aceitação</strong> do outro operador.</p>
                <p>Todas as ações ficarão <strong>registradas em auditoria</strong>.</p>
              </div>
            </div>

            {selectedName && (
              <p className="text-xs text-muted-foreground text-center">
                {selectedName} receberá uma notificação para aceitar a transferência.
              </p>
            )}

            <Button className="h-12 w-full" onClick={handleSubmit} disabled={loading || !selectedCashier || !reason}>
              {loading ? 'Solicitando...' : 'Solicitar Transferência'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
