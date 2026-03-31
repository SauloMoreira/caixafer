import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft } from 'lucide-react';

interface Transfer {
  id: string;
  cash_closing_id: string;
  session_id?: string | null;
  from_user_id: string;
  to_user_id: string;
  requested_by?: string | null;
  accepted_by?: string | null;
  transfer_reason: string;
  status: string;
  requested_at: string;
  accepted_at: string | null;
  notes: string | null;
  snapshot_initial_balance?: number | null;
  snapshot_sales_total?: number | null;
  snapshot_income_total?: number | null;
  snapshot_expense_total?: number | null;
  snapshot_expected_balance?: number | null;
  snapshot_movement_count?: number | null;
  snapshot_sale_count?: number | null;
  from_name?: string;
  to_name?: string;
  accepted_by_name?: string;
}

interface Props {
  closingId: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  accepted: { label: 'Aceita', variant: 'default' },
  pending: { label: 'Pendente', variant: 'outline' },
  rejected: { label: 'Recusada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'secondary' },
};

export default function CashTransferHistory({ closingId }: Props) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  useEffect(() => {
    const fetchTransfers = async () => {
      const { data } = await supabase
        .from('cash_session_transfers')
        .select('*')
        .eq('cash_closing_id', closingId)
        .order('requested_at', { ascending: true });

      if (!data || data.length === 0) {
        setTransfers([]);
        return;
      }

      const userIds = new Set<string>();
      data.forEach((t: any) => {
        userIds.add(t.from_user_id);
        userIds.add(t.to_user_id);
        if (t.accepted_by) userIds.add(t.accepted_by);
      });

      const { data: profiles } = await supabase
        .rpc('get_user_names', { _user_ids: Array.from(userIds) });

      const nameMap = Object.fromEntries((profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

      setTransfers(data.map((t: any) => ({
        ...t,
        session_id: t.session_id || t.cash_closing_id,
        from_name: nameMap[t.from_user_id] || 'Desconhecido',
        to_name: nameMap[t.to_user_id] || 'Desconhecido',
        accepted_by_name: t.accepted_by ? (nameMap[t.accepted_by] || 'Desconhecido') : undefined,
      })));
    };

    fetchTransfers();
  }, [closingId]);

  if (transfers.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <ArrowRightLeft className="h-3 w-3" />
        Transferências de Responsabilidade
      </p>
      {transfers.map(t => {
        const statusInfo = STATUS_MAP[t.status] || { label: t.status, variant: 'outline' as const };
        return (
          <div key={t.id} className="rounded-lg border p-3 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.from_name} → {t.to_name}</span>
              <Badge variant={statusInfo.variant} className="text-[9px]">{statusInfo.label}</Badge>
            </div>
            <p className="text-muted-foreground">Sessão: {t.session_id || t.cash_closing_id}</p>
            <p className="text-muted-foreground">Motivo: {t.transfer_reason}</p>
            <p className="text-muted-foreground">Solicitado: {formatDateTime(t.requested_at)}</p>
            {t.accepted_at && <p className="text-muted-foreground">Aceito: {formatDateTime(t.accepted_at)}</p>}
            {t.accepted_by_name && <p className="text-muted-foreground">Aceito por: {t.accepted_by_name}</p>}
            {t.notes && <p className="text-muted-foreground">Obs: {t.notes}</p>}
            {t.status === 'accepted' && (
              <div className="rounded-md bg-muted/50 p-2 space-y-0.5">
                <p className="font-medium text-muted-foreground">Snapshot salvo:</p>
                <p className="text-muted-foreground">Saldo inicial: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.snapshot_initial_balance || 0))}</p>
                <p className="text-muted-foreground">Vendas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.snapshot_sales_total || 0))} · Entradas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.snapshot_income_total || 0))}</p>
                <p className="text-muted-foreground">Saídas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.snapshot_expense_total || 0))} · Esperado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.snapshot_expected_balance || 0))}</p>
                <p className="text-muted-foreground">{t.snapshot_sale_count || 0} venda(s) · {t.snapshot_movement_count || 0} movimento(s)</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
