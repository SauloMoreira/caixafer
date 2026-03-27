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
import { Search, User, ArrowLeft, DollarSign, Heart, ChevronRight } from 'lucide-react';
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
        });
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== 'select_volunteer' && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep(step === 'confirm_payment' ? 'view_balance' : 'select_volunteer')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Heart className="h-4 w-4 text-primary" />
            {step === 'select_volunteer' && 'Receber SPR'}
            {step === 'view_balance' && 'Saldo SPR'}
            {step === 'confirm_payment' && 'Confirmar Pagamento'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select volunteer */}
        {step === 'select_volunteer' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar voluntário..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 pl-10" />
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredVolunteers.map(v => (
                <Card key={v.id} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => selectVolunteer(v)}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {v.avatar_url ? (
                        <img src={v.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <p className="text-sm font-medium">{v.full_name}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
              {filteredVolunteers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum voluntário encontrado.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: View balance */}
        {step === 'view_balance' && selectedVolunteer && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {selectedVolunteer.avatar_url ? (
                <img src={selectedVolunteer.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <p className="font-medium">{selectedVolunteer.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedVolunteer.phone || 'Sem telefone'}</p>
              </div>
            </div>

            <Card className="stat-card">
              <CardContent className="p-0">
                <p className="text-xs text-muted-foreground">Saldo em Aberto</p>
                <p className={`financial-value text-xl ${totalOpen > 0 ? 'text-warning' : 'text-income'}`}>
                  {formatCurrency(totalOpen)}
                </p>
              </CardContent>
            </Card>

            {charges.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lançamentos em aberto</p>
                {charges.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                    <div>
                      <p className="text-sm font-medium">{c.description || 'Fiado'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.business_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="financial-value text-sm">{formatCurrency(Number(c.amount))}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                Este voluntário não possui saldo em aberto. 🎉
              </p>
            )}

            {totalOpen > 0 && (
              <Button className="h-12 w-full" onClick={goToPayment}>
                <DollarSign className="mr-2 h-4 w-4" />
                Registrar Pagamento
              </Button>
            )}
          </div>
        )}

        {/* Step 3: Confirm payment */}
        {step === 'confirm_payment' && selectedVolunteer && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">{selectedVolunteer.full_name}</p>
              <p className="financial-value text-sm text-warning">{formatCurrency(totalOpen)}</p>
            </div>

            <div>
              <Label>Valor do Pagamento (R$)</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-12" placeholder="0,00" />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={payMethod} onValueChange={v => setPayMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Documento</Label>
              <Select value={payDocType} onValueChange={v => setPayDocType(v as DocumentType)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referência do Documento</Label>
              <Input value={payDocRef} onChange={e => setPayDocRef(e.target.value)} className="h-12" placeholder="Opcional" />
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={payNotes} onChange={e => setPayNotes(e.target.value)} className="h-12" placeholder="Opcional" />
            </div>

            <Button className="h-12 w-full" onClick={confirmPayment} disabled={loading}>
              {loading ? 'Processando...' : `Confirmar ${formatCurrency(Number(payAmount) || 0)}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
