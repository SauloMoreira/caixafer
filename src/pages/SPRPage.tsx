import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { toast } from 'sonner';
import { Heart, Plus, Users, DollarSign, Search, Camera, Upload, User, Pencil, Loader2 } from 'lucide-react';
import { applyPhoneMask, isValidPhone, phoneDigits } from '@/lib/masks';
import type { Database } from '@/integrations/supabase/types';

type Volunteer = Database['public']['Tables']['spr_volunteers']['Row'] & { avatar_url?: string | null };
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
  const [editingVol, setEditingVol] = useState<Volunteer | null>(null);
  const [volName, setVolName] = useState('');
  
  const [volPhone, setVolPhone] = useState('');
  
  const [volActive, setVolActive] = useState(true);
  const [volAvatarFile, setVolAvatarFile] = useState<File | null>(null);
  const [volPreviewUrl, setVolPreviewUrl] = useState<string | null>(null);
  const [volUploading, setVolUploading] = useState(false);
  const volFileRef = useRef<HTMLInputElement>(null);
  const volCameraRef = useRef<HTMLInputElement>(null);

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
    if (data) setVolunteers(data as Volunteer[]);
  };

  const fetchCharges = async () => {
    const { data } = await supabase.from('spr_fiado_charges').select('*, spr_volunteers(full_name)').order('created_at', { ascending: false });
    if (data) setCharges(data.map((c: any) => ({ ...c, volunteer_name: c.spr_volunteers?.full_name })));
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
    setVolPreviewUrl(URL.createObjectURL(file));
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

    if (editingVol) {
      let avatarUrl = editingVol.avatar_url;
      if (volAvatarFile) {
        avatarUrl = await uploadVolAvatar(editingVol.id);
        if (volAvatarFile && !avatarUrl) return;
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
      if (volAvatarFile) {
        avatarUrl = await uploadVolAvatar(tempId);
      }
      const { error } = await supabase.from('spr_volunteers').insert({
        id: tempId, full_name: volName,
        phone: volPhone || null, avatar_url: avatarUrl,
      } as any);
      if (error) toast.error(error.message);
      else { toast.success('Voluntário cadastrado!'); setVolDialogOpen(false); fetchVolunteers(); }
    }
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
              <Button size="sm" onClick={openNewVolunteer}><Plus className="mr-1 h-4 w-4" />Voluntário</Button>
            </div>
            {filteredVol.map(v => (
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
            {filteredVol.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhum voluntário encontrado.</p>}
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
            {filteredCharges.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nenhum fiado encontrado.</p>}
          </TabsContent>
        </div>
      </Tabs>

      {/* Volunteer Dialog */}
      <Dialog open={volDialogOpen} onOpenChange={setVolDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingVol ? 'Editar Voluntário' : 'Novo Voluntário'}</DialogTitle></DialogHeader>
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

            <Button className="h-12 w-full" onClick={saveVolunteer} disabled={volUploading}>
              {volUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : 'Salvar'}
            </Button>
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
