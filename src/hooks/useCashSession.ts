import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { todayISO } from '@/lib/constants';
import { logSecurityEvent } from '@/lib/security';

export type CashStatus = 'loading' | 'open' | 'closed_today' | 'none' | 'blocked';

interface CashSessionState {
  loading: boolean;
  sessionOpen: boolean;
  closingId: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  isResponsible: boolean;
  canOperate: boolean;
  isOverrideMode: boolean;
  isTransferredSession: boolean;
  /** Convenience status derived from session state — used by PDV and other screens */
  cashStatus: CashStatus;
  /** business_date of a previous-day open session, if any */
  pendingDate: string | null;
  refresh: () => Promise<void>;
}

/**
 * Single source of truth for the current-day cash session.
 * Uses a SECURITY DEFINER function to bypass RLS so any cashier
 * can see if a session is already open today.
 */
export function useCashSession(): CashSessionState {
  const { profile, hasOperationalOverride } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState<string | null>(null);
  const [isResponsible, setIsResponsible] = useState(false);
  const [isTransferredSession, setIsTransferredSession] = useState(false);
  const [cashStatus, setCashStatus] = useState<CashStatus>('loading');
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // Use SECURITY DEFINER function to check open session (bypasses RLS)
    const { data: sessions } = await supabase.rpc('get_open_cash_session_today');

    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      setSessionOpen(true);
      setClosingId(session.closing_id);
      setResponsibleId(session.current_responsible_id);
      setResponsibleName(session.responsible_name);

      const userIsResponsible = session.current_responsible_id === profile.id;
      setIsResponsible(userIsResponsible);
      setIsTransferredSession(
        userIsResponsible && session.current_responsible_id !== session.user_id
      );
      setPendingDate(null);

      // Determine cashStatus
      if (userIsResponsible || hasOperationalOverride) {
        setCashStatus('open');
      } else {
        setCashStatus('blocked');
      }
    } else {
      setSessionOpen(false);
      setClosingId(null);
      setResponsibleId(null);
      setResponsibleName(null);
      setIsResponsible(false);
      setIsTransferredSession(false);

      const today = todayISO();

      // Check for closed today (any user — use RPC-less query filtered by profile)
      const { data: closedToday } = await supabase
        .from('cash_closings')
        .select('id')
        .eq('business_date', today)
        .eq('status', 'closed')
        .limit(1);

      if (closedToday && closedToday.length > 0) {
        setCashStatus('closed_today');
        setPendingDate(null);
      } else {
        // Check for pending previous days
        const { data: pendingClosings } = await supabase
          .from('cash_closings')
          .select('business_date')
          .eq('status', 'open')
          .lt('business_date', today)
          .order('business_date', { ascending: false })
          .limit(1);

        const pd = pendingClosings?.[0]?.business_date || null;
        setPendingDate(pd);
        setCashStatus('none');
      }
    }

    setLoading(false);
  }, [profile, hasOperationalOverride]);

  useEffect(() => {
    check();
  }, [check]);

  const canOperate = isResponsible || (sessionOpen && hasOperationalOverride);
  const isOverrideMode = sessionOpen && !isResponsible && hasOperationalOverride;

  return {
    loading,
    sessionOpen,
    closingId,
    responsibleId,
    responsibleName,
    isResponsible,
    canOperate,
    isOverrideMode,
    isTransferredSession,
    cashStatus,
    pendingDate,
    refresh: check,
  };
}

/**
 * Log a blocked operation attempt
 */
export async function logBlockedOperation(params: {
  action_type: string;
  responsible_id: string | null;
  session_id: string | null;
  business_date?: string;
  notes?: string;
}) {
  await logSecurityEvent({
    event_type: 'cash_operation_blocked_wrong_user',
    entity_type: 'cash_closings',
    entity_id: params.session_id || undefined,
    action: 'OPERATION_BLOCKED',
    severity: 'medium',
    business_date: params.business_date || todayISO(),
    target_user_id: params.responsible_id || undefined,
    notes: params.notes || `Tentativa de ${params.action_type} bloqueada. Usuário não é o responsável atual da sessão.`,
  });
}

/**
 * Log a primary admin override action
 */
export async function logOverrideAction(params: {
  action_type: string;
  reason: string;
  responsible_id: string | null;
  session_id: string | null;
  business_date?: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
}) {
  await logSecurityEvent({
    event_type: 'primary_admin_override_used',
    entity_type: 'cash_closings',
    entity_id: params.session_id || undefined,
    action: params.action_type,
    severity: 'critical',
    business_date: params.business_date || todayISO(),
    target_user_id: params.responsible_id || undefined,
    old_data: params.old_data,
    new_data: { reason: params.reason, action: params.action_type, ...params.new_data },
    notes: `Admin principal usou override operacional. Motivo: ${params.reason}. Ação: ${params.action_type}.`,
  });
}
