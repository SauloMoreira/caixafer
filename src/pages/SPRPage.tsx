import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCashSession } from '@/hooks/useCashSession';
import { formatCurrency, formatDate, todayISO, PAYMENT_METHODS, DOCUMENT_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import PhoneInput from '@/components/PhoneInput';
import FiadoChargeDialog from '@/components/FiadoChargeDialog';
import SPROperationalBlockCard from '@/components/SPROperationalBlockCard';
import VolunteerFiadoDetailDialog from '@/components/spr/VolunteerFiadoDetailDialog';
import { toast } from 'sonner';
import { Heart, Plus, DollarSign, Search, Camera, Upload, User, Pencil, Loader2 } from 'lucide-react';
import { applyPhoneMask, isValidPhone, phoneDigits } from '@/lib/masks';
import type { Database } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';

type Volunteer = Database['public']['Tables']['spr_volunteers']['Row'] & { avatar_url?: string | null };
type FiadoCharge = Database['public']['Tables']['spr_fiado_charges']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type DocumentType = Database['public']['Enums']['document_type'];

export default function SPRPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { sessionOpen, canOperate, responsibleName } = useCashSession();
  const canAccessOperationalSpr = profile?.role === 'admin' || canOperate;
  const showBlockedCard = (profile?.role === 'cashier' || profile?.role === 'cash_coordinator') && !canAccessOperationalSpr;
  const [tab, setTab] = useState('volunteers');
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [charges, setCharges] = useState<(FiadoCharge & { volunteer_name?: string })[]>([]);
  const [search, setSearch] = useState('');
  const [loadingVol, setLoadingVol] = useState(false);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [savingVol, setSavingVol] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  // Volunteer form
  const [volDialogOpen, setVolDialogOpen] = useState(false);
  const [editingVol, setEditingVol] = useState<Volunteer | null>(null);
  const [volName, setVolName] = useState('');
  
  const [volPhone, setVolPhone] = useState('');
  
  const [volActive, setVolActive] = useState(true);
  const [volAvatarFile, setVolAvatarFile] = useState<File | null>(null);
  const [volPreviewUrl, setVolPreviewUrl] = useState<string | null>(null);
  const [volUploading, setVolUploading] = useState(false);
  const volFileRef = useRef<HTMLInputElement>(null);
  const volCameraRef = useRef<HTMLInputElement>(null);

  // Charge form (PDV-style dialog)
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);

  // Payment form
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payCharge, setPayCharge] = useState<FiadoCharge | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pix');
  const [payDocType, setPayDocType] = useState<DocumentType>('sem_documento');
  const [payDocRef, setPayDocRef] = useState('');

  useEffect(() => {
    if (!canAccessOperationalSpr) {
      setVolunteers([]);
      setCharges([]);
      return;
    }

    fetchVolunteers();
    fetchCharges();
  }, [canAccessOperationalSpr]);

  const fetchVolunteers = async () => {
    setLoadingVol(true);
    const { data, error } = await supabase.from('spr_volunteers').select('*').order('full_name');
    if (error) toast.error('Erro ao carregar voluntários.');
    else if (data) setVolunteers(data as Volunteer[]);
    setLoadingVol(false);
  };

  const fetchCharges = async () => {
    setLoadingCharges(true);
    const { data, error } = await supabase.from('spr_fiado_charges').select('*, spr_volunteers(full_name)').order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar fiados.');
    else if (data) setCharges(data.map((c: any) => ({ ...c, volunteer_name: c.spr_volunteers?.full_name })));
    setLoadingCharges(false);
  };

  const openNewVolunteer = () => {
    setEditingVol(null);
    setVolName(''); setVolPhone(''); setVolActive(true);
    setVolAvatarFile(null); setVolPreviewUrl(null);
    setVolDialogOpen(true);
  };

  const openEditVolunteer = (v: Volunteer) => {
    setEditingVol(v);
    setVolName(v.full_name); setVolPhone(v.phone ? applyPhoneMask(v.phone) : ''); setVolActive(v.is_active);
    setVolAvatarFile(null); setVolPreviewUrl(v.avatar_url || null);
    setVolDialogOpen(true);
  };

  const handleVolFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem válida.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB.'); return; }
    setVolAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVolPreviewUrl(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return objectUrl; });
  };

  const uploadVolAvatar = async (volunteerId: string): Promise<string | null> => {
    if (!volAvatarFile) return editingVol?.avatar_url || null;
    setVolUploading(true);
    const ext = volAvatarFile.name.split('.').pop() || 'jpg';
    const filePath = `volunteers/${volunteerId}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(filePath, volAvatarFile, { upsert: true });
    if (error) { toast.error('Erro ao enviar foto.'); setVolUploading(false); return null; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setVolUploading(false);
    return urlData.publicUrl + '?t=' + Date.now();
  };

  const saveVolunteer = async () => {
    if (!volName.trim()) { toast.error('Nome é obrigatório.'); return; }
    setSavingVol(true);
    try {
      if (editingVol) {
        let avatarUrl = editingVol.avatar_url;
        if (volAvatarFile) {
          avatarUrl = await uploadVolAvatar(editingVol.id);
          if (!avatarUrl) return;
        }
        const { error } = await supabase.from('spr_volunteers').update({
          full_name: volName, phone: volPhone || null,
          is_active: volActive, avatar_url: avatarUrl,
        } as any).eq('id', editingVol.id);
        if (error) toast.error(error.message);
        else { toast.success('Voluntário atualizado!'); setVolDialogOpen(false); fetchVolunteers(); }
      } else {
        const tempId = crypto.randomUUID();
        let avatarUrl: string | null = null;
        if (volAvatarFile) avatarUrl = await uploadVolAvatar(tempId);
        const { error } = await supabase.from('spr_volunteers').insert({
          id: tempId, full_name: volName,
          phone: volPhone || null, avatar_url: avatarUrl,
        } as any);
        if (error) toast.error(error.message);
        else { toast.success('Voluntário cadastrado!'); setVolDialogOpen(false); fetchVolunteers(); }
      }
    } finally {
      setSavingVol(false);
    }
  };

  const handleChargeCreated = () => {
    fetchCharges();
  };

  const openPayment = (charge: FiadoCharge) => { setPayCharge(charge); setPayAmount(''); setPayDialogOpen(true); };

  const savePayment = async () => {
    if (!profile || !payCharge || savingPayment) return;
    if (!canAccessOperationalSpr) {
      toast.error(`Operação bloqueada. O caixa está sob responsabilidade de ${responsibleName || 'outro operador'}.`);
      return;
    }
    const amountPaid = Number(payAmount);
    if (!amountPaid || amountPaid <= 0) { toast.error('Informe um valor válido.'); return; }
    if (amountPaid > Number(payCharge.amount)) { toast.error('Valor não pode ser maior que o total do fiado.'); return; }
    setSavingPayment(true);

    const { error: payError } = await supabase.from('spr_fiado_payments').insert({
      fiado_charge_id: payCharge.id, volunteer_id: payCharge.volunteer_id,
      payment_date: todayISO(), amount_paid: amountPaid,
      payment_method: payMethod, document_type: payDocType,
      document_reference: payDocRef || null, created_by: profile.id,
    });
    if (payError) { toast.error(payError.message); setSavingPayment(false); return; }

    // Calcular total pago incluindo pagamentos anteriores para atualizar status
    const { data: allPayments } = await supabase
      .from('spr_fiado_payments')
      .select('amount_paid')
      .eq('fiado_charge_id', payCharge.id);

    const totalPaid = (allPayments || []).reduce((s, p) => s + Number(p.amount_paid), 0);
    const chargeAmount = Number(payCharge.amount);
    const newStatus = totalPaid >= chargeAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'open';

    await supabase.from('spr_fiado_charges').update({ status: newStatus }).eq('id', payCharge.id);

    toast.success('Pagamento registrado!');
    setPayDialogOpen(false);
    setSavingPayment(false);
    fetchCharges();
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

      {showBlockedCard ? (
        <SPROperationalBlockCard
          responsibleName={sessionOpen ? responsibleName : null}
          hasOpenSession={sessionOpen}
          onRequestTransfer={sessionOpen ? () => navigate('/fechamento') : undefined}
        />
      ) : (
        <>
          <Card className="stat-card">
            <CardContent className="p-0">
              <p className="text-xs text-muted-foreground">Fiado em Aberto</p>
              <p className="financial-value text-xl text-warning">{formatCurrency(totalOpen)}</p>
            </CardContent>
          </Card>

          <Tabs value={tab} onValueChange={v => { setTab(v); setSearch(''); }}>
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
                  <Button size="sm" onClick={openNewVolunteer}><Plus className="mr-1 h-4 w-4" />Voluntário</Button>
                </div>
                {loadingVol && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                {!loadingVol && filteredVol.map(v => (
                  <Card key={v.id} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => openEditVolunteer(v)}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {v.avatar_url ? (
                          <img src={v.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{v.full_name}</p>
                          <p className="text-xs text-muted-foreground">{v.phone || 'Sem telefone'}{!v.is_active ? ' • Inativo' : ''}</p>
                        </div>
                      </div>
                      <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                ))}
                {!loadingVol && filteredVol.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhum voluntário encontrado.</p>}
              </TabsContent>

              <TabsContent value="charges" className="mt-0 space-y-2">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setChargeDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Fiado</Button>
                </div>
                {loadingCharges && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                {!loadingCharges && filteredCharges.map(c => (
                  <Card key={c.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => { setDetailVolunteerId(c.volunteer_id); setDetailOpen(true); }}
                          className="text-sm font-medium text-left hover:text-primary hover:underline transition-colors"
                        >
                          {c.volunteer_name}
                        </button>
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
                {!loadingCharges && filteredCharges.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhum fiado encontrado.</p>}
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}

      {/* Volunteer Dialog */}
      <Dialog open={volDialogOpen} onOpenChange={setVolDialogOpen}>
        <DialogContent className="max-w-full sm:max-w-lg w-[95vw]">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>{editingVol ? 'Editar Voluntário' : 'Novo Voluntário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {volPreviewUrl ? (
                  <img src={volPreviewUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-4 border-primary/20" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted border-4 border-dashed border-muted-foreground/30">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                {volUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => volCameraRef.current?.click()} className="gap-1.5">
                  <Camera className="h-4 w-4" />Câmera
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => volFileRef.current?.click()} className="gap-1.5">
                  <Upload className="h-4 w-4" />Galeria
                </Button>
              </div>
              <input ref={volCameraRef} type="file" accept="image/*" capture="user" onChange={handleVolFileSelect} className="hidden" />
              <input ref={volFileRef} type="file" accept="image/*" onChange={handleVolFileSelect} className="hidden" />
            </div>

            <div className="space-y-3">
              <div><Label>Nome Completo *</Label><Input value={volName} onChange={e => setVolName(e.target.value)} className="h-12" /></div>
              
              <div><Label>Telefone</Label><PhoneInput value={volPhone} onChange={setVolPhone} placeholder="(11) 99999-9999" className="h-12" /></div>
              
              {editingVol && (
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch checked={volActive} onCheckedChange={setVolActive} />
                </div>
              )}
            </div>

            <Button className="h-12 w-full" onClick={saveVolunteer} disabled={volUploading || savingVol}>
              {(volUploading || savingVol) ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{volUploading ? 'Enviando...' : 'Salvando...'}</> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fiado Charge Dialog (PDV-style) */}
      <FiadoChargeDialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen} onChargeCreated={handleChargeCreated} />

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-full sm:max-w-2xl w-[95vw]">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-5">
            {payCharge && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm sm:text-base font-medium">{(payCharge as any).volunteer_name || 'Voluntário'}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Total do fiado: <span className="font-semibold text-foreground">{formatCurrency(Number(payCharge.amount))}</span>
                </p>
              </div>
            )}
            <div>
              <Label className="text-sm sm:text-base">Valor Pago (R$)</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="h-12 sm:h-14 text-sm sm:text-base mt-1.5"
                placeholder={payCharge ? `Máx: ${formatCurrency(Number(payCharge.amount))}` : '0,00'}
                min="0.01"
                max={payCharge ? String(payCharge.amount) : undefined}
                autoFocus
              />
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
              <Label className="text-sm sm:text-base">Referência</Label>
              <Input value={payDocRef} onChange={e => setPayDocRef(e.target.value)} className="h-12 sm:h-14 text-sm sm:text-base mt-1.5" />
            </div>
            <Button className="h-12 sm:h-14 w-full text-sm sm:text-base" onClick={savePayment} disabled={savingPayment || !payAmount}>
              {savingPayment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : 'Confirmar Pagamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
