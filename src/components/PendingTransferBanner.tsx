import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { todayISO, formatDateTime } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CashTransferReceivedDialog from '@/components/CashTransferReceivedDialog';
import { toast } from 'sonner';
import { ArrowRightLeft, Check, X, Clock } from 'lucide-react';

interface Transfer {
  id: string;
  cash_closing_id: string;
  business_date: string;
  from_user_id: string;
  to_user_id: string;
  transfer_reason: string;
  notes: string | null;
  status: string;
  requested_at: string;
  accepted_at?: string | null;
  accepted_by?: string | null;
  requested_by?: string | null;
  session_id?: string | null;
  snapshot_initial_balance?: number | null;
  snapshot_sales_total?: number | null;
  snapshot_income_total?: number | null;
  snapshot_expense_total?: number | null;
  snapshot_expected_balance?: number | null;
  snapshot_cash_total?: number | null;
  snapshot_pix_total?: number | null;
  snapshot_debit_total?: number | null;
  snapshot_credit_total?: number | null;
  snapshot_bank_transfer_total?: number | null;
  snapshot_fiado_payment_total?: number | null;
  snapshot_movement_count?: number | null;
  snapshot_sale_count?: number | null;
  from_name?: string;
  to_name?: string;
  accepted_by_name?: string;
  requested_by_name?: string;
}

interface Props {
  onTransferAccepted: () => void;
  onTransferStatusChanged?: () => void;
}

export default function PendingTransferBanner({ onTransferAccepted, onTransferStatusChanged }: Props) {
  const { profile } = useAuth();
  const [pendingTransfers, setPendingTransfers] = useState<Transfer[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<Transfer[]>([]);
  const [acceptedTransfer, setAcceptedTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTransfers = useCallback(async () => {
    if (!profile) return;
    const today = todayISO();

    // Incoming pending transfers (I need to accept/reject)
    const { data: incoming } = await supabase
      .from('cash_session_transfers')
      .select('*')
      .eq('to_user_id', profile.id)
      .eq('business_date', today)
      .eq('status', 'pending' as any);

    // Outgoing pending transfers (I requested, waiting acceptance)
    const { data: outgoing } = await supabase
      .from('cash_session_transfers')
      .select('*')
      .eq('from_user_id', profile.id)
      .eq('business_date', today)
      .eq('status', 'pending' as any);

    // Fetch names for all involved users
    const userIds = new Set<string>();
    [...(incoming || []), ...(outgoing || [])].forEach(t => {
      userIds.add(t.from_user_id);
      userIds.add(t.to_user_id);
    });

    let nameMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: names } = await supabase
        .rpc('get_user_names', { _user_ids: Array.from(userIds) });
      if (names) {
        nameMap = Object.fromEntries((names as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
      }
    }

    const mapNames = (t: any): Transfer => ({
      ...t,
      from_name: nameMap[t.from_user_id] || 'Desconhecido',
      to_name: nameMap[t.to_user_id] || 'Desconhecido',
      requested_by_name: t.requested_by ? (nameMap[t.requested_by] || 'Desconhecido') : undefined,
      accepted_by_name: t.accepted_by ? (nameMap[t.accepted_by] || 'Desconhecido') : undefined,
    });

    setPendingTransfers((incoming || []).map(mapNames));
    setOutgoingTransfers((outgoing || []).map(mapNames));
  }, [profile]);

  useEffect(() => {
    fetchTransfers();
    const interval = setInterval(fetchTransfers, 30_000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchTransfers]);

  const handleAccept = async (transfer: Transfer) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cash_session_transfers')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: profile?.id } as any)
      .eq('id', transfer.id)
      .select('*')
      .single();

    if (error) {
      toast.error('Erro ao aceitar: ' + error.message);
    } else {
      setAcceptedTransfer({
        ...(data as any),
        from_name: transfer.from_name,
        to_name: transfer.to_name,
        accepted_by_name: profile?.full_name || transfer.to_name,
        requested_by_name: transfer.from_name,
      });
      toast.success('Transferência aceita! Você agora é responsável pelo caixa.');
      onTransferAccepted();
      onTransferStatusChanged?.();
      fetchTransfers();
    }
    setLoading(false);
  };

  const handleReject = async (transfer: Transfer) => {
    setLoading(true);
    const { error } = await supabase
      .from('cash_session_transfers')
      .update({ status: 'rejected' } as any)
      .eq('id', transfer.id);

    if (error) {
      toast.error('Erro ao recusar: ' + error.message);
    } else {
      toast.info('Transferência recusada.');
      onTransferStatusChanged?.();
      fetchTransfers();
    }
    setLoading(false);
  };

  const handleCancel = async (transfer: Transfer) => {
    setLoading(true);
    const { error } = await supabase
      .from('cash_session_transfers')
      .update({ status: 'cancelled' } as any)
      .eq('id', transfer.id);

    if (error) {
      toast.error('Erro ao cancelar: ' + error.message);
    } else {
      toast.info('Solicitação cancelada.');
      onTransferStatusChanged?.();
      fetchTransfers();
    }
    setLoading(false);
  };

  if (pendingTransfers.length === 0 && outgoingTransfers.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Incoming transfers - need my acceptance */}
      {pendingTransfers.map(t => (
        <Card key={t.id} className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold">Transferência de caixa pendente</p>
                <p className="text-xs text-muted-foreground">
                  <strong>{t.from_name}</strong> quer transferir o caixa para você.
                </p>
                <p className="text-xs text-muted-foreground">
                  Motivo: <strong>{t.transfer_reason}</strong>
                </p>
                {t.notes && <p className="text-xs text-muted-foreground">Obs: {t.notes}</p>}
                <p className="text-[10px] text-muted-foreground">
                  Solicitado em {formatDateTime(t.requested_at)}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                <Clock className="h-3 w-3 mr-1" />
                Pendente
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-10" onClick={() => handleAccept(t)} disabled={loading}>
                <Check className="h-4 w-4 mr-1" />
                Aceitar
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-10" onClick={() => handleReject(t)} disabled={loading}>
                <X className="h-4 w-4 mr-1" />
                Recusar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Outgoing transfers - waiting for acceptance */}
      {outgoingTransfers.map(t => (
        <Card key={t.id} className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-warning">Aguardando aceitação</p>
                <p className="text-xs text-muted-foreground">
                  Transferência para <strong>{t.to_name}</strong> está aguardando confirmação.
                </p>
                <p className="text-xs text-muted-foreground">
                  Motivo: {t.transfer_reason}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="w-full h-9 border-warning/40 text-warning" onClick={() => handleCancel(t)} disabled={loading}>
              Cancelar Solicitação
            </Button>
          </CardContent>
        </Card>
      ))}

      <CashTransferReceivedDialog
        transfer={acceptedTransfer}
        open={!!acceptedTransfer}
        onOpenChange={(open) => {
          if (!open) setAcceptedTransfer(null);
        }}
      />
    </div>
  );
}
