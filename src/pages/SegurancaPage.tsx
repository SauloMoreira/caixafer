import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield, Activity, AlertTriangle, Users, Lock, Unlock, ArrowRightLeft,
  ChevronDown, ChevronRight, Search, Filter, Eye, FileEdit, Trash2,
  RotateCcw, CheckCircle2, XCircle, Clock, Bell, RefreshCw
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Constants ───
const EVENT_LABELS: Record<string, string> = {
  cash_transfer_requested: 'Transferência solicitada',
  cash_transfer_accepted: 'Transferência aceita',
  cash_transfer_rejected: 'Transferência recusada',
  cash_transfer_cancelled: 'Transferência cancelada',
  cash_responsibility_changed: 'Responsabilidade alterada',
  sale_created: 'Venda criada',
  sale_updated: 'Venda editada',
  sale_deleted: 'Venda excluída',
  cash_entry_created: 'Lançamento criado',
  cash_entry_updated: 'Lançamento editado',
  cash_entry_deleted: 'Lançamento excluído',
  cash_opened: 'Caixa aberto',
  cash_closed: 'Caixa fechado',
  cash_reopened: 'Caixa reaberto',
  cash_updated: 'Caixa atualizado',
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
  unauthorized_data_access_attempt: 'Tentativa acesso',
  mfa_enrollment_started: 'MFA: início',
  mfa_enrollment_verified: 'MFA: ativado',
  mfa_enrollment_failed: 'MFA: falha',
  mfa_login_verified: 'MFA: verificado',
  mfa_login_failed: 'MFA: falha login',
  admin_access_blocked_missing_mfa: 'Bloqueado (sem MFA)',
  session_invalidated_by_new_login: 'Sessão invalidada',
  single_session_policy_applied: 'Sessão única',
  forced_reauthentication: 'Reautenticação',
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  critical: 'bg-red-200 text-red-900 dark:bg-red-950/50 dark:text-red-200',
};

const ENTITY_STYLES: Record<string, string> = {
  cash_closings: 'bg-primary/10 text-primary',
  cash_session_transfers: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  cash_entries: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  sales: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  profiles: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  spr_fiado_charges: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  spr_fiado_payments: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
};

const ENTITY_LABELS: Record<string, string> = {
  cash_closings: 'Caixa',
  cash_session_transfers: 'Transferência',
  cash_entries: 'Lançamento',
  sales: 'Venda',
  profiles: 'Perfil',
  spr_fiado_charges: 'Fiado',
  spr_fiado_payments: 'Pgto Fiado',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído',
  pending: 'Pendente',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
};

const TRANSFER_EVENTS = ['cash_transfer_requested', 'cash_transfer_accepted', 'cash_transfer_rejected', 'cash_transfer_cancelled', 'cash_responsibility_changed'];
const CASH_CHANGE_EVENTS = ['cash_entry_created', 'cash_entry_updated', 'cash_entry_deleted', 'cash_opened', 'cash_closed', 'cash_reopened', 'cash_updated', 'sale_created', 'sale_updated', 'sale_deleted'];
const INCIDENT_EVENTS = ['unauthorized_route_access', 'unauthorized_data_access_attempt', 'session_invalidated_by_new_login', 'admin_access_blocked_missing_mfa', 'mfa_login_failed', 'forced_reauthentication'];

function fmt(dateStr: string) {
  return format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR });
}
function fmtDate(dateStr: string) {
  try { return format(new Date(dateStr + 'T00:00:00'), "dd/MM/yyyy"); } catch { return dateStr; }
}
function currency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const todayStr = () => new Date().toISOString().split('T')[0];

