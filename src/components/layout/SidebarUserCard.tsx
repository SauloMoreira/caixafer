import { NavLink } from 'react-router-dom';
import { ShieldCheck, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

import { getRoleLabel } from './sidebar-config';

interface SidebarUserCardProps {
  avatarUrl?: string | null;
  fullName?: string | null;
  role: string;
}

export function SidebarUserCard({ avatarUrl, fullName, role }: SidebarUserCardProps) {
  return (
    <div className="px-4 pb-4 sm:px-5">
      <NavLink
        to="/perfil"
        className={({ isActive }) =>
          cn(
            'block rounded-[1.75rem] border border-sidebar-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-sidebar-border hover:bg-card',
            isActive && 'border-sidebar-ring/25 bg-sidebar-accent/45'
          )
        }
      >
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <img
              key={avatarUrl}
              src={avatarUrl}
              alt=""
              className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-2 ring-primary/10"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sidebar-accent text-primary">
              <span className="text-sm font-bold">{fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-sidebar-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-accent-foreground">
                <Sparkles className="h-3 w-3" />
                Conta
              </span>
            </div>
            <p className="mt-2 truncate font-heading text-sm font-semibold text-foreground">{fullName || 'Usuário'}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{getRoleLabel(role)}</span>
            </div>
          </div>
        </div>
      </NavLink>
    </div>
  );
}