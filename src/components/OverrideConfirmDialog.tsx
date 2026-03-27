import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ShieldAlert } from 'lucide-react';

const OVERRIDE_REASONS = [
  { value: 'contingencia_operacional', label: 'Contingência operacional' },
  { value: 'ausencia_operador', label: 'Ausência do operador responsável' },
  { value: 'erro_critico', label: 'Erro crítico' },
  { value: 'correcao_emergencial', label: 'Correção emergencial' },
  { value: 'continuidade_atendimento', label: 'Continuidade do atendimento' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionLabel: string;
  responsibleName: string | null;
  onConfirm: (reason: string) => void;
}

export default function OverrideConfirmDialog({ open, onOpenChange, actionLabel, responsibleName, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const finalReason = reason === 'outro'
    ? customReason
    : OVERRIDE_REASONS.find(r => r.value === reason)?.label || reason;

  const canConfirm = reason && (reason !== 'outro' || customReason.trim().length > 0);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(finalReason);
    setReason('');
    setCustomReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Permissão Excepcional
          </DialogTitle>
          <DialogDescription>
            Você está usando permissão excepcional de contingência. Esta ação será totalmente auditada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
            <p className="font-medium text-destructive">Ação: {actionLabel}</p>
            {responsibleName && (
              <p className="text-muted-foreground">
                Responsável atual: <strong>{responsibleName}</strong>
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold">Motivo obrigatório *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1 h-12">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === 'outro' && (
            <div>
              <Label className="text-xs font-semibold">Descreva o motivo *</Label>
              <Input
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Motivo da ação excepcional..."
                className="mt-1 h-12"
              />
            </div>
          )}

          <Button
            className="h-12 w-full"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Confirmar com Override
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
