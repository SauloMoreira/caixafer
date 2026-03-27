import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield, Activity, AlertTriangle, Users, Lock, Unlock,
  ChevronDown, ChevronRight, Search, Filter, Eye
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const EVENT_LABELS: Record<string, string> = {
  sale_created: 'Venda criada',
  sale_updated: 'Venda editada',
  sale_deleted: 'Venda excluída',
  cash_entry_created: 'Entrada criada',
  cash_entry_updated: 'Entrada editada',
  cash_entry_deleted: 'Entrada excluída',
  cash_opened: 'Caixa aberto',
  cash_closed: 'Caixa fechado',
  cash_reopened: 'Caixa reaberto',
  fiado_created: 'Fiado lançado',
  fiado_updated: 'Fiado editado',
  fiado_deleted: 'Fiado excluído',
  fiado_payment_created: 'Pagamento fiado',
  fiado_payment_deleted: 'Pagamento excluído',
  user_approved: 'Usuário aprovado',
  user_rejected: 'Usuário rejeitado',
  user_activated: 'Usuário ativado',
  user_deactivated: 'Usuário desativado',
  role_changed: 'Papel alterado',
  volunteer_link_changed: 'Vínculo alterado',
  profile_updated: 'Perfil atualizado',
  unauthorized_route_access: 'Acesso negado',
  unauthorized_data_access_attempt: 'Tentativa acesso dado',
  mfa_enrollment_started: 'MFA: início config.',
  mfa_enrollment_verified: 'MFA: ativado',
  mfa_enrollment_failed: 'MFA: falha ativação',
  mfa_login_verified: 'MFA: login verificado',
  mfa_login_failed: 'MFA: falha login',
  admin_access_blocked_missing_mfa: 'Acesso bloqueado (sem MFA)',
  session_invalidated_by_new_login: 'Sessão invalidada (novo login)',
  single_session_policy_applied: 'Sessão única aplicada',
  forced_reauthentication: 'Reautenticação forçada',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  critical: 'bg-red-200 text-red-900 dark:bg-red-950/50 dark:text-red-200',
};

function fmt(dateStr: string) {
  return format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR });
}

