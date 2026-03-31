import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ShoppingCart, ArrowUpDown, Lock,
  Package, Tag, BarChart3, Users, Heart, LogOut, Menu, User, Shield, AlertTriangle, Lightbulb, Brain, Boxes, SlidersHorizontal, ArrowRightLeft, ChevronRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';
import logoImg from '@/assets/logo.png';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
}

const adminSections: NavSection[] = [
  {
    title: 'Início',
    collapsible: true,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Início' },
    ],
  },
  {
    title: 'Operação',
    collapsible: true,
    items: [
      { to: '/pdv', icon: ShoppingCart, label: 'PDV' },
      { to: '/movimentos', icon: ArrowUpDown, label: 'Movimentos' },
      { to: '/fechamento', icon: Lock, label: 'Fechamento' },
      { to: '/spr', icon: Heart, label: 'SPR' },
    ],
  },
  {
    title: 'Cadastros',
    collapsible: true,
    items: [
      { to: '/produtos', icon: Package, label: 'Produtos' },
      { to: '/categorias', icon: Tag, label: 'Categorias' },
      { to: '/categorias-movimentacao', icon: SlidersHorizontal, label: 'Cat. Movimentação' },
    ],
  },
  {
    title: 'Estoque',
    collapsible: true,
    items: [
      { to: '/estoque', icon: Boxes, label: 'Estoque' },
    ],
  },
  {
    title: 'Análises',
    collapsible: true,
    items: [
      { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
      { to: '/insights', icon: Lightbulb, label: 'Insights' },
      { to: '/inteligencia', icon: Brain, label: 'Inteligência' },
    ],
  },
  {
    title: 'Administração',
    collapsible: true,
    items: [
      { to: '/usuarios', icon: Users, label: 'Usuários' },
      { to: '/seguranca', icon: Shield, label: 'Segurança' },
      { to: '/historico-transferencias', icon: ArrowRightLeft, label: 'Hist. Transferências' },
      { to: '/notificacoes', icon: AlertTriangle, label: 'Pendências' },
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
];

const coordinatorSections: NavSection[] = [
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
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/produtos', icon: Package, label: 'Produtos' },
      { to: '/categorias', icon: Tag, label: 'Categorias' },
      { to: '/estoque', icon: Boxes, label: 'Estoque' },
      { to: '/insights', icon: Lightbulb, label: 'Insights' },
      { to: '/inteligencia', icon: Brain, label: 'Inteligência' },
    ],
  },
];

const volunteerSections: NavSection[] = [
  {
    title: 'Menu',
    items: [
      { to: '/meu-consumo', icon: Heart, label: 'Meu Consumo' },
    ],
  },
];

const pageTitles: Record<string, string> = {
  '/': 'Início',
  '/pdv': 'PDV',
  '/movimentos': 'Movimentos',
  '/fechamento': 'Fechamento',
  '/produtos': 'Produtos',
  '/categorias': 'Categorias',
  '/categorias-movimentacao': 'Categorias de Movimentação',
  '/relatorios': 'Relatórios',
  '/spr': 'SPR',
  '/notificacoes': 'Pendências',
  '/usuarios': 'Usuários',
  '/seguranca': 'Segurança',
  '/historico-transferencias': 'Histórico de Transferências',
  '/meu-consumo': 'Meu Consumo',
  '/perfil': 'Perfil',
};

function getSections(role: string): NavSection[] {
  switch (role) {
    case 'admin': return adminSections;
    case 'cash_coordinator': return coordinatorSections;
    case 'volunteer': return volunteerSections;
    default: return cashierSections;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, isAdmin, isVolunteer } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const location = useLocation();

  const role = profile?.role || 'cashier';
  const sections = getSections(role);
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
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
        <img src={logoImg} alt="Fraternidade Espírita Ramatis" className="h-10 w-10 rounded-xl object-contain shrink-0" />
        <div className="min-w-0">
          <p className="font-heading text-sm font-bold truncate">Caixa da FER</p>
          <p className="text-[10px] text-muted-foreground">Fraternidade Espírita Ramatis</p>
        </div>
      </div>

      {/* User */}
      <div className="px-4 pb-4 sm:px-5">
        <NavLink
          to="/perfil"
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-3 transition-colors hover:bg-sidebar-accent/70"
        >
          {profile?.avatar_url ? (
            <img
              key={profile.avatar_url}
              src={profile.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover shrink-0 ring-2 ring-primary/20"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary shrink-0">
              <span className="text-xs font-bold text-primary-foreground">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name}</p>
            <p className="text-[10px] text-muted-foreground">
              {role === 'admin' ? 'Administrador' : role === 'cash_coordinator' ? 'Coordenador de Caixa' : role === 'volunteer' ? 'Voluntário' : 'Operador de Caixa'}
            </p>
          </div>
        </NavLink>
      </div>

      <div className="mx-4 h-px bg-sidebar-border/80" />

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="space-y-2">
          {sections.map((section, sIdx) => {
            const isSectionActive = section.items.some((item) => item.to === location.pathname);
            const isOpen = openSections[section.title] ?? isSectionActive;

            return (
              <div key={section.title} className="animate-fade-in">
                {sIdx > 0 && <div className="mx-2 mb-2 h-px bg-sidebar-border/70" />}

                <Collapsible open={isOpen} onOpenChange={(open) => setOpenSections((current) => ({ ...current, [section.title]: open }))}>
                  <CollapsibleTrigger
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-all duration-200 hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2',
                      isSectionActive && 'bg-sidebar-accent/60'
                    )}
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                        {section.title}
                      </p>
                    </div>
                    <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-90 text-primary')} />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="ml-2 mt-1 space-y-1 border-l border-sidebar-border/80 pl-3">
                      {section.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/'}
                          className={({ isActive }) => cn(
                            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.99]',
                            isActive
                              ? 'bg-sidebar-primary/12 text-primary shadow-sm'
                              : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                          )}
                        >
                          <item.icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>

        {/* Conta section */}
        <div className="mt-4 border-t border-sidebar-border/80 pt-3">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
            Conta
          </p>
          <div className="space-y-1">
            <NavLink
              to="/perfil"
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.99]',
                isActive
                  ? 'bg-sidebar-primary/12 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
              )}
            >
              <User className="h-[18px] w-[18px] shrink-0" />
              Perfil
            </NavLink>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 active:scale-[0.99] hover:bg-destructive/10 hover:text-destructive"
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
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted transition-colors md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-heading text-base font-bold truncate">{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || isVolunteer || profile?.role === 'cash_coordinator') && <NotificationBell />}
            <NavLink to="/perfil" className="hidden md:flex h-9 w-9 items-center justify-center">
              {profile?.avatar_url ? (
                <img key={profile.avatar_url} src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-transparent hover:ring-primary/20 transition-all" />
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
