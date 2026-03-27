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
import { toast } from 'sonner';
import { Camera, Upload, User, Loader2, ArrowLeft } from 'lucide-react';
import { isValidPhone, isValidEmail, normalizeEmail, applyPhoneMask } from '@/lib/masks';

interface ProfileData {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  approval_status: string;
}

export default function ProfilePage() {
  const { profile: currentProfile, user, refreshProfile, isProfileComplete, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editUserId = searchParams.get('user');
  const isEditingOther = isAdmin && editUserId && editUserId !== user?.id;

  const [targetProfile, setTargetProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    setAddress(p.address || '');
    setEmail(p.email || '');
    setAvatarUrl(p.avatar_url);
    if (p.avatar_url) setPreviewUrl(p.avatar_url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem válida.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 5MB.'); return; }
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return avatarUrl;
    setUploading(true);
    const ext = avatarFile.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
    if (error) { toast.error('Erro ao enviar foto: ' + error.message); setUploading(false); return null; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setUploading(false);
    return urlData.publicUrl + '?t=' + Date.now();
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (!fullName.trim() || !phone.trim() || !address.trim() || !email.trim()) {
      toast.error('Preencha todos os campos obrigatórios.'); return;
    }
    if (!previewUrl && !avatarUrl) { toast.error('A foto é obrigatória.'); return; }
    if (!isValidPhone(phone)) { toast.error('Celular inválido. Use o formato (11) 99999-9999.'); return; }
    if (!isValidEmail(email)) { toast.error('E-mail inválido. Verifique o formato.'); return; }

    const targetId = isEditingOther ? editUserId! : user!.id;
    setSaving(true);
    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      finalAvatarUrl = await uploadAvatar(targetId);
      if (!finalAvatarUrl) { setSaving(false); return; }
    }

    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(), phone: phone.trim(), address: address.trim(),
      email: normalizeEmail(email), avatar_url: finalAvatarUrl, updated_at: new Date().toISOString(),
    } as any).eq('id', targetId);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Perfil salvo com sucesso!');
      setAvatarFile(null);
      setSubmitted(false);
      if (isEditingOther) {
        navigate('/usuarios');
      } else {
        await refreshProfile();
        navigate('/');
      }
    }
    setSaving(false);
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
        {isEditingOther && (
          <button onClick={() => navigate('/usuarios')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar para Usuários
          </button>
        )}

        {showIncompleteWarning && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm font-medium text-primary">Complete seu cadastro para acessar o sistema</p>
            <p className="mt-1 text-xs text-muted-foreground">Todos os campos são obrigatórios</p>
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
                  <img src={showAvatar} alt="Avatar" className="h-28 w-28 rounded-full object-cover border-4 border-primary/20" />
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
              {submitted && !showAvatar && (
                <p className="text-xs text-destructive">A foto é obrigatória.</p>
              )}
            </div>

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
                <Label>Endereço *</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Endereço completo" className="h-12" />
                {submitted && !address.trim() && <p className="text-xs text-destructive">Endereço é obrigatório.</p>}
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <EmailInput value={email} onChange={setEmail} placeholder="seu@email.com" className="h-12" showError={submitted && email.length > 0 ? !isValidEmail(email) : undefined} />
                {submitted && !email.trim() && <p className="text-xs text-destructive">E-mail é obrigatório.</p>}
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
