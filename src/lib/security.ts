import { supabase } from '@/integrations/supabase/client';

/**
 * Log a security audit event from the frontend via a SECURITY DEFINER RPC.
 * Direct inserts into security_audit_logs are no longer allowed.
 */
export async function logSecurityEvent(params: {
  event_type: string;
  entity_type: string;
  entity_id?: string;
  action: string;
  route?: string;
  notes?: string;
  severity?: 'info' | 'medium' | 'high' | 'critical';
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  target_user_id?: string;
  business_date?: string;
}) {
  try {
    await supabase.rpc('log_security_event', {
      _event_type: params.event_type,
      _entity_type: params.entity_type,
      _action: params.action,
      _entity_id: params.entity_id ?? null,
      _route: params.route ?? window.location.pathname,
      _notes: params.notes ?? null,
      _severity: params.severity ?? 'info',
      _old_data: params.old_data ?? null,
      _new_data: params.new_data ?? null,
      _target_user_id: params.target_user_id ?? null,
      _business_date: params.business_date ?? null,
    });
  } catch (e) {
    // Fail silently — audit should never break the app
    console.error('Audit log error:', e);
  }
}

/**
 * Log a security incident (unauthorized access attempt, etc.) via RPC.
 */
export async function logSecurityIncident(params: {
  incident_type: string;
  route?: string;
  context?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}) {
  try {
    await supabase.rpc('log_security_incident', {
      _incident_type: params.incident_type,
      _route: params.route ?? window.location.pathname,
      _context: params.context ?? null,
      _severity: params.severity ?? 'medium',
    });
  } catch (e) {
    console.error('Incident log error:', e);
  }
}
