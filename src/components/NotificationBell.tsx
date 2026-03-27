import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-card shadow-lg animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar tudo como lido
              </Button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b last:border-b-0',
                    !n.is_read && 'bg-primary/5'
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    !n.is_read ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <Heart className={cn('h-4 w-4', !n.is_read ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-xs font-semibold truncate', !n.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {n.message}
                    </p>
                    {n.is_read && (
                      <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                        <Check className="h-3 w-3" /> Lido
                      </span>
                    )}
                  </div>
                  {!n.is_read && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
