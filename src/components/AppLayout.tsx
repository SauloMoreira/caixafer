import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ShoppingCart, ArrowUpDown, Lock, Unlock,
  Package, BarChart3, Users, Heart, LogOut, Menu, User, Bell
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';

const allNavItems = [
  // Admin + Cashier
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'cashier'] },
  { to: '/pdv', icon: ShoppingCart, label: 'PDV', roles: ['admin', 'cashier'] },
  { to: '/movimentos', icon: ArrowUpDown, label: 'Movimentos', roles: ['admin', 'cashier'] },
  { to: '/fechamento', icon: Lock, label: 'Fechamento', roles: ['admin', 'cashier'] },
  { to: '/produtos', icon: Package, label: 'Produtos', roles: ['admin'] },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios', roles: ['admin', 'cashier'] },
  { to: '/spr', icon: Heart, label: 'SPR Ramatis', roles: ['admin', 'cashier'] },
  { to: '/notificacoes', icon: Bell, label: 'Acompanhamento SPR', roles: ['admin'] },
  { to: '/usuarios', icon: Users, label: 'Usuários', roles: ['admin'] },
  // Volunteer-only
  { to: '/', icon: LayoutDashboard, label: 'Início', roles: ['volunteer'] },
  { to: '/meu-spr', icon: Heart, label: 'Meu SPR', roles: ['volunteer'] },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/pdv': 'PDV',
  '/movimentos': 'Movimentos',
  '/fechamento': 'Fechamento',
  '/produtos': 'Produtos',
  '/relatorios': 'Relatórios',
  '/spr': 'SPR Ramatis',
  '/notificacoes': 'Acompanhamento SPR',
  '/usuarios': 'Usuários',
  '/meu-spr': 'Meu SPR',
  '/perfil': 'Meu Perfil',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, isAdmin, isVolunteer } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const role = profile?.role || 'cashier';
  const filteredNav = allNavItems.filter(item => item.roles.includes(role));
  const currentTitle = pageTitles[location.pathname] || 'Caixa da FER';

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <NavLink to="/perfil" className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0 ring-2 ring-primary/20" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shrink-0">
              <span className="text-sm font-bold text-primary-foreground">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold truncate">{profile?.full_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {role === 'admin' ? 'Administrador' : role === 'volunteer' ? 'Voluntário' : 'Operador de Caixa'}
            </p>
          </div>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNav.map(item => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
        {/* Profile link */}
        <NavLink
          to="/perfil"
          className={({ isActive }) => cn(
            'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <User className="h-5 w-5 shrink-0" />
          Meu Perfil
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="border-t p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar — fixed */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-card shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-card shadow-2xl flex flex-col animate-slide-in-left">
            {sidebarContent}
            {/* Safe area bottom padding */}
            <div className="safe-bottom" />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header — always visible */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 backdrop-blur-md px-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Menu button (mobile only) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-heading text-base font-bold truncate">{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || isVolunteer) && <NotificationBell />}
            {/* Desktop profile avatar */}
            <NavLink to="/perfil" className="hidden md:flex h-9 w-9 items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-transparent hover:ring-primary/20 transition-all" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
                  <User className="h-4 w-4 text-muted-foreground" />
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
