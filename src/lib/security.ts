import { supabase } from '@/integrations/supabase/client';

/**
 * Log a security audit event from the frontend.
 * Used for events not captured by DB triggers (e.g. route access attempts).
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('security_audit_logs').insert({
      event_type: params.event_type,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      user_id: user.id,
      action: params.action,
      route: params.route || window.location.pathname,
      notes: params.notes,
      severity: params.severity || 'info',
      old_data: params.old_data,
      new_data: params.new_data,
      target_user_id: params.target_user_id,
      business_date: params.business_date,
    });
  } catch (e) {
    // Fail silently — audit should never break the app
    console.error('Audit log error:', e);
  }
}

/**
 * Log a security incident (unauthorized access attempt, etc.)
 */
export async function logSecurityIncident(params: {
  incident_type: string;
  route?: string;
  context?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('security_incidents').insert({
      incident_type: params.incident_type,
      user_id: user.id,
      route: params.route || window.location.pathname,
      context: params.context,
      severity: params.severity || 'medium',
    });
  } catch (e) {
    console.error('Incident log error:', e);
  }
}
