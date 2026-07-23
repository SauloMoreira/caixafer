import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime, todayISO, PAYMENT_METHODS } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, ShoppingCart, ArrowRight, Shield, Search } from 'lucide-react';
import { logSecurityEvent } from '@/lib/security';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closingId: string | null;
  canOperate: boolean;
  onCorrected?: () => void;
}

interface SaleRow {
  id: string;
  sale_number: number;
  total_amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  notes: string | null;
  status: string | null;
  is_deleted: boolean;
  created_by: string;
}

const pmLabel = (v: string | null) =>
  PAYMENT_METHODS.find((m) => m.value === v)?.label || v || '—';

const REASON_PRESETS = [
  'Cliente mudou a forma de pagamento',
  'Forma de pagamento lançada incorretamente',
  'Pagamento confirmado por outro meio',
  'Ajuste operacional do caixa aberto',
];

export default function SalePaymentMethodDialog({
  open,
  onOpenChange,
  closingId,
  canOperate,
  onCorrected,
}: Props) {
  const { profile, isAdmin } = useAuth();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SaleRow | null>(null);

  // form
  const [newMethod, setNewMethod] = useState<PaymentMethod>('dinheiro');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const today = todayISO();

  const fetchSales = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    let q = supabase
      .from('sales')
      .select('id, sale_number, total_amount, payment_method, created_at, notes, status, is_deleted, created_by')
      .eq('business_date', today)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (!isAdmin) q = q.eq('created_by', profile.id);
    const { data, error } = await q;
    if (error) {
      toast.error('Erro ao carregar vendas: ' + error.message);
    }
    const rows = (data || []).filter(
      (s: any) => (s.status || 'active') !== 'cancelled' && (s.status || 'active') !== 'reversed',
    ) as SaleRow[];
    setSales(rows);
    setLoading(false);
  }, [profile, isAdmin, today]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setReason('');
      setReference('');
      setSearch('');
      fetchSales();
    }
  }, [open, fetchSales]);

  const openCorrection = (s: SaleRow) => {
    setSelected(s);
    setNewMethod(s.payment_method);
    setReason('');
    setReference('');
  };

  const handleSave = async () => {
    if (!selected || !profile) return;
    if (!canOperate) {
      toast.error('Somente o responsável atual do caixa pode corrigir a forma de pagamento.');
      return;
    }
    if (newMethod === selected.payment_method) {
      toast.error('Selecione uma forma de pagamento diferente da atual.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      toast.error('Informe o motivo da correção (mínimo 5 caracteres).');
      return;
    }

    setSaving(true);
    try {
      const noteLine = `[${new Date().toLocaleString('pt-BR')}] Forma de pagamento corrigida: ${pmLabel(selected.payment_method)} → ${pmLabel(newMethod)}. Motivo: ${reason.trim()}${reference.trim() ? `. Ref: ${reference.trim()}` : ''}. Por: ${profile.full_name}.`;
      const mergedNotes = selected.notes ? `${selected.notes}\n${noteLine}` : noteLine;

      const { error } = await supabase
        .from('sales')
        .update({
          payment_method: newMethod,
          notes: mergedNotes,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        } as any)
        .eq('id', selected.id)
        .eq('business_date', today)
        .eq('is_deleted', false);

      if (error) throw error;

      await logSecurityEvent({
        event_type: 'sale_payment_method_corrected',
        entity_type: 'sales',
        entity_id: selected.id,
        action: 'UPDATE_PAYMENT_METHOD',
        severity: 'medium',
        business_date: today,
        old_data: {
          sale_number: selected.sale_number,
          payment_method: selected.payment_method,
          total_amount: selected.total_amount,
        },
        new_data: {
          sale_number: selected.sale_number,
          payment_method: newMethod,
          total_amount: selected.total_amount,
          reason: reason.trim(),
          reference: reference.trim() || null,
          session_id: closingId,
        },
        notes: `Correção de forma de pagamento em caixa aberto (venda #${selected.sale_number}). ${pmLabel(selected.payment_method)} → ${pmLabel(newMethod)}. Motivo: ${reason.trim()}.`,
      });

      toast.success(`Venda #${selected.sale_number}: forma de pagamento atualizada.`);
      setSelected(null);
      await fetchSales();
      onCorrected?.();
    } catch (e: any) {
      const msg = e?.message || 'Erro desconhecido';
      if (msg.toLowerCase().includes('row-level') || msg.toLowerCase().includes('permission')) {
        toast.error('Esta venda pertence a um caixa já fechado. A correção só pode ser feita por um administrador através de ajuste administrativo.');
      } else {
        toast.error('Erro ao corrigir forma de pagamento: ' + msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = sales.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(s.sale_number).includes(q) ||
      pmLabel(s.payment_method).toLowerCase().includes(q) ||
      formatCurrency(Number(s.total_amount)).toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-hidden flex flex-col p-0 top-2 translate-y-0 sm:top-1/2 sm:-translate-y-1/2">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {selected ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -ml-1"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Corrigir forma de pagamento
              </>
            ) : (
              <>Corrigir forma de pagamento</>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {selected
              ? `Venda #${selected.sale_number} · ${formatCurrency(Number(selected.total_amount))}`
              : 'Selecione a venda cuja forma de pagamento precisa ser corrigida. Apenas vendas do caixa aberto atual.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {!selected && (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs">
                <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                <p className="text-muted-foreground leading-relaxed">
                  Apenas a <strong>forma de pagamento</strong> é alterada. Itens, valor, cliente e estoque
                  permanecem inalterados. A correção fica registrada em auditoria e é visível aos administradores.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nº da venda, valor ou forma..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma venda encontrada no caixa aberto de hoje.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((s) => (
                    <Card
                      key={s.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => openCorrection(s)}
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">Venda #{s.sale_number}</p>
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {pmLabel(s.payment_method)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {formatDateTime(s.created_at)}
                          </p>
                        </div>
                        <p className="font-semibold text-sm tabular-nums text-right shrink-0">
                          {formatCurrency(Number(s.total_amount))}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {selected && (
            <div className="space-y-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Venda</span>
                    <span className="text-sm font-semibold">#{selected.sale_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Valor total (inalterado)</span>
                    <span className="text-sm font-bold tabular-nums text-primary">
                      {formatCurrency(Number(selected.total_amount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Registrada em</span>
                    <span className="text-xs">{formatDateTime(selected.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <Label className="text-xs">Forma atual</Label>
                  <div className="h-11 flex items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                    {pmLabel(selected.payment_method)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 mb-3 text-muted-foreground" />
                <div>
                  <Label className="text-xs">Nova forma *</Label>
                  <Select value={newMethod} onValueChange={(v) => setNewMethod(v as PaymentMethod)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Motivo da correção *</Label>
                <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
                  {REASON_PRESETS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-muted transition-colors"
                      onClick={() => setReason(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva o motivo da correção..."
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div>
                <Label className="text-xs">Referência / comprovante (opcional)</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex.: ID PIX, nº comprovante..."
                  className="h-11"
                  maxLength={120}
                />
              </div>

              <div className="rounded-lg border border-muted p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Esta correção altera <strong>apenas a forma de pagamento</strong>. Itens, quantidade,
                preços, desconto, cliente, estoque e valor total permanecem exatamente como estão.
                A alteração impacta automaticamente o dinheiro físico esperado e o movimento financeiro do fechamento.
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setSelected(null)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 h-11"
                  onClick={handleSave}
                  disabled={saving || !canOperate}
                >
                  {saving ? 'Salvando...' : 'Confirmar correção'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
