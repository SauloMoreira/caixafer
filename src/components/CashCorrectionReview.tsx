import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime, todayISO, PAYMENT_METHODS, DOCUMENT_TYPES, ENTRY_CATEGORIES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ShoppingCart, TrendingUp, TrendingDown, Heart, Edit, Trash2,
  ArrowLeft, Filter, AlertTriangle, Shield, History, X, Check
} from 'lucide-react';
import CriticalActionDialog from '@/components/CriticalActionDialog';

interface CashCorrectionReviewProps {
  businessDate: string;
  closingId: string;
  onClose: () => void;
  onDataChanged: () => void;
}

type EntryItem = {
  id: string;
  type: 'sale' | 'income' | 'expense' | 'spr_payment';
  description: string;
  amount: number;
  payment_method: string | null;
  created_at: string;
  created_by: string;
  creator_name?: string;
  is_deleted: boolean;
  status?: string;
  raw: any;
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'sale', label: 'Vendas' },
  { value: 'income', label: 'Entradas' },
  { value: 'expense', label: 'Saídas' },
  { value: 'spr_payment', label: 'Pagamentos SPR' },
  { value: 'modified', label: 'Alterados' },
  { value: 'deleted', label: 'Excluídos' },
];

const TYPE_CONFIG: Record<string, { icon: typeof ShoppingCart; label: string; color: string }> = {
  sale: { icon: ShoppingCart, label: 'Venda', color: 'bg-primary/10 text-primary' },
  income: { icon: TrendingUp, label: 'Entrada', color: 'bg-income/10 text-income' },
  expense: { icon: TrendingDown, label: 'Saída', color: 'bg-expense/10 text-expense' },
  spr_payment: { icon: Heart, label: 'Pagamento SPR', color: 'bg-accent/10 text-accent-foreground' },
};

