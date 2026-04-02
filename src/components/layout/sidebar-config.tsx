import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpDown,
  BarChart3,
  Boxes,
  Brain,
  Building2,
  Heart,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Package,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Users,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const adminSections: NavSection[] = [
  {
    title: 'Início',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Início' }],
  },
  {
    title: 'Operação',
    items: [
      { to: '/pdv', icon: ShoppingCart, label: 'PDV' },
      { to: '/movimentos', icon: ArrowUpDown, label: 'Movimentos' },
      { to: '/fechamento', icon: Lock, label: 'Fechamento' },
      { to: '/spr', icon: Heart, label: 'SPR' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { to: '/produtos', icon: Package, label: 'Produtos' },
      { to: '/categorias', icon: Tag, label: 'Categorias' },
      { to: '/categorias-movimentacao', icon: SlidersHorizontal, label: 'Cat. Movimentação' },
    ],
  },
  {
    title: 'Estoque',
    items: [{ to: '/estoque', icon: Boxes, label: 'Estoque' }],
  },
  {
    title: 'Análises',
    items: [
      { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
      { to: '/insights', icon: Lightbulb, label: 'Insights' },
      { to: '/inteligencia', icon: Brain, label: 'Inteligência' },
    ],
  },
  {
    title: 'Administração',
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
    items: [{ to: '/', icon: LayoutDashboard, label: 'Início' }],
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
    items: [{ to: '/spr', icon: Heart, label: 'SPR' }],
  },
];

const coordinatorSections: NavSection[] = [
  {
    title: 'Início',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Início' }],
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
    items: [{ to: '/spr', icon: Heart, label: 'SPR' }],
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
    items: [{ to: '/meu-consumo', icon: Heart, label: 'Meu Consumo' }],
  },
];

export const pageTitles: Record<string, string> = {
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

export function getSections(role: string): NavSection[] {
  switch (role) {
    case 'admin':
      return adminSections;
    case 'cash_coordinator':
      return coordinatorSections;
    case 'volunteer':
      return volunteerSections;
    default:
      return cashierSections;
  }
}

export function getRoleLabel(role: string) {
  if (role === 'admin') return 'Administrador';
  if (role === 'cash_coordinator') return 'Coordenador de Caixa';
  if (role === 'volunteer') return 'Voluntário';

  return 'Operador de Caixa';
}