import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ShoppingCart, ArrowUpDown, Lock,
  Package, BarChart3, Users, Heart, LogOut, Menu, User, Bell, Shield, AlertTriangle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const adminSections: NavSection[] = [
  {
    title: 'Início',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Início' },
    ],
  },
  {
    title: 'Caixa',
    items: [
      { to: '/pdv', icon: ShoppingCart, label: 'PDV' },
      { to: '/movimentos', icon: ArrowUpDown, label: 'Movimentos' },
      { to: '/fechamento', icon: Lock, label: 'Fechamento' },
    ],
  },
  {
    title: 'SPR',
    items: [
      { to: '/spr', icon: Heart, label: 'SPR' },
      { to: '/notificacoes', icon: AlertTriangle, label: 'Pendências' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/produtos', icon: Package, label: 'Produtos' },
      { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
      { to: '/usuarios', icon: Users, label: 'Usuários' },
      { to: '/seguranca', icon: Shield, label: 'Segurança' },
    ],
  },
];

const cashierSections: NavSection[] = [
  {
    title: 'Início',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Início' },
    ],
  },
  {
    title: 'Caixa',
    items: [
      { to: '/pdv', icon: ShoppingCart, label: 'PDV' },
      { to: '/movimentos', icon: ArrowUpDown, label: 'Movimentos' },
      { to: '/fechamento', icon: Lock, label: 'Fechamento' },
    ],
  },
];

const volunteerSections: NavSection[] = [
  {
    title: 'Início',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Início' },
    ],
  },
  {
    title: 'SPR',
    items: [
      { to: '/meu-spr', icon: Heart, label: 'Meu SPR' },
      { to: '/notificacoes', icon: AlertTriangle, label: 'Pendências' },
    ],
  },
];

const pageTitles: Record<string, string> = {
  '/': 'Início',
  '/pdv': 'PDV',
  '/movimentos': 'Movimentos',
  '/fechamento': 'Fechamento',
  '/produtos': 'Produtos',
  '/relatorios': 'Relatórios',
  '/spr': 'SPR',
  '/notificacoes': 'Pendências',
  '/usuarios': 'Usuários',
  '/seguranca': 'Segurança',
  '/meu-spr': 'Meu SPR',
  '/perfil': 'Perfil',
};

function getSections(role: string): NavSection[] {
  switch (role) {
    case 'admin': return adminSections;
    case 'volunteer': return volunteerSections;
    default: return cashierSections;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, isAdmin, isVolunteer } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const role = profile?.role || 'cashier';
  const sections = getSections(role);
  const currentTitle = pageTitles[location.pathname] || 'Caixa da FER';

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header / User */}
      <div className="px-5 pt-5 pb-4">
        <NavLink
          to="/perfil"
          className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-11 w-11 rounded-full object-cover shrink-0 ring-2 ring-primary/20"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary shrink-0">
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

      <div className="h-px bg-border mx-4" />

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-2">
        {sections.map((section, sIdx) => (
          <div key={section.title} className={cn(sIdx > 0 && 'mt-5')}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Conta section */}
        <div className="mt-5">
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Conta
          </p>
          <div className="space-y-0.5">
            <NavLink
              to="/perfil"
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <User className="h-[18px] w-[18px] shrink-0" />
              Perfil
            </NavLink>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              Sair
            </button>
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-card shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-card shadow-2xl flex flex-col animate-slide-in-left">
            {sidebarContent}
            <div className="safe-bottom" />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 backdrop-blur-md px-4">
          <div className="flex items-center gap-3 min-w-0">
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
