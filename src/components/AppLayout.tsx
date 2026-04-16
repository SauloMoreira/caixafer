import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LogOut, Menu, User
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';
import logoImg from '@/assets/logo.png';
import { SidebarSection } from '@/components/layout/SidebarSection';
import { SidebarUserCard } from '@/components/layout/SidebarUserCard';
import { getSections, pageTitles } from '@/components/layout/sidebar-config';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, isAdmin, isVolunteer } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useThemeColor();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const location = useLocation();

  const role = profile?.role || 'cashier';
  const sections = useMemo(() => getSections(role), [role]);
  const standaloneHomeItem = sections[0]?.title === 'Início' && sections[0]?.items.length === 1 ? sections[0].items[0] : null;
  const groupedSections = standaloneHomeItem ? sections.slice(1) : sections;
  const currentTitle = pageTitles[location.pathname] || 'Caixa da FER';

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    setOpenSections((current) => {
      const next = { ...current };
      sections.forEach((section) => {
        if (section.items.some((item) => item.to === location.pathname) && next[section.title] !== true) {
          next[section.title] = true;
        }
        if (next[section.title] === undefined) {
          next[section.title] = role === 'admin' || section.items.some((item) => item.to === location.pathname);
        }
      });
      return next;
    });
  }, [location.pathname, role, sections]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const sidebarContent = (
    <div className="editorial-sidebar flex h-full flex-col overflow-hidden">
      <div className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--color-accent-bg)' }}>
              <img src={logoImg} alt="Fraternidade Espírita Ramatis" className="h-9 w-9 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="editorial-badge-admin">Painel admin</span>
              <p className="editorial-brand-title mt-1.5 truncate">Caixa da FER</p>
              <p className="editorial-brand-subtitle">Fraternidade Espírita Ramatis</p>
            </div>
          </div>
        </div>
      </div>

      <SidebarUserCard avatarUrl={profile?.avatar_url} fullName={profile?.full_name} role={role} />

      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        {standaloneHomeItem && (
          <div className="mb-3 animate-fade-in">
            <NavLink
              to={standaloneHomeItem.to}
              end={standaloneHomeItem.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-sidebar-border/70 bg-card/85 px-3 py-3 shadow-sm backdrop-blur-sm transition-all duration-200 active:scale-[0.99]',
                  isActive
                    ? 'border-sidebar-ring/20 bg-sidebar-accent text-primary'
                    : 'text-muted-foreground hover:border-sidebar-border hover:bg-card hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/40 transition-all duration-200 group-hover:bg-sidebar-accent/60',
                      isActive && 'bg-sidebar-accent/90 text-primary'
                    )}
                  >
                    <standaloneHomeItem.icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105" />
                  </div>
                  <span className="truncate text-sm font-medium">{standaloneHomeItem.label}</span>
                </>
              )}
            </NavLink>
          </div>
        )}

        <div className="space-y-3">
          {groupedSections.map((section, sIdx) => {
            const isOpen = openSections[section.title] ?? section.items.some((item) => item.to === location.pathname);

            return (
              <SidebarSection
                key={section.title}
                currentPath={location.pathname}
                isFirst={sIdx === 0}
                onOpenChange={(open) => setOpenSections((current) => ({ ...current, [section.title]: open }))}
                open={isOpen}
                section={section}
              />
            );
          })}
        </div>

        <div className="mx-4 my-4 h-px bg-sidebar-border/60" />

        <div className="rounded-[1.6rem] border border-sidebar-border/70 bg-card/85 p-2 shadow-sm backdrop-blur-sm">
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/80">
            Conta
          </p>
          <div className="space-y-1 rounded-[1.1rem] border border-sidebar-border/60 bg-background/70 p-2">
            <NavLink
              to="/perfil"
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.99]',
                isActive
                  ? 'border border-sidebar-ring/20 bg-sidebar-accent text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-sidebar-accent/45 hover:text-foreground'
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/40">
                <User className="h-[18px] w-[18px] shrink-0" />
              </div>
              <span className="truncate">Perfil</span>
            </NavLink>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors duration-200 active:scale-[0.99] hover:bg-destructive/10 hover:text-destructive"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/40">
                <LogOut className="h-[18px] w-[18px] shrink-0" />
              </div>
              <span className="truncate">Sair</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full" style={{ background: 'var(--color-page-bg)' }}>
      <aside className="editorial-sidebar hidden shrink-0 md:flex md:w-[19rem] md:flex-col">
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-md transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="editorial-sidebar absolute left-2 top-2 h-[calc(100dvh-1rem)] w-[min(88vw,22rem)] overflow-hidden rounded-[2rem] shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="editorial-topbar sticky top-0 z-30 flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--color-surface-alt)] transition-colors md:hidden"
              aria-label="Abrir menu"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="editorial-topbar-title truncate">{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || isVolunteer || profile?.role === 'cash_coordinator') && <NotificationBell />}
            <NavLink to="/perfil" className="hidden md:flex h-9 w-9 items-center justify-center">
              {profile?.avatar_url ? (
                <img key={profile.avatar_url} src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" style={{ border: '1.5px solid #e2d9cc' }} />
              ) : (
                <div className="editorial-avatar flex h-8 w-8 items-center justify-center text-xs">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                </div>
              )}
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="page-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
