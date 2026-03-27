import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, todayISO, PAYMENT_METHODS, DOCUMENT_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Heart, Plus, Users, DollarSign, Search } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Volunteer = Database['public']['Tables']['spr_volunteers']['Row'];
type FiadoCharge = Database['public']['Tables']['spr_fiado_charges']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type DocumentType = Database['public']['Enums']['document_type'];

export default function SPRPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('volunteers');
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [charges, setCharges] = useState<(FiadoCharge & { volunteer_name?: string })[]>([]);
  const [search, setSearch] = useState('');

  // Volunteer form
  const [volDialogOpen, setVolDialogOpen] = useState(false);
  const [volName, setVolName] = useState('');
  const [volDoc, setVolDoc] = useState('');
  const [volPhone, setVolPhone] = useState('');

  // Charge form
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeVolunteerId, setChargeVolunteerId] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');

  // Payment form
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payCharge, setPayCharge] = useState<FiadoCharge | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pix');
  const [payDocType, setPayDocType] = useState<DocumentType>('sem_documento');
  const [payDocRef, setPayDocRef] = useState('');

  useEffect(() => { fetchVolunteers(); fetchCharges(); }, []);

  const fetchVolunteers = async () => {
    const { data } = await supabase.from('spr_volunteers').select('*').order('full_name');
    if (data) setVolunteers(data);
  };

  const fetchCharges = async () => {
    const { data } = await supabase.from('spr_fiado_charges').select('*, spr_volunteers(full_name)').order('created_at', { ascending: false });
    if (data) setCharges(data.map((c: any) => ({ ...c, volunteer_name: c.spr_volunteers?.full_name })));
  };

  const saveVolunteer = async () => {
    const { error } = await supabase.from('spr_volunteers').insert({ full_name: volName, document_number: volDoc || null, phone: volPhone || null });
    if (error) toast.error(error.message);
    else { toast.success('Voluntário cadastrado!'); setVolDialogOpen(false); setVolName(''); setVolDoc(''); setVolPhone(''); fetchVolunteers(); }
  };

  const saveCharge = async () => {
    if (!profile) return;
    const { error } = await supabase.from('spr_fiado_charges').insert({
      volunteer_id: chargeVolunteerId, description: chargeDesc || null,
      amount: Number(chargeAmount), created_by: profile.id, business_date: todayISO(),
    });
    if (error) toast.error(error.message);
    else { toast.success('Fiado registrado!'); setChargeDialogOpen(false); setChargeAmount(''); setChargeDesc(''); fetchCharges(); }
  };

  const openPayment = (charge: FiadoCharge) => { setPayCharge(charge); setPayAmount(''); setPayDialogOpen(true); };

  const savePayment = async () => {
    if (!profile || !payCharge) return;
    const { error } = await supabase.from('spr_fiado_payments').insert({
      fiado_charge_id: payCharge.id, volunteer_id: payCharge.volunteer_id,
      payment_date: todayISO(), amount_paid: Number(payAmount),
      payment_method: payMethod, document_type: payDocType,
      document_reference: payDocRef || null, created_by: profile.id,
    });
    if (error) toast.error(error.message);
    else { toast.success('Pagamento registrado!'); setPayDialogOpen(false); fetchCharges(); }
  };

  const totalOpen = charges.filter(c => c.status !== 'paid').reduce((s, c) => s + Number(c.amount), 0);
  const filteredVol = volunteers.filter(v => !search || v.full_name.toLowerCase().includes(search.toLowerCase()));
  const filteredCharges = charges.filter(c => !search || c.volunteer_name?.toLowerCase().includes(search.toLowerCase()));

  const statusColor = (s: string) => s === 'paid' ? 'bg-income/10 text-income' : s === 'partial' ? 'bg-warning/10 text-warning' : 'bg-expense/10 text-expense';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2"><Heart className="h-5 w-5 text-primary" />SPR Ramatis</h1>
      </div>

      <Card className="stat-card">
        <CardContent className="p-0">
          <p className="text-xs text-muted-foreground">Fiado em Aberto</p>
          <p className="financial-value text-xl text-warning">{formatCurrency(totalOpen)}</p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="volunteers" className="flex-1">Voluntários</TabsTrigger>
          <TabsTrigger value="charges" className="flex-1">Fiados</TabsTrigger>
        </TabsList>

        <div className="mt-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 pl-10" />
          </div>

          <TabsContent value="volunteers" className="mt-0 space-y-2">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setVolDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Voluntário</Button>
            </div>
            {filteredVol.map(v => (
              <Card key={v.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{v.full_name}</p>
                    <p className="text-xs text-muted-foreground">{v.phone || 'Sem telefone'}</p>
                  </div>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="charges" className="mt-0 space-y-2">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setChargeDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Fiado</Button>
            </div>
            {filteredCharges.map(c => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{c.volunteer_name}</p>
                    <p className="text-xs text-muted-foreground">{c.description || 'Fiado'} • {formatDate(c.business_date)}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(c.status)}`}>
                      {c.status === 'paid' ? 'Pago' : c.status === 'partial' ? 'Parcial' : 'Em Aberto'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="financial-value text-sm">{formatCurrency(Number(c.amount))}</p>
                    {c.status !== 'paid' && (
                      <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => openPayment(c)}>
                        <DollarSign className="mr-1 h-3 w-3" />Pagar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </div>
      </Tabs>

      {/* Volunteer Dialog */}
      <Dialog open={volDialogOpen} onOpenChange={setVolDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Voluntário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome Completo</Label><Input value={volName} onChange={e => setVolName(e.target.value)} className="h-12" /></div>
            <div><Label>Documento</Label><Input value={volDoc} onChange={e => setVolDoc(e.target.value)} className="h-12" /></div>
            <div><Label>Telefone</Label><Input value={volPhone} onChange={e => setVolPhone(e.target.value)} className="h-12" /></div>
            <Button className="h-12 w-full" onClick={saveVolunteer}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Charge Dialog */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fiado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Voluntário</Label>
              <Select value={chargeVolunteerId} onValueChange={setChargeVolunteerId}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{volunteers.filter(v => v.is_active).map(v => <SelectItem key={v.id} value={v.id}>{v.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Input value={chargeDesc} onChange={e => setChargeDesc(e.target.value)} className="h-12" /></div>
            <div><Label>Valor (R$)</Label><Input type="number" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)} className="h-12" /></div>
            <Button className="h-12 w-full" onClick={saveCharge}>Registrar Fiado</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Valor do fiado: {payCharge && formatCurrency(Number(payCharge.amount))}</p>
            <div><Label>Valor Pago (R$)</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-12" /></div>
            <div><Label>Forma de Pagamento</Label>
              <Select value={payMethod} onValueChange={v => setPayMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo de Documento</Label>
              <Select value={payDocType} onValueChange={v => setPayDocType(v as DocumentType)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Referência</Label><Input value={payDocRef} onChange={e => setPayDocRef(e.target.value)} className="h-12" /></div>
            <Button className="h-12 w-full" onClick={savePayment}>Confirmar Pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
