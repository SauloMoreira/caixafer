import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import PhoneInput from '@/components/PhoneInput';
import EmailInput from '@/components/EmailInput';
import CepInput from '@/components/CepInput';
import { toast } from 'sonner';
import { Camera, Upload, User, Loader2, ArrowLeft, Search } from 'lucide-react';
import { isValidPhone, isValidEmail, normalizeEmail, applyPhoneMask, isValidCep, fetchAddressByCep, cepDigits } from '@/lib/masks';

interface ProfileData {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  cep: string | null;
  street: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  role: string;
  is_active: boolean;
  approval_status: string;
}

export default function ProfilePage() {
  const { profile: currentProfile, user, refreshProfile, updateProfile, isProfileComplete, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editUserId = searchParams.get('user');
  const isEditingOther = isAdmin && editUserId && editUserId !== user?.id;

  const [targetProfile, setTargetProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Address fields
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [fetchingCep, setFetchingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!!isEditingOther);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingOther) {
      fetchTargetProfile(editUserId);
    } else if (currentProfile) {
      populateForm(currentProfile as unknown as ProfileData);
    }
  }, [currentProfile, editUserId]);

  const fetchTargetProfile = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      const p = data as unknown as ProfileData;
      setTargetProfile(p);
      populateForm(p);
    }
    setLoading(false);
  };

  const populateForm = (p: ProfileData) => {
    setFullName(p.full_name || '');
    setPhone(p.phone ? applyPhoneMask(p.phone) : '');
    setEmail(p.email || '');
    setAvatarUrl(p.avatar_url);
    if (p.avatar_url) setPreviewUrl(p.avatar_url);
    setCep(p.cep || '');
    setStreet(p.street || '');
    setAddressNumber(p.address_number || '');
    setAddressComplement(p.address_complement || '');
    setNeighborhood(p.neighborhood || '');
    setCity(p.city || '');
    setState(p.state || '');
  };

  const handleCepChange = (value: string) => {
    setCep(value);
    setCepError('');
  };

  const handleCepSearch = async () => {
    if (!isValidCep(cep)) {
      setCepError('CEP inválido. Use o formato 00000-000.');
      return;
    }
    setFetchingCep(true);
    setCepError('');
    const result = await fetchAddressByCep(cep);
    if (result) {
      setStreet(result.logradouro || '');
      setNeighborhood(result.bairro || '');
      setCity(result.localidade || '');
      setState(result.uf || '');
      toast.success('Endereço preenchido automaticamente!');
    } else {
      setCepError('CEP não encontrado. Verifique e tente novamente.');
    }
    setFetchingCep(false);
  };

  // Auto-search when CEP reaches 9 chars (XXXXX-XXX)
  useEffect(() => {
    if (cepDigits(cep).length === 8) {
      handleCepSearch();
    }
  }, [cep]);

  const normalizeFile = (file: File): File => {
    // Mobile cameras may produce files with bad names/types (e.g. HEIC, no extension)
    const type = file.type || 'image/jpeg';
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
      'image/webp': 'webp', 'image/heic': 'jpg', 'image/heif': 'jpg',
    };
    const ext = extMap[type] || 'jpg';
    const safeName = `avatar.${ext}`;
    // Re-wrap as a clean File to avoid mobile blob quirks
    return new File([file], safeName, { type: type === 'image/heic' || type === 'image/heif' ? 'image/jpeg' : type });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    // Reset input FIRST so same file can be re-selected on mobile
    e.target.value = '';
    if (!raw) return;
    if (raw.type && !raw.type.startsWith('image/') && raw.size > 0) {
      toast.error('Selecione uma imagem válida.');
      return;
    }
    if (raw.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }
    const file = normalizeFile(raw);
    setAvatarFile(file);
    // Instant preview via object URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setAvatarUrl(null);
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return avatarUrl;
    setUploading(true);
    try {
      const ext = avatarFile.name.split('.').pop() || 'jpg';
      // Unique path: userId + timestamp + random UUID to guarantee no cache collision
      const uniqueId = crypto.randomUUID();
      const filePath = `${userId}/avatar-${Date.now()}-${uniqueId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          upsert: false,
          cacheControl: '0',
          contentType: avatarFile.type,
        });

      if (uploadError) {
        toast.error('Erro ao enviar foto: ' + uploadError.message);
        setUploading(false);
        return null;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      // Cache-bust query param to force browsers/CDNs to fetch fresh
      const finalUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      setUploading(false);
      return finalUrl;
    } catch (err: any) {
      toast.error('Erro inesperado no upload: ' + (err?.message || 'Tente novamente'));
      setUploading(false);
      return null;
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      toast.error('Preencha todos os campos obrigatórios.'); return;
    }
    if (!previewUrl && !avatarUrl) { toast.error('A foto é obrigatória.'); return; }
    if (!isValidPhone(phone)) { toast.error('Celular inválido. Use o formato (11) 99999-9999.'); return; }
    if (!isValidEmail(email)) { toast.error('E-mail inválido. Verifique o formato.'); return; }
    if (cep.trim() && !isValidCep(cep)) { toast.error('CEP inválido. Use o formato 00000-000.'); return; }

    const targetId = isEditingOther ? editUserId! : user!.id;
    setSaving(true);

    // 1. Upload avatar if changed
    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      finalAvatarUrl = await uploadAvatar(targetId);
      if (!finalAvatarUrl) { setSaving(false); return; }
    }

    // 2. Update profile in database
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: normalizeEmail(email),
      avatar_url: finalAvatarUrl,
      cep: cep.trim() || null,
      street: street.trim() || null,
      address_number: addressNumber.trim() || null,
      address_complement: addressComplement.trim() || null,
      neighborhood: neighborhood.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', targetId);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      setSaving(false);
      return;
    }

    // 3. Immediately update global profile state (optimistic) so header/sidebar/dashboard render new photo
    if (!isEditingOther) {
      updateProfile({
        full_name: fullName.trim(),
        avatar_url: finalAvatarUrl,
        phone: phone.trim(),
        email: normalizeEmail(email),
      } as any);
    }

    // 4. Update local state
    setAvatarUrl(finalAvatarUrl);
    setPreviewUrl(finalAvatarUrl);
    setAvatarFile(null);
    setSubmitted(false);

    toast.success('Perfil salvo com sucesso!');
    setSaving(false);

    // 5. Background refresh from DB to ensure consistency, then navigate
    if (!isEditingOther) {
      refreshProfile().then(() => navigate('/'));
    } else {
      navigate('/usuarios');
    }
  };

  const showAvatar = previewUrl || avatarUrl;
  const showIncompleteWarning = !isEditingOther && !isProfileComplete;
  const title = isEditingOther ? `Editar: ${targetProfile?.full_name || ''}` : 'Meu Perfil';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-slide-up">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {showIncompleteWarning && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm font-medium text-primary">Complete seu cadastro para acessar o sistema</p>
            <p className="mt-1 text-xs text-muted-foreground">Preencha nome, celular, e-mail e foto</p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-4 text-center">
            <h1 className="font-heading text-xl font-bold">{title}</h1>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {showAvatar ? (
                  <img key={showAvatar} src={showAvatar} alt="Avatar" className="h-28 w-28 rounded-full object-cover border-4 border-primary/20" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted border-4 border-dashed border-muted-foreground/30">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} className="gap-1.5">
                  <Camera className="h-4 w-4" />Câmera
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                  <Upload className="h-4 w-4" />Galeria
                </Button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleFileSelect} className="hidden" />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              {submitted && !showAvatar && <p className="text-xs text-destructive">A foto é obrigatória.</p>}
            </div>

            {/* Required fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nome completo" className="h-12" />
                {submitted && !fullName.trim() && <p className="text-xs text-destructive">Nome é obrigatório.</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Celular *</Label>
                <PhoneInput value={phone} onChange={setPhone} placeholder="(11) 99999-9999" className="h-12" showError={submitted && phone.length > 0 ? !isValidPhone(phone) : undefined} />
                {submitted && !phone.trim() && <p className="text-xs text-destructive">Celular é obrigatório.</p>}
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <EmailInput value={email} onChange={setEmail} placeholder="seu@email.com" className="h-12" showError={submitted && email.length > 0 ? !isValidEmail(email) : undefined} />
                {submitted && !email.trim() && <p className="text-xs text-destructive">E-mail é obrigatório.</p>}
              </div>
            </div>

            {/* Address section */}
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Endereço (opcional)</p>

              <div className="space-y-1.5">
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <CepInput value={cep} onChange={handleCepChange} className="h-12 flex-1" disabled={fetchingCep} />
                  <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={handleCepSearch} disabled={fetchingCep || cepDigits(cep).length < 8}>
                    {fetchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {cepError && <p className="text-xs text-destructive">{cepError}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Logradouro</Label>
                <Input value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua, Avenida..." className="h-12" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input value={addressNumber} onChange={e => setAddressNumber(e.target.value)} placeholder="Nº" className="h-12" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Complemento</Label>
                  <Input value={addressComplement} onChange={e => setAddressComplement(e.target.value)} placeholder="Apto, Bloco..." className="h-12" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Bairro" className="h-12" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" className="h-12" />
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Input value={state} onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className="h-12" maxLength={2} />
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="h-12 w-full text-base">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar Perfil'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