function currency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function SegurancaPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('overview');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSeverity, setAuditSeverity] = useState('all');
  const [detailLog, setDetailLog] = useState<any>(null);

  // Audit logs
  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['security-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Incidents
  const { data: incidents = [], isLoading: loadingIncidents } = useQuery({
    queryKey: ['security-incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Cash closings
  const { data: closings = [], isLoading: loadingClosings } = useQuery({
    queryKey: ['security-cash-closings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_closings')
        .select('*, profiles!cash_closings_user_id_fkey(full_name)')
        .order('business_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Profiles summary
  const { data: profiles = [] } = useQuery({
    queryKey: ['security-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active, approval_status, created_at, updated_at, last_login_at, active_session_id');
      if (error) throw error;
      return data;
    },
  });

  // Overview stats
  const activeUsers = profiles.filter(p => p.is_active && p.approval_status === 'approved').length;
  const pendingUsers = profiles.filter(p => p.approval_status === 'pending_approval').length;
  const recentHighLogs = auditLogs.filter(l => l.severity === 'high' || l.severity === 'critical').slice(0, 5);
  const openClosings = closings.filter((c: any) => c.status === 'open');
  const unresolvedIncidents = incidents.filter((i: any) => !i.resolved);

  // Filtered audit logs
  const filteredLogs = auditLogs.filter(l => {
    if (auditSeverity !== 'all' && l.severity !== auditSeverity) return false;
    if (auditSearch) {
      const search = auditSearch.toLowerCase();
      const label = (EVENT_LABELS[l.event_type] || l.event_type).toLowerCase();
      return label.includes(search) || l.entity_type?.toLowerCase().includes(search) || l.user_role?.toLowerCase().includes(search);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-xl font-bold">Central de Segurança</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex overflow-x-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-[100px]">Visão Geral</TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 min-w-[100px]">Auditoria</TabsTrigger>
          <TabsTrigger value="closings" className="flex-1 min-w-[100px]">Fechamentos</TabsTrigger>
          <TabsTrigger value="incidents" className="flex-1 min-w-[100px]">Incidentes</TabsTrigger>
          <TabsTrigger value="users" className="flex-1 min-w-[100px]">Usuários</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 min-w-[100px]">Configurações</TabsTrigger>
        </TabsList>

        {/* ═══ VISÃO GERAL ═══ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Ativos" value={activeUsers} />
            <StatCard icon={AlertTriangle} label="Pendentes" value={pendingUsers} color={pendingUsers > 0 ? 'text-amber-600' : undefined} />
            <StatCard icon={Unlock} label="Caixas Abertos" value={openClosings.length} color={openClosings.length > 0 ? 'text-amber-600' : undefined} />
            <StatCard icon={Shield} label="Incidentes" value={unresolvedIncidents.length} color={unresolvedIncidents.length > 0 ? 'text-red-600' : undefined} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Eventos Críticos Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentHighLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento crítico recente.</p>
              ) : recentHighLogs.map(l => (
                <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{EVENT_LABELS[l.event_type] || l.event_type}</p>
                    <p className="text-xs text-muted-foreground">{fmt(l.created_at)}</p>
                  </div>
                  <Badge className={SEVERITY_COLORS[l.severity] || ''}>{l.severity}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Últimas Ações do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {auditLogs.slice(0, 10).map(l => (
                <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{EVENT_LABELS[l.event_type] || l.event_type}</p>
                    <p className="text-xs text-muted-foreground">{l.entity_type} • {fmt(l.created_at)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{l.action}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ AUDITORIA ═══ */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar evento..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={auditSeverity} onValueChange={setAuditSeverity}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingAudit ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            <div className="space-y-2">
              {filteredLogs.slice(0, 100).map(l => (
                <Card key={l.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailLog(l)}>
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{EVENT_LABELS[l.event_type] || l.event_type}</p>
                        <Badge className={`${SEVERITY_COLORS[l.severity] || ''} text-[10px]`}>{l.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.entity_type} • {l.action} • {fmt(l.created_at)}
                        {l.user_role && ` • ${l.user_role}`}
                      </p>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ FECHAMENTOS ═══ */}
        <TabsContent value="closings" className="space-y-4 mt-4">
          {loadingClosings ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : closings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fechamento encontrado.</p>
          ) : (
            <div className="space-y-2">
              {closings.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{c.profiles?.full_name || 'Usuário'}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(c.business_date), 'dd/MM/yyyy')}</p>
                      </div>
                      <Badge variant={c.status === 'open' ? 'default' : 'secondary'}>
                        {c.status === 'open' ? 'Aberto' : 'Fechado'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Abertura</p>
                        <p className="font-medium">{currency(c.opening_balance)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Esperado</p>
                        <p className="font-medium">{currency(c.expected_balance)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contado</p>
                        <p className="font-medium">{c.counted_balance != null ? currency(c.counted_balance) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diferença</p>
                        <p className={`font-medium ${c.difference_amount && c.difference_amount !== 0 ? 'text-destructive' : ''}`}>
                          {c.difference_amount != null ? currency(c.difference_amount) : '—'}
                        </p>
                      </div>
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground italic">"{c.notes}"</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ INCIDENTES ═══ */}
        <TabsContent value="incidents" className="space-y-4 mt-4">
          {loadingIncidents ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum incidente registrado.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((i: any) => (
                <Card key={i.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{i.incident_type}</p>
                      <p className="text-xs text-muted-foreground">{i.route && `${i.route} • `}{fmt(i.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={SEVERITY_COLORS[i.severity] || ''}>{i.severity}</Badge>
                      <Badge variant={i.resolved ? 'secondary' : 'destructive'}>
                        {i.resolved ? 'Resolvido' : 'Aberto'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ USUÁRIOS ═══ */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="space-y-2">
            {profiles.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.role === 'admin' ? 'Admin' : p.role === 'cashier' ? 'Caixa' : 'Voluntário'}
                      {' • '}{p.approval_status === 'approved' ? 'Aprovado' : p.approval_status === 'pending_approval' ? 'Pendente' : p.approval_status}
                    </p>
                  </div>
                  <Badge variant={p.is_active ? 'default' : 'destructive'}>
                    {p.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <MfaSettingsSection profiles={profiles} auditLogs={auditLogs} />

          <SessionSettingsSection profiles={profiles} auditLogs={auditLogs} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Trilha de auditoria</span>
                <Badge variant="default">Ativa</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Triggers de banco</span>
                <Badge variant="default">6 tabelas</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Registro de incidentes</span>
                <Badge variant="default">Ativo</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Proteção contra senhas vazadas</span>
                <Badge variant="outline">Configurar no Cloud</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Audit Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={open => !open && setDetailLog(null)}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">Detalhes do Evento</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[70vh] px-4 pb-4">
              <div className="space-y-4 text-sm">
                {/* Main info as a structured card */}
                <div className="rounded-lg border bg-muted/30 divide-y">
                  <DetailRow label="Evento" value={EVENT_LABELS[detailLog.event_type] || detailLog.event_type} />
                  <DetailRow label="Entidade" value={detailLog.entity_type} />
                  <DetailRow label="Ação" value={detailLog.action} />
                  <DetailRow label="Severidade">
                    <Badge className={`${SEVERITY_COLORS[detailLog.severity] || ''} text-[11px]`}>{detailLog.severity}</Badge>
                  </DetailRow>
                  <DetailRow label="Papel" value={detailLog.user_role || '—'} />
                  <DetailRow label="Data" value={fmt(detailLog.created_at)} />
                  {detailLog.business_date && (
                    <DetailRow label="Data Operacional" value={format(new Date(detailLog.business_date), 'dd/MM/yyyy')} />
                  )}
                  {detailLog.route && <DetailRow label="Rota" value={detailLog.route} />}
                  {detailLog.notes && <DetailRow label="Notas" value={detailLog.notes} />}
                </div>

                {/* Structured data display for old_data */}
                {detailLog.old_data && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Dados Anteriores</p>
                    <DataTable data={detailLog.old_data} />
                  </div>
                )}

                {/* Structured data display for new_data */}
                {detailLog.new_data && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Dados Novos</p>
                    <DataTable data={detailLog.new_data} />
                  </div>
                )}

                {/* Comparison view when both exist */}
                {detailLog.old_data && detailLog.new_data && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Alterações</p>
                    <DiffView oldData={detailLog.old_data} newData={detailLog.new_data} />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className={`h-5 w-5 shrink-0 ${color || 'text-primary'}`} />
        <div>
          <p className={`text-lg font-bold ${color || ''}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

const DATA_LABELS: Record<string, string> = {
  id: 'ID', user_id: 'Usuário ID', status: 'Status', notes: 'Observações',
  opening_balance: 'Saldo Inicial', sales_total: 'Total Vendas', income_total: 'Total Entradas',
  expense_total: 'Total Saídas', expected_balance: 'Saldo Esperado', counted_balance: 'Saldo Contado',
  difference_amount: 'Diferença', business_date: 'Data Operacional', closed_at: 'Fechado em',
  created_at: 'Criado em', reopened_at: 'Reaberto em', reopened_by: 'Reaberto por',
  reopen_reason: 'Motivo Reabertura', closing_version: 'Versão', is_latest_version: 'Versão Atual',
  role: 'Papel', approval_status: 'Status Aprovação', is_active: 'Ativo', volunteer_id: 'Voluntário',
  amount: 'Valor', total_amount: 'Total', payment_method: 'Forma Pgto', entry_type: 'Tipo',
  category: 'Categoria', description: 'Descrição', discount_amount: 'Desconto', subtotal: 'Subtotal',
  sale_number: 'Nº Venda', is_deleted: 'Excluído', deleted_at: 'Excluído em',
  previous_closing_snapshot: 'Snapshot Anterior',
};

function formatDataValue(key: string, value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (key.includes('balance') || key.includes('total') || key.includes('amount') || key === 'subtotal')
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    return String(value);
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    try { return format(new Date(value), "dd/MM/yy HH:mm", { locale: ptBR }); } catch { return value; }
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    try { return format(new Date(value + 'T00:00:00'), "dd/MM/yyyy"); } catch { return value; }
  }
  return String(value);
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="text-muted-foreground text-xs shrink-0 pt-0.5">{label}</span>
      {children || <span className="font-medium text-xs text-right break-all">{value}</span>}
    </div>
  );
}

function DataTable({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data).filter(([k]) => k !== 'previous_closing_snapshot');
  return (
    <div className="rounded-lg border bg-muted/30 divide-y">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-start justify-between gap-3 px-3 py-2">
          <span className="text-muted-foreground text-xs shrink-0 pt-0.5">{DATA_LABELS[key] || key}</span>
          <span className="font-medium text-xs text-right break-all max-w-[60%]">{formatDataValue(key, val)}</span>
        </div>
      ))}
    </div>
  );
}

function DiffView({ oldData, newData }: { oldData: Record<string, any>; newData: Record<string, any> }) {
  const allKeys = [...new Set([...Object.keys(oldData), ...Object.keys(newData)])];
  const changed = allKeys.filter(k => {
    if (k === 'previous_closing_snapshot') return false;
    return JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]);
  });

  if (changed.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Nenhuma alteração detectada.</p>;
  }

  return (
    <div className="rounded-lg border bg-muted/30 divide-y">
      {changed.map(key => (
        <div key={key} className="px-3 py-2 space-y-1">
          <p className="text-xs font-medium">{DATA_LABELS[key] || key}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded break-all">
              {formatDataValue(key, oldData[key])}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded break-all">
              {formatDataValue(key, newData[key])}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MfaSettingsSection({ profiles, auditLogs }: { profiles: any[]; auditLogs: any[] }) {
  const adminProfiles = profiles.filter(p => p.role === 'admin' && p.is_active);

  // MFA audit events
  const mfaEvents = useMemo(() =>
    auditLogs.filter(l =>
      l.event_type?.startsWith('mfa_') || l.event_type === 'admin_access_blocked_missing_mfa'
    ).slice(0, 10),
    [auditLogs]
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Autenticação Multifator (MFA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs text-foreground leading-relaxed">
              <strong>MFA obrigatório para administradores.</strong> Todo admin precisa configurar
              verificação em duas etapas (TOTP) para acessar o sistema. Caixas e voluntários não
              precisam de MFA neste momento.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">MFA para Admins</span>
              <Badge variant="default" className="bg-primary">Obrigatório</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">MFA para Caixas</span>
              <Badge variant="outline">Opcional (futuro)</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">MFA para Voluntários</span>
              <Badge variant="outline">Não aplicável</Badge>
            </div>
          </div>

          {/* Admin MFA status list */}
          {adminProfiles.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">Administradores</p>
              {adminProfiles.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm truncate">{p.full_name}</span>
                  <Badge variant="secondary" className="text-[10px]">Admin</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MFA Audit Events */}
      {mfaEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Eventos MFA Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mfaEvents.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {EVENT_LABELS[l.event_type] || l.event_type}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt(l.created_at)}</p>
                </div>
                <Badge className={SEVERITY_COLORS[l.severity] || ''}>{l.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SessionSettingsSection({ profiles, auditLogs }: { profiles: any[]; auditLogs: any[] }) {
  const activeProfiles = profiles.filter(p => p.is_active && p.approval_status === 'approved');
  
  const sessionEvents = useMemo(() =>
    auditLogs.filter(l =>
      l.event_type === 'session_invalidated_by_new_login' ||
      l.event_type === 'single_session_policy_applied' ||
      l.event_type === 'forced_reauthentication'
    ).slice(0, 10),
    [auditLogs]
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Configurações de Sessão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs text-foreground leading-relaxed">
              <strong>Sessão única por usuário.</strong> Cada usuário pode ter apenas uma sessão ativa
              por vez. Ao fazer login em outro dispositivo, a sessão anterior é encerrada automaticamente.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Sessão única por usuário</span>
              <Badge variant="default" className="bg-primary">Ativa</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Revalidação de sessão</span>
              <Badge variant="default">Ativa (2 min)</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Logout seguro</span>
              <Badge variant="default">Ativo</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Validação ao retornar</span>
              <Badge variant="default">Ativa</Badge>
            </div>
          </div>

          {/* Last login per user */}
          {activeProfiles.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">Último Login</p>
              {activeProfiles.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <span className="text-sm truncate block">{p.full_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.role === 'admin' ? 'Admin' : p.role === 'cashier' ? 'Caixa' : 'Voluntário'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    {p.last_login_at ? (
                      <span className="text-xs text-muted-foreground">{fmt(p.last_login_at)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Audit Events */}
      {sessionEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Eventos de Sessão Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessionEvents.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {EVENT_LABELS[l.event_type] || l.event_type}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt(l.created_at)}</p>
                </div>
                <Badge className={SEVERITY_COLORS[l.severity] || ''}>{l.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
