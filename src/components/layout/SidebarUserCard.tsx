import { NavLink } from 'react-router-dom';

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
        className="block rounded-xl p-3 transition-colors hover:bg-[var(--color-surface-alt)]"
      >
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              key={avatarUrl}
              src={avatarUrl}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover"
              style={{ border: '1.5px solid #e2d9cc' }}
            />
          ) : (
            <div className="editorial-avatar flex h-11 w-11 shrink-0 items-center justify-center">
              <span className="text-sm">{fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="editorial-user-name truncate">{fullName || 'Usuário'}</p>
            <span className="editorial-user-role">{getRoleLabel(role)}</span>
          </div>
        </div>
      </NavLink>
    </div>
  );
}