export default function SegurancaPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [detailLog, setDetailLog] = useState<any>(null);

  // ─── Data Queries ───
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

  const { data: incidents = [] } = useQuery({
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

  const { data: transfers = [] } = useQuery({
    queryKey: ['security-transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_session_transfers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['security-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Resolve user names
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    auditLogs.forEach(l => {
      if (l.user_id) ids.add(l.user_id);
      if (l.target_user_id) ids.add(l.target_user_id);
    });
    transfers.forEach(t => { ids.add(t.from_user_id); ids.add(t.to_user_id); });
    incidents.forEach(i => { if (i.user_id) ids.add(i.user_id); });
    return Array.from(ids);
  }, [auditLogs, transfers, incidents]);

  const { data: userNames = {} } = useQuery({
    queryKey: ['security-user-names', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase.rpc('get_user_names', { _user_ids: userIds });
      return Object.fromEntries((data || []).map((p: any) => [p.id, p.full_name]));
    },
    enabled: userIds.length > 0,
  });

  // ─── Realtime ───
  useEffect(() => {
    const channel = supabase
      .channel('security-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_audit_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['security-audit-logs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ─── Overview Stats ───
  const today = todayStr();
  const todayLogs = auditLogs.filter(l => l.business_date === today || l.created_at?.startsWith(today));
  const transfersToday = todayLogs.filter(l => TRANSFER_EVENTS.includes(l.event_type)).length;
  const changesToday = todayLogs.filter(l => CASH_CHANGE_EVENTS.includes(l.event_type)).length;
  const deletionsToday = todayLogs.filter(l => l.event_type?.includes('deleted')).length;
  const reopensToday = todayLogs.filter(l => l.event_type === 'cash_reopened').length;
  const pendingIncidents = incidents.filter(i => !i.resolved).length;
  const unreadNotifs = notifications.filter(n => !n.is_read).length;
  const pendingReview = auditLogs.filter(l => (l as any).requires_admin_review && (l as any).status === 'pending').length;

  // ─── Filtering ───
  const getTabLogs = (tabName: string) => {
    let base = auditLogs;
    if (tabName === 'transfers') base = auditLogs.filter(l => TRANSFER_EVENTS.includes(l.event_type));
    if (tabName === 'changes') base = auditLogs.filter(l => CASH_CHANGE_EVENTS.includes(l.event_type));
    if (tabName === 'incidents') base = auditLogs.filter(l => INCIDENT_EVENTS.includes(l.event_type));
    return applyFilters(base);
  };

  const applyFilters = (logs: any[]) => {
    return logs.filter(l => {
      if (severityFilter !== 'all' && l.severity !== severityFilter) return false;
      if (entityFilter !== 'all' && l.entity_type !== entityFilter) return false;
      if (statusFilter !== 'all' && (l as any).status !== statusFilter) return false;
      if (reviewFilter === 'review' && !(l as any).requires_admin_review) return false;
      if (search) {
        const s = search.toLowerCase();
        const label = (EVENT_LABELS[l.event_type] || l.event_type).toLowerCase();
        const summary = ((l as any).action_summary || '').toLowerCase();
        const actorName = (userNames as any)[l.user_id]?.toLowerCase() || '';
        const targetName = (userNames as any)[l.target_user_id]?.toLowerCase() || '';
        const reason = ((l as any).reason || '').toLowerCase();
        return label.includes(s) || summary.includes(s) || actorName.includes(s) || targetName.includes(s) || reason.includes(s) || l.entity_type?.toLowerCase().includes(s);
      }
      return true;
    });
  };

  const getName = (id: string | null) => id ? ((userNames as any)[id] || '—') : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-xl font-bold">Central de Segurança</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="text-xs px-2 py-2">Visão Geral</TabsTrigger>
          <TabsTrigger value="transfers" className="text-xs px-2 py-2">Transferências</TabsTrigger>
          <TabsTrigger value="changes" className="text-xs px-2 py-2">Alterações</TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs px-2 py-2">Incidentes</TabsTrigger>
        </TabsList>

        {/* ═══ VISÃO GERAL ═══ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon={ArrowRightLeft} label="Transferências hoje" value={transfersToday} />
            <StatCard icon={FileEdit} label="Alterações hoje" value={changesToday} />
            <StatCard icon={Trash2} label="Exclusões hoje" value={deletionsToday} color={deletionsToday > 0 ? 'text-destructive' : undefined} />
            <StatCard icon={RotateCcw} label="Reaberturas hoje" value={reopensToday} color={reopensToday > 0 ? 'text-amber-600' : undefined} />
            <StatCard icon={AlertTriangle} label="Incidentes pendentes" value={pendingIncidents} color={pendingIncidents > 0 ? 'text-destructive' : undefined} />
            <StatCard icon={Bell} label="Notificações não lidas" value={unreadNotifs} color={unreadNotifs > 0 ? 'text-amber-600' : undefined} />
          </div>

          {pendingReview > 0 && (
            <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{pendingReview} evento(s) aguardando revisão</p>
                  <p className="text-xs text-muted-foreground">Clique em "Alterações" para revisar</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Eventos Críticos Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {auditLogs.filter(l => l.severity === 'high' || l.severity === 'critical').slice(0, 8).map(l => (
                <LogRow key={l.id} log={l} getName={getName} onClick={() => setDetailLog(l)} compact />
              ))}
              {auditLogs.filter(l => l.severity === 'high' || l.severity === 'critical').length === 0 && (
                <p className="text-sm text-muted-foreground py-2">Nenhum evento crítico recente.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Últimas Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {auditLogs.slice(0, 10).map(l => (
                <LogRow key={l.id} log={l} getName={getName} onClick={() => setDetailLog(l)} compact />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TRANSFERÊNCIAS ═══ */}
        <TabsContent value="transfers" className="space-y-4 mt-4">
          <FilterBar search={search} setSearch={setSearch} severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
            entityFilter={entityFilter} setEntityFilter={setEntityFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            reviewFilter={reviewFilter} setReviewFilter={setReviewFilter} />
          <LogList logs={getTabLogs('transfers')} loading={loadingAudit} getName={getName} onDetail={setDetailLog} />
        </TabsContent>

        {/* ═══ ALTERAÇÕES ═══ */}
        <TabsContent value="changes" className="space-y-4 mt-4">
          <FilterBar search={search} setSearch={setSearch} severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
            entityFilter={entityFilter} setEntityFilter={setEntityFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            reviewFilter={reviewFilter} setReviewFilter={setReviewFilter} />
          <LogList logs={getTabLogs('changes')} loading={loadingAudit} getName={getName} onDetail={setDetailLog} />
        </TabsContent>

        {/* ═══ INCIDENTES ═══ */}
        <TabsContent value="incidents" className="space-y-4 mt-4">
          <FilterBar search={search} setSearch={setSearch} severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
            entityFilter={entityFilter} setEntityFilter={setEntityFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            reviewFilter={reviewFilter} setReviewFilter={setReviewFilter} />
          
          {incidents.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Incidentes de Segurança</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {incidents.slice(0, 50).map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{i.incident_type}</span>
                        <Badge className={`${SEVERITY_STYLES[i.severity] || ''} text-[10px]`}>{i.severity}</Badge>
                        <Badge variant={i.resolved ? 'secondary' : 'destructive'} className="text-[10px]">
                          {i.resolved ? 'Resolvido' : 'Aberto'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getName(i.user_id)} • {i.route || '—'} • {fmt(i.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <LogList logs={getTabLogs('incidents')} loading={loadingAudit} getName={getName} onDetail={setDetailLog} />
        </TabsContent>
      </Tabs>

      {/* ═══ Detail Dialog ═══ */}
      <Dialog open={!!detailLog} onOpenChange={open => !open && setDetailLog(null)}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">Detalhes do Evento</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[70vh] px-4 pb-4">
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border bg-muted/30 divide-y">
                  <DetailRow label="Evento" value={EVENT_LABELS[detailLog.event_type] || detailLog.event_type} />
                  <DetailRow label="Resumo" value={detailLog.action_summary || '—'} />
                  <DetailRow label="Entidade">
                    <Badge className={`${ENTITY_STYLES[detailLog.entity_type] || ''} text-[10px]`}>
                      {ENTITY_LABELS[detailLog.entity_type] || detailLog.entity_type}
                    </Badge>
                  </DetailRow>
                  <DetailRow label="Severidade">
                    <Badge className={`${SEVERITY_STYLES[detailLog.severity] || ''} text-[10px]`}>{detailLog.severity}</Badge>
                  </DetailRow>
                  {detailLog.status && (
                    <DetailRow label="Status">
                      <Badge className={`${STATUS_STYLES[detailLog.status] || ''} text-[10px]`}>
                        {STATUS_LABELS[detailLog.status] || detailLog.status}
                      </Badge>
                    </DetailRow>
                  )}
                  <DetailRow label="Executado por" value={getName(detailLog.user_id)} />
                  <DetailRow label="Papel" value={detailLog.user_role || '—'} />
                  {detailLog.target_user_id && <DetailRow label="Usuário afetado" value={getName(detailLog.target_user_id)} />}
                  {(detailLog as any).target_role && <DetailRow label="Papel afetado" value={(detailLog as any).target_role} />}
                  <DetailRow label="Data/hora" value={fmt(detailLog.created_at)} />
                  {detailLog.business_date && <DetailRow label="Data operacional" value={fmtDate(detailLog.business_date)} />}
                  {(detailLog as any).session_id && <DetailRow label="Sessão" value={(detailLog as any).session_id} />}
                  {(detailLog as any).reason && <DetailRow label="Motivo" value={(detailLog as any).reason} />}
                  {detailLog.route && <DetailRow label="Rota" value={detailLog.route} />}
                  {detailLog.notes && <DetailRow label="Notas" value={detailLog.notes} />}
                  {(detailLog as any).requires_admin_review && (
                    <DetailRow label="Revisão">
                      <Badge variant="destructive" className="text-[10px]">Exige revisão</Badge>
                    </DetailRow>
                  )}
                </div>

                {detailLog.old_data && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Dados Anteriores</p>
                    <DataTable data={detailLog.old_data} />
                  </div>
                )}
                {detailLog.new_data && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Dados Novos</p>
                    <DataTable data={detailLog.new_data} />
                  </div>
                )}
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

// ─── Components ───

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className={`h-5 w-5 shrink-0 ${color || 'text-primary'}`} />
        <div>
          <p className={`text-lg font-bold leading-none ${color || ''}`}>{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterBar({ search, setSearch, severityFilter, setSeverityFilter, entityFilter, setEntityFilter, statusFilter, setStatusFilter, reviewFilter, setReviewFilter }: any) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, motivo, evento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Severidade</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Entidade</SelectItem>
            <SelectItem value="cash_closings">Caixa</SelectItem>
            <SelectItem value="cash_session_transfers">Transferência</SelectItem>
            <SelectItem value="cash_entries">Lançamento</SelectItem>
            <SelectItem value="sales">Venda</SelectItem>
            <SelectItem value="profiles">Perfil</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Revisão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="review">Exige revisão</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function LogList({ logs, loading, getName, onDetail }: { logs: any[]; loading: boolean; getName: (id: string | null) => string; onDetail: (l: any) => void }) {
  if (loading) return <p className="text-sm text-muted-foreground py-4">Carregando...</p>;
  if (logs.length === 0) return <p className="text-sm text-muted-foreground py-4">Nenhum registro encontrado.</p>;
  return (
    <div className="space-y-1.5">
      {logs.slice(0, 100).map(l => <LogRow key={l.id} log={l} getName={getName} onClick={() => onDetail(l)} />)}
      {logs.length > 100 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 100 de {logs.length} registros</p>}
    </div>
  );
}

function LogRow({ log, getName, onClick, compact }: { log: any; getName: (id: string | null) => string; onClick: () => void; compact?: boolean }) {
  const l = log;
  return (
    <div
      className="flex items-start gap-2 py-2 px-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">{EVENT_LABELS[l.event_type] || l.event_type}</span>
          <Badge className={`${SEVERITY_STYLES[l.severity] || ''} text-[9px] px-1.5 py-0`}>{l.severity}</Badge>
          <Badge className={`${ENTITY_STYLES[l.entity_type] || 'bg-muted text-muted-foreground'} text-[9px] px-1.5 py-0`}>
            {ENTITY_LABELS[l.entity_type] || l.entity_type}
          </Badge>
          {l.status && l.status !== 'completed' && (
            <Badge className={`${STATUS_STYLES[l.status] || ''} text-[9px] px-1.5 py-0`}>
              {STATUS_LABELS[l.status] || l.status}
            </Badge>
          )}
          {l.requires_admin_review && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Revisão</Badge>
          )}
          {l.user_role && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">{l.user_role}</Badge>
          )}
        </div>
        {!compact && l.action_summary && (
          <p className="text-xs text-foreground/80 mt-0.5 truncate">{l.action_summary}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {getName(l.user_id)}
          {l.target_user_id && ` → ${getName(l.target_user_id)}`}
          {' • '}{fmt(l.created_at)}
          {l.business_date && ` • ${fmtDate(l.business_date)}`}
        </p>
      </div>
      <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="text-muted-foreground text-xs shrink-0 pt-0.5">{label}</span>
      {children || <span className="font-medium text-xs text-right break-all">{value}</span>}
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
  from_user: 'De', to_user: 'Para', transfer_id: 'ID Transferência',
  session_snapshot: 'Snapshot da Sessão', transfer_reason: 'Motivo', transfer_count: 'Nº Transferências',
  current_responsible_id: 'Responsável Atual', from_user_id: 'Usuário Origem', to_user_id: 'Usuário Destino',
  amount_paid: 'Valor Pago', payment_date: 'Data Pagamento',
};

function formatDataValue(key: string, value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (typeof value === 'number') {
    if (key.includes('balance') || key.includes('total') || key.includes('amount') || key === 'subtotal' || key === 'amount_paid')
      return currency(value);
    return String(value);
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    try { return format(new Date(value), "dd/MM/yy HH:mm", { locale: ptBR }); } catch { return value; }
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    try { return fmtDate(value); } catch { return value; }
  }
  return String(value);
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

  if (changed.length === 0) return <p className="text-xs text-muted-foreground italic">Nenhuma alteração detectada.</p>;

  return (
    <div className="rounded-lg border bg-muted/30 divide-y">
      {changed.map(key => (
        <div key={key} className="px-3 py-2 space-y-1">
          <p className="text-xs font-medium">{DATA_LABELS[key] || key}</p>
          <div className="flex items-center gap-2 text-xs flex-wrap">
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
