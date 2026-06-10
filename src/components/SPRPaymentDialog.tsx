import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, todayISO, PAYMENT_METHODS, DOCUMENT_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, User, ArrowLeft, DollarSign, Heart, ChevronRight, X } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Volunteer = Database['public']['Tables']['spr_volunteers']['Row'];
type FiadoCharge = Database['public']['Tables']['spr_fiado_charges']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type DocumentType = Database['public']['Enums']['document_type'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete?: () => void;
}

type Step = 'select_volunteer' | 'view_balance' | 'confirm_payment';

export default function SPRPaymentDialog({ open, onOpenChange, onPaymentComplete }: Props) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('select_volunteer');
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [charges, setCharges] = useState<FiadoCharge[]>([]);
  const [totalOpen, setTotalOpen] = useState(0);
  const [loading, setLoading] = useState(false);

  // Payment fields
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('dinheiro');
  const [payDocType, setPayDocType] = useState<DocumentType>('sem_documento');
  const [payDocRef, setPayDocRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  useEffect(() => {
    if (open) {
      setStep('select_volunteer');
      setSelectedVolunteer(null);
      setSearch('');
      resetPaymentFields();
      fetchVolunteers();
    }
  }, [open]);

  const resetPaymentFields = () => {
    setPayAmount('');
    setPayMethod('dinheiro');
    setPayDocType('sem_documento');
    setPayDocRef('');
    setPayNotes('');
  };

  const fetchVolunteers = async () => {
    const { data } = await supabase.from('spr_volunteers').select('*').eq('is_active', true).order('full_name');
    if (data) setVolunteers(data);
  };

  const fetchCharges = async (volunteerId: string) => {
    const { data } = await supabase
      .from('spr_fiado_charges')
      .select('*')
      .eq('volunteer_id', volunteerId)
      .in('status', ['open', 'partial'])
      .order('business_date', { ascending: true });
    if (data) {
      setCharges(data);
      setTotalOpen(data.reduce((s, c) => s + Number(c.amount), 0));
    }
  };

  const selectVolunteer = async (vol: Volunteer) => {
    setSelectedVolunteer(vol);
    await fetchCharges(vol.id);
    setStep('view_balance');
  };

  const goToPayment = () => {
    setPayAmount(totalOpen.toFixed(2));
    setStep('confirm_payment');
  };

  const confirmPayment = async () => {
    if (!profile || !selectedVolunteer) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { toast.error('Informe um valor válido.'); return; }

    setLoading(true);
    try {
      // Single payment_group_id: all charges quitadas nesta operação ficam
      // consolidadas como UM único pagamento na Auditoria Diária.
      const paymentGroupId =
        globalThis.crypto && 'randomUUID' in globalThis.crypto
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      // Distribute payment across open charges (oldest first)
      let remaining = amount;
      for (const charge of charges) {
        if (remaining <= 0) break;
        // Get already paid for this charge
        const { data: payments } = await supabase
          .from('spr_fiado_payments')
          .select('amount_paid')
          .eq('fiado_charge_id', charge.id);
        const alreadyPaid = payments?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0;
        const chargeRemaining = Number(charge.amount) - alreadyPaid;
        if (chargeRemaining <= 0) continue;

        const payForThis = Math.min(remaining, chargeRemaining);

        const { error } = await supabase.from('spr_fiado_payments').insert({
          fiado_charge_id: charge.id,
          volunteer_id: selectedVolunteer.id,
          payment_date: todayISO(),
          amount_paid: payForThis,
          payment_method: payMethod,
          document_type: payDocType,
          document_reference: payDocRef || null,
          notes: payNotes || null,
          created_by: profile.id,
          payment_group_id: paymentGroupId,
        } as any);
        if (error) throw error;
        remaining -= payForThis;
      }

      toast.success(`Pagamento SPR de ${formatCurrency(amount)} registrado!`);
      onPaymentComplete?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao registrar pagamento: ' + err.message);
    }
    setLoading(false);
  };

  const filteredVolunteers = useMemo(() => {
    if (!search) return volunteers;
    const s = search.toLowerCase();
    return volunteers.filter(v => v.full_name.toLowerCase().includes(s));
  }, [volunteers, search]);

  const statusLabel = (s: string) => s === 'paid' ? 'Pago' : s === 'partial' ? 'Parcial' : 'Em Aberto';
  const statusColor = (s: string) => s === 'paid' ? 'bg-income/10 text-income' : s === 'partial' ? 'bg-warning/10 text-warning' : 'bg-expense/10 text-expense';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-full sm:max-w-5xl w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Fixed Header */}
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0 bg-[var(--color-surface)]">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {step !== 'select_volunteer' && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setStep(step === 'confirm_payment' ? 'view_balance' : 'select_volunteer')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              {step === 'select_volunteer' && 'Receber SPR'}
              {step === 'view_balance' && 'Saldo SPR'}
              {step === 'confirm_payment' && 'Confirmar Pagamento'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full hover:bg-[var(--color-surface-alt)]"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="h-5 w-5 text-[var(--color-text-muted)]" />
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {/* Step 1: Select volunteer */}
          {step === 'select_volunteer' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar voluntário..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-12 pl-10 text-sm sm:text-base"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredVolunteers.map(v => (
                  <Card
                    key={v.id}
                    className="cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98]"
                    onClick={() => selectVolunteer(v)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      {v.avatar_url ? (
                        <img src={v.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-medium truncate">{v.full_name}</p>
                        <p className="text-xs text-muted-foreground">{v.phone || 'Sem telefone'}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
                {filteredVolunteers.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                    <User className="h-10 w-10 opacity-30" />
                    <p className="text-sm sm:text-base">Nenhum voluntário encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: View balance */}
          {step === 'view_balance' && selectedVolunteer && (
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Left: Volunteer info + Summary */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="border">
                  <CardContent className="flex items-center gap-4 p-4">
                    {selectedVolunteer.avatar_url ? (
                      <img src={selectedVolunteer.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <User className="h-8 w-8 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-base sm:text-lg font-medium truncate">{selectedVolunteer.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedVolunteer.phone || 'Sem telefone'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="stat-card border">
                  <CardContent className="p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Saldo em Aberto</p>
                    <p className={`financial-value text-2xl sm:text-3xl mt-1 ${totalOpen > 0 ? 'text-warning' : 'text-income'}`}>
                      {formatCurrency(totalOpen)}
                    </p>
                  </CardContent>
                </Card>

                {totalOpen > 0 && (
                  <Button className="h-12 w-full text-sm sm:text-base" onClick={goToPayment}>
                    <DollarSign className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Registrar Pagamento
                  </Button>
                )}
              </div>

              {/* Right: Charges list */}
              <div className="lg:col-span-2">
                {charges.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
                      Lançamentos em aberto ({charges.length})
                    </p>
                    <div className="space-y-2">
                      {charges.map(c => (
                        <Card key={c.id} className="border hover:border-primary/20 transition-colors">
                          <CardContent className="flex items-center justify-between p-3 sm:p-4">
                            <div className="min-w-0">
                              <p className="text-sm sm:text-base font-medium">{c.description || 'Fiado'}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">{formatDate(c.business_date)}</p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className="financial-value text-sm sm:text-base">{formatCurrency(Number(c.amount))}</p>
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-medium ${statusColor(c.status)}`}>
                                {statusLabel(c.status)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                    <Heart className="h-10 w-10 opacity-30" />
                    <p className="text-sm sm:text-base text-center">
                      Este voluntário não possui saldo em aberto. 🎉
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Confirm payment */}
          {step === 'confirm_payment' && selectedVolunteer && (
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {/* Left: Summary */}
              <div className="space-y-4">
                <Card className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {selectedVolunteer.avatar_url ? (
                        <img src={selectedVolunteer.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="text-base font-medium">{selectedVolunteer.full_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedVolunteer.phone || 'Sem telefone'}</p>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs sm:text-sm text-muted-foreground">Saldo em aberto</p>
                      <p className="financial-value text-2xl text-warning">{formatCurrency(totalOpen)}</p>
                    </div>
                    {charges.length > 0 && (
                      <div className="border-t pt-3 space-y-1.5 max-h-[30vh] overflow-y-auto">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lançamentos a quitar</p>
                        {charges.map(c => (
                          <div key={c.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate max-w-[60%]">{c.description || 'Fiado'}</span>
                            <span className="financial-value text-sm">{formatCurrency(Number(c.amount))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Payment form */}
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-sm sm:text-base">Valor do Pagamento (R$)</Label>
                  <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-12 sm:h-14 text-sm sm:text-base mt-1.5" placeholder="0,00" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">Forma de Pagamento</Label>
                  <Select value={payMethod} onValueChange={v => setPayMethod(v as PaymentMethod)}>
                    <SelectTrigger className="h-12 sm:h-14 text-sm sm:text-base mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm sm:text-base">Tipo de Documento</Label>
                  <Select value={payDocType} onValueChange={v => setPayDocType(v as DocumentType)}>
                    <SelectTrigger className="h-12 sm:h-14 text-sm sm:text-base mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm sm:text-base">Referência do Documento</Label>
                  <Input value={payDocRef} onChange={e => setPayDocRef(e.target.value)} className="h-12 sm:h-14 text-sm sm:text-base mt-1.5" placeholder="Opcional" />
                </div>
                <div>
                  <Label className="text-sm sm:text-base">Observações</Label>
                  <Input value={payNotes} onChange={e => setPayNotes(e.target.value)} className="h-12 sm:h-14 text-sm sm:text-base mt-1.5" placeholder="Opcional" />
                </div>

                <Button className="h-12 sm:h-14 w-full text-sm sm:text-base mt-2" onClick={confirmPayment} disabled={loading}>
                  {loading ? 'Processando...' : `Confirmar ${formatCurrency(Number(payAmount) || 0)}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
