import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ShoppingCart, ArrowUpDown, Lock,
  Package, BarChart3, Users, Heart, LogOut, Menu, X, User
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';

const allNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'cashier'] },
  { to: '/pdv', icon: ShoppingCart, label: 'PDV', roles: ['admin', 'cashier'] },
  { to: '/movimentos', icon: ArrowUpDown, label: 'Movimentos', roles: ['admin', 'cashier'] },
  { to: '/fechamento', icon: Lock, label: 'Fechamento', roles: ['admin', 'cashier'] },
  { to: '/produtos', icon: Package, label: 'Produtos', roles: ['admin'] },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios', roles: ['admin', 'cashier'] },
  { to: '/spr', icon: Heart, label: 'SPR Ramatis', roles: ['admin', 'cashier'] },
  { to: '/notificacoes', icon: Users, label: 'Acompanhamento SPR', roles: ['admin'] },
  { to: '/usuarios', icon: Users, label: 'Usuários', roles: ['admin'] },
  // Volunteer-only
  { to: '/', icon: LayoutDashboard, label: 'Início', roles: ['volunteer'] },
  { to: '/meu-spr', icon: Heart, label: 'Meu SPR', roles: ['volunteer'] },
  { to: '/perfil', icon: User, label: 'Meu Perfil', roles: ['volunteer'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, isAdmin, isVolunteer } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const location = useLocation();

  const role = profile?.role || 'cashier';
  const filteredNav = allNavItems.filter(item => item.roles.includes(role));

  // Bottom nav for mobile
  const bottomNavItems = isVolunteer
    ? [
        { to: '/', icon: LayoutDashboard, label: 'Início' },
        { to: '/meu-spr', icon: Heart, label: 'Meu SPR' },
        { to: '/perfil', icon: User, label: 'Perfil' },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: 'Início' },
        { to: '/pdv', icon: ShoppingCart, label: 'PDV' },
        { to: '/movimentos', icon: ArrowUpDown, label: 'Movimentos' },
        { to: '/fechamento', icon: Lock, label: 'Fechar' },
        { to: '/more', icon: Menu, label: 'Mais' },
      ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-card">
        <NavLink to="/perfil" className="flex h-16 items-center gap-3 border-b px-5 hover:bg-muted/50 transition-colors">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">FER</span>
            </div>
          )}
          <div>
            <p className="font-heading text-sm font-bold">Caixa da FER</p>
            <p className="text-xs text-muted-foreground">{profile?.full_name}</p>
          </div>
        </NavLink>
        <nav className="flex-1 space-y-1 p-3">
          {filteredNav.map(item => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card shadow-xl animate-fade-in">
            <div className="flex h-16 items-center justify-between border-b px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                  <span className="text-sm font-bold text-primary-foreground">FER</span>
                </div>
                <p className="font-heading text-sm font-bold">Caixa da FER</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-3">
              <p className="mb-3 px-3 text-xs font-medium text-muted-foreground">
                {profile?.full_name} • {role === 'admin' ? 'Admin' : role === 'volunteer' ? 'Voluntário' : 'Caixa'}
              </p>
              <nav className="space-y-1">
                {filteredNav.map(item => (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="absolute bottom-0 left-0 right-0 border-t p-3 safe-bottom">
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* More menu overlay (mobile) - only for non-volunteer */}
      {moreMenuOpen && !isVolunteer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0" onClick={() => setMoreMenuOpen(false)} />
          <div className="absolute bottom-16 left-0 right-0 rounded-t-2xl border bg-card p-4 shadow-xl safe-bottom animate-slide-up">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Menu</p>
              <Button variant="ghost" size="sm" onClick={() => setMoreMenuOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="grid grid-cols-3 gap-2">
              {filteredNav.filter(i => !bottomNavItems.slice(0, 4).some(b => b.to === i.to)).map(item => (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  onClick={() => setMoreMenuOpen(false)}
                  className={({ isActive }) => cn(
                    'flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={() => { setMoreMenuOpen(false); signOut(); }}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                <LogOut className="h-6 w-6" />
                Sair
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-md md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">FER</span>
            </div>
            <span className="font-heading text-sm font-bold">Caixa da FER</span>
          </button>
        </header>

        <div className="page-container">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-md safe-bottom md:hidden">
        <div className="flex items-center justify-around py-1">
          {bottomNavItems.map(item => {
            if (item.to === '/more') {
              return (
                <button
                  key="more"
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors',
                    moreMenuOpen ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            }
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
