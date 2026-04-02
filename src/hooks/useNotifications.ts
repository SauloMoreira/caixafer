import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  user_id: string;
  volunteer_id: string | null;
  type: string;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasCriticalAlert, setHasCriticalAlert] = useState(false);
  const [loading, setLoading] = useState(true);

  const lastSprRefreshRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;

    // Only call heavy RPC once every 10 minutes, not on every poll
    const now = Date.now();
    if (now - lastSprRefreshRef.current > 10 * 60 * 1000) {
      lastSprRefreshRef.current = now;
      await supabase.rpc('refresh_spr_notifications').catch(() => {});
    }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data as unknown as Notification[]);
      setUnreadCount(data.filter(n => !n.is_read).length);
      
      // Check for unread critical/high security alerts or stock alerts
      const hasUnreadCritical = data.some(
        (n: any) => !n.is_read && (n.reference_type === 'security_alert' || n.type === 'stock_alert')
      );
      setHasCriticalAlert(hasUnreadCritical);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq('id', notificationId);
    const updated = notifications.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n);
    setNotifications(updated);
    setUnreadCount(prev => Math.max(0, prev - 1));
    // Recalculate critical status
    setHasCriticalAlert(updated.some((n: any) => !n.is_read && n.reference_type === 'security_alert'));
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq('user_id', profile!.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    setHasCriticalAlert(false);
  };

  return { notifications, unreadCount, hasCriticalAlert, loading, markAsRead, markAllAsRead, refresh: fetchNotifications };
}
