import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { todayISO } from '@/lib/constants';
import { logSecurityEvent } from '@/lib/security';

interface CashSessionState {
  loading: boolean;
  /** Whether there's an open session today */
  sessionOpen: boolean;
  /** ID of the open cash_closings record */
  closingId: string | null;
  /** ID of the current responsible user */
  responsibleId: string | null;
  /** Name of the current responsible user */
  responsibleName: string | null;
  /** Whether the current user IS the session responsible */
  isResponsible: boolean;
  /** Whether the current user can operate (is responsible OR has override) */
  canOperate: boolean;
  /** Whether the current user is operating via primary admin override */
  isOverrideMode: boolean;
  /** Whether the session was transferred to the current user */
  isTransferredSession: boolean;
  /** Refresh the session state */
  refresh: () => Promise<void>;
}

/**
 * Hook to check if the current user can operate the cash session.
 * Enforces the rule: only the current responsible (or primary admin with override) can operate.
 */
export function useCashSession(): CashSessionState {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState<string | null>(null);
  const [isResponsible, setIsResponsible] = useState(false);
  const [isTransferredSession, setIsTransferredSession] = useState(false);

  const hasOverride = !!(profile as any)?.has_operational_override;

  const check = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const today = todayISO();

    // Check for any open session today
    const { data: openSessions } = await supabase
      .from('cash_closings')
      .select('id, user_id, current_responsible_id')
      .eq('business_date', today)
      .eq('status', 'open')
      .eq('is_latest_version', true)
      .limit(1);

    if (openSessions && openSessions.length > 0) {
      const session = openSessions[0];
      setSessionOpen(true);
      setClosingId(session.id);
      setResponsibleId(session.current_responsible_id);

      const userIsResponsible = session.current_responsible_id === profile.id;
      setIsResponsible(userIsResponsible);
      setIsTransferredSession(
        userIsResponsible && session.current_responsible_id !== session.user_id
      );

      // Get responsible name
      if (!userIsResponsible) {
        const { data: names } = await supabase.rpc('get_user_names', {
          _user_ids: [session.current_responsible_id],
        });
        setResponsibleName(names?.[0]?.full_name || 'outro operador');
      } else {
        setResponsibleName(profile.full_name);
      }
    } else {
      setSessionOpen(false);
      setClosingId(null);
      setResponsibleId(null);
      setResponsibleName(null);
      setIsResponsible(false);
      setIsTransferredSession(false);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    check();
  }, [check]);

  const canOperate = isResponsible || (sessionOpen && hasOverride);
  const isOverrideMode = sessionOpen && !isResponsible && hasOverride;

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