export default function CashCorrectionReview({ businessDate, closingId, onClose, onDataChanged }: CashCorrectionReviewProps) {
  const { profile, isAdmin } = useAuth();
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<EntryItem | null>(null);
  const [editEntry, setEditEntry] = useState<EntryItem | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<EntryItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [editReason, setEditReason] = useState('');
  const [auditHistory, setAuditHistory] = useState<any[]>([]);

  // Edit form state
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDocumentType, setEditDocumentType] = useState('');
  const [editDocumentRef, setEditDocumentRef] = useState('');
  const [saving, setSaving] = useState(false);

  const canModify = useCallback((entry: EntryItem) => {
    if (entry.is_deleted) return false;
    if (isAdmin) return true;
    return entry.business_date === todayISO() || businessDate === todayISO();
  }, [isAdmin, businessDate]);

  const fetchEntries = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const items: EntryItem[] = [];

    // Fetch sales (include soft-deleted)
    let salesQ = supabase
      .from('sales')
      .select('*, profiles!sales_created_by_fkey(full_name)')
      .eq('business_date', businessDate);
    if (!isAdmin) salesQ = salesQ.eq('created_by', profile.id);
    const { data: sales } = await salesQ;
    sales?.forEach((s: any) => {
      items.push({
        id: s.id,
        type: 'sale',
        description: `Venda #${s.sale_number}`,
        amount: Number(s.total_amount),
        payment_method: s.payment_method,
        created_at: s.created_at,
        created_by: s.created_by,
        creator_name: s.profiles?.full_name,
        is_deleted: s.is_deleted || false,
        status: s.status || 'active',
        raw: s,
      });
    });

    // Fetch cash entries (include soft-deleted)
    let entriesQ = supabase
      .from('cash_entries')
      .select('*, profiles!cash_entries_created_by_fkey(full_name)')
      .eq('business_date', businessDate);
    if (!isAdmin) entriesQ = entriesQ.eq('created_by', profile.id);
    const { data: cashEntries } = await entriesQ;
    cashEntries?.forEach((e: any) => {
      if (e.source_type === 'spr_fiado_payment') {
        items.push({
          id: e.id,
          type: 'spr_payment',
          description: e.description || 'Pagamento SPR',
          amount: Number(e.amount),
          payment_method: e.payment_method,
          created_at: e.created_at,
          created_by: e.created_by,
          creator_name: e.profiles?.full_name,
          is_deleted: e.is_deleted || false,
          raw: e,
        });
      } else {
        items.push({
          id: e.id,
          type: e.entry_type === 'income' ? 'income' : 'expense',
          description: e.description || e.category,
          amount: Number(e.amount),
          payment_method: e.payment_method,
          created_at: e.created_at,
          created_by: e.created_by,
          creator_name: e.profiles?.full_name,
          is_deleted: e.is_deleted || false,
          raw: e,
        });
      }
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEntries(items);
    setLoading(false);
  }, [profile, businessDate, isAdmin]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const fetchAuditHistory = useCallback(async (entityId: string) => {
    if (!isAdmin) { setAuditHistory([]); return; }
    const { data } = await supabase
      .from('security_audit_logs')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(20);
    setAuditHistory(data || []);
  }, [isAdmin]);

  const openDetail = (entry: EntryItem) => {
    setSelectedEntry(entry);
    fetchAuditHistory(entry.id);
  };

  const openEdit = (entry: EntryItem) => {
    setEditEntry(entry);
    setEditDescription(entry.raw.description || entry.raw.category || '');
    setEditAmount(String(entry.amount));
    setEditPaymentMethod(entry.raw.payment_method || '');
    setEditNotes(entry.raw.notes || '');
    setEditDocumentType(entry.raw.document_type || '');
    setEditDocumentRef(entry.raw.document_reference || '');
    setEditReason('');
    setSelectedEntry(null);
  };

  const handleSaveEdit = async () => {
    if (!editEntry || !profile) return;
    if (!editReason.trim()) {
      toast.error('Informe o motivo da alteração.');
      return;
    }
    setSaving(true);

    const oldData = { ...editEntry.raw };
    delete oldData.profiles;

    try {
      if (editEntry.type === 'sale') {
        const newAmount = Number(editAmount);
        const { error } = await supabase.from('sales').update({
          total_amount: newAmount,
          subtotal: newAmount,
          notes: editNotes || null,
          payment_method: editPaymentMethod as any,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        } as any).eq('id', editEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cash_entries').update({
          description: editDescription || null,
          amount: Number(editAmount),
          payment_method: editPaymentMethod as any,
          document_type: editDocumentType as any || null,
          document_reference: editDocumentRef || null,
          notes: editNotes || null,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        } as any).eq('id', editEntry.id);
        if (error) throw error;
      }

      // Audit log
      await supabase.from('security_audit_logs').insert({
        event_type: editEntry.type === 'sale' ? 'sale_corrected' : editEntry.type === 'spr_payment' ? 'spr_payment_corrected' : 'cash_entry_corrected',
        entity_type: editEntry.type === 'sale' ? 'sales' : 'cash_entries',
        entity_id: editEntry.id,
        user_id: profile.id,
        action: 'UPDATE',
        business_date: businessDate,
        severity: 'high',
        notes: `Correção em caixa reaberto. Motivo: ${editReason}`,
        old_data: oldData,
        new_data: {
          amount: Number(editAmount),
          description: editDescription,
          payment_method: editPaymentMethod,
          notes: editNotes,
        },
        route: '/fechamento',
      });

      // Notify admins
      await notifyAdmins(
        `Lançamento corrigido no caixa de ${new Date(businessDate).toLocaleDateString('pt-BR')}`,
        `${profile.full_name} corrigiu um lançamento (${TYPE_CONFIG[editEntry.type]?.label}). Valor anterior: ${formatCurrency(editEntry.amount)} → Novo: ${formatCurrency(Number(editAmount))}. Motivo: ${editReason}`,
      );

      toast.success('Lançamento corrigido com sucesso!');
      setEditEntry(null);
      fetchEntries();
      onDataChanged();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteEntry || !profile) return;
    if (!deleteReason.trim()) {
      toast.error('Informe o motivo da exclusão.');
      return;
    }
    setSaving(true);

    try {
      if (deleteEntry.type === 'sale') {
        const { error } = await supabase.from('sales').update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: profile.id,
          deletion_reason: deleteReason,
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        } as any).eq('id', deleteEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cash_entries').update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: profile.id,
          deletion_reason: deleteReason,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        } as any).eq('id', deleteEntry.id);
        if (error) throw error;
      }

      // Audit log
      const oldData = { ...deleteEntry.raw };
      delete oldData.profiles;
      await supabase.from('security_audit_logs').insert({
        event_type: deleteEntry.type === 'sale' ? 'sale_cancelled' : deleteEntry.type === 'spr_payment' ? 'spr_payment_deleted' : 'cash_entry_deleted',
        entity_type: deleteEntry.type === 'sale' ? 'sales' : 'cash_entries',
        entity_id: deleteEntry.id,
        user_id: profile.id,
        action: 'SOFT_DELETE',
        business_date: businessDate,
        severity: 'critical',
        notes: `Exclusão em caixa reaberto. Motivo: ${deleteReason}`,
        old_data: oldData,
        route: '/fechamento',
      });

      await notifyAdmins(
        `Lançamento excluído no caixa de ${new Date(businessDate).toLocaleDateString('pt-BR')}`,
        `${profile.full_name} excluiu um lançamento (${TYPE_CONFIG[deleteEntry.type]?.label}) de ${formatCurrency(deleteEntry.amount)}. Motivo: ${deleteReason}`,
      );

      toast.success('Lançamento excluído com sucesso.');
      setDeleteEntry(null);
      setDeleteReason('');
      fetchEntries();
      onDataChanged();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
    setSaving(false);
  };

  const notifyAdmins = async (title: string, message: string) => {
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin' as any)
        .eq('is_active', true);
      if (!admins) return;
      const notifications = admins
        .filter(a => a.id !== profile?.id)
        .map(a => ({
          user_id: a.id,
          type: 'cash_correction' as any,
          title,
          message,
          reference_type: 'cash_closings',
          reference_id: closingId,
        }));
      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    } catch {}
  };

  const filtered = entries.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'modified') return auditHistory.length > 0 || e.raw.updated_by;
    if (filter === 'deleted') return e.is_deleted;
    return e.type === filter;
  });

  const pmLabel = (v: string | null) => PAYMENT_METHODS.find(m => m.value === v)?.label || v || '—';
  const dtLabel = (v: string | null) => DOCUMENT_TYPES.find(d => d.value === v)?.label || v || '—';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold font-heading truncate">Correção de Lançamentos</h2>
          <p className="text-xs text-muted-foreground">
            Caixa de {new Date(businessDate).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
        <Shield className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
        <p className="text-xs text-muted-foreground">
          Todas as alterações serão <strong>registradas em auditoria</strong> e notificadas aos administradores.
          {!isAdmin && ' Você pode corrigir apenas lançamentos do dia atual.'}
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_OPTIONS.map(f => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 h-8 text-xs rounded-full"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Entry list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Nenhum lançamento encontrado</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const config = TYPE_CONFIG[entry.type];
            const Icon = config.icon;
            return (
              <Card
                key={`${entry.type}-${entry.id}`}
                className={`cursor-pointer transition-colors hover:bg-muted/30 ${entry.is_deleted ? 'opacity-50' : ''}`}
                onClick={() => openDetail(entry)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{entry.description}</p>
                      {entry.is_deleted && <Badge variant="destructive" className="text-[9px] shrink-0">Excluído</Badge>}
                      {entry.raw.updated_by && !entry.is_deleted && <Badge variant="secondary" className="text-[9px] shrink-0">Editado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {config.label} · {formatDateTime(entry.created_at)}
                      {entry.payment_method && ` · ${pmLabel(entry.payment_method)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold text-sm tabular-nums ${
                      entry.is_deleted ? 'line-through text-muted-foreground' :
                      entry.type === 'expense' ? 'text-expense' : 'text-income'
                    }`}>
                      {entry.type === 'expense' ? '-' : '+'}{formatCurrency(entry.amount)}
                    </p>
                    {entry.creator_name && (
                      <p className="text-[10px] text-muted-foreground">{entry.creator_name}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={open => { if (!open) setSelectedEntry(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedEntry && (() => {
                const cfg = TYPE_CONFIG[selectedEntry.type];
                const Icon = cfg.icon;
                return <><Icon className="h-4 w-4" />{selectedEntry.description}</>;
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-medium">{TYPE_CONFIG[selectedEntry.type].label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold">{formatCurrency(selectedEntry.amount)}</span></div>
                {selectedEntry.payment_method && <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span>{pmLabel(selectedEntry.payment_method)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Data/Hora</span><span>{formatDateTime(selectedEntry.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Responsável</span><span>{selectedEntry.creator_name || '—'}</span></div>
                {selectedEntry.raw.category && <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span>{selectedEntry.raw.category}</span></div>}
                {selectedEntry.raw.document_type && <div className="flex justify-between"><span className="text-muted-foreground">Documento</span><span>{dtLabel(selectedEntry.raw.document_type)}</span></div>}
                {selectedEntry.raw.document_reference && <div className="flex justify-between"><span className="text-muted-foreground">Referência</span><span>{selectedEntry.raw.document_reference}</span></div>}
                {selectedEntry.raw.notes && <div className="flex justify-between"><span className="text-muted-foreground">Observações</span><span className="text-right max-w-[60%]">{selectedEntry.raw.notes}</span></div>}
                {selectedEntry.is_deleted && (
                  <>
                    <div className="border-t pt-2 mt-2" />
                    <div className="flex justify-between"><span className="text-destructive">Status</span><span className="text-destructive font-medium">Excluído</span></div>
                    {selectedEntry.raw.deletion_reason && <div className="flex justify-between"><span className="text-muted-foreground">Motivo</span><span className="text-right max-w-[60%]">{selectedEntry.raw.deletion_reason}</span></div>}
                    {selectedEntry.raw.deleted_at && <div className="flex justify-between"><span className="text-muted-foreground">Excluído em</span><span>{formatDateTime(selectedEntry.raw.deleted_at)}</span></div>}
                  </>
                )}
              </div>

              {/* Audit history */}
              {isAdmin && auditHistory.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <History className="h-3 w-3" /> Histórico de alterações
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {auditHistory.map(log => (
                      <div key={log.id} className="rounded-lg border p-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <Badge variant="outline" className="text-[9px]">{log.action}</Badge>
                          <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                        </div>
                        {log.notes && <p className="text-muted-foreground">{log.notes}</p>}
                        {log.old_data && log.new_data && (
                          <div className="grid grid-cols-2 gap-1 rounded bg-muted/50 p-1.5">
                            <div>
                              <p className="font-medium text-[10px] text-muted-foreground mb-0.5">Antes</p>
                              {log.old_data.amount != null && <p>R$ {Number(log.old_data.amount).toFixed(2)}</p>}
                            </div>
                            <div>
                              <p className="font-medium text-[10px] text-muted-foreground mb-0.5">Depois</p>
                              {log.new_data.amount != null && <p>R$ {Number(log.new_data.amount).toFixed(2)}</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {canModify(selectedEntry) && (
                <div className="flex gap-2">
                  <Button className="flex-1 h-11" variant="outline" onClick={() => openEdit(selectedEntry)}>
                    <Edit className="mr-1 h-4 w-4" /> Editar
                  </Button>
                  <Button
                    className="flex-1 h-11"
                    variant="destructive"
                    onClick={() => { setDeleteEntry(selectedEntry); setDeleteReason(''); setSelectedEntry(null); }}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={open => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Editar Lançamento</DialogTitle>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 border p-2 text-xs text-muted-foreground">
                <p>Original: {editEntry.description} · {formatCurrency(editEntry.amount)}</p>
              </div>

              {editEntry.type !== 'sale' && (
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="h-11" />
                </div>
              )}

              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-11" />
              </div>

              <div>
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {editEntry.type !== 'sale' && (
                <>
                  <div>
                    <Label className="text-xs">Tipo de Documento</Label>
                    <Select value={editDocumentType} onValueChange={setEditDocumentType}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>{DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Referência do Documento</Label>
                    <Input value={editDocumentRef} onChange={e => setEditDocumentRef(e.target.value)} className="h-11" />
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs">Observações</Label>
                <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-11" />
              </div>

              <div>
                <Label className="text-xs font-semibold">Motivo da alteração *</Label>
                <Textarea
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="Descreva o motivo da correção..."
                  className="mt-1 min-h-[60px]"
                />
              </div>

              {editAmount && Number(editAmount) !== editEntry.amount && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-2 text-xs">
                  <p className="font-medium text-warning">Resumo da alteração</p>
                  <p className="text-muted-foreground mt-1">
                    Valor: {formatCurrency(editEntry.amount)} → {formatCurrency(Number(editAmount))}
                    {' '}({Number(editAmount) > editEntry.amount ? '+' : ''}{formatCurrency(Number(editAmount) - editEntry.amount)})
                  </p>
                </div>
              )}

              <Button className="w-full h-11" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Salvando...' : 'Confirmar Correção'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <CriticalActionDialog
        open={!!deleteEntry}
        onOpenChange={open => { if (!open) { setDeleteEntry(null); setDeleteReason(''); } }}
        title="Excluir Lançamento"
        description="O lançamento será marcado como excluído. O histórico será preservado para auditoria."
        details={deleteEntry ? [
          { label: 'Tipo', value: TYPE_CONFIG[deleteEntry.type]?.label || '' },
          { label: 'Descrição', value: deleteEntry.description },
          { label: 'Valor', value: formatCurrency(deleteEntry.amount) },
        ] : []}
        severity="danger"
        confirmLabel="Excluir Lançamento"
        loading={saving}
        onConfirm={handleDelete}
      >
        <div className="mt-2">
          <Label className="text-xs font-semibold">Motivo da exclusão *</Label>
          <Textarea
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            placeholder="Descreva o motivo..."
            className="mt-1 min-h-[60px]"
          />
        </div>
      </CriticalActionDialog>
    </div>
  );
}
