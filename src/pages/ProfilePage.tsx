import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, Upload, User, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { profile, user, refreshProfile, isProfileComplete } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setEmail(profile.email || user?.email || '');
      setAvatarUrl(profile.avatar_url);
      if (profile.avatar_url) setPreviewUrl(profile.avatar_url);
    }
  }, [profile, user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return avatarUrl;
    setUploading(true);
    const ext = avatarFile.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true });

    if (error) {
      toast.error('Erro ao enviar foto: ' + error.message);
      setUploading(false);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setUploading(false);
    return urlData.publicUrl + '?t=' + Date.now();
  };

  const handleSave = async () => {
    if (!fullName.trim() || !phone.trim() || !address.trim() || !email.trim()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!previewUrl && !avatarUrl) {
      toast.error('A foto é obrigatória.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('E-mail inválido.');
      return;
    }

    setSaving(true);
    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      finalAvatarUrl = await uploadAvatar();
      if (!finalAvatarUrl) { setSaving(false); return; }
    }

    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      email: email.trim(),
      avatar_url: finalAvatarUrl,
      updated_at: new Date().toISOString(),
    } as any).eq('id', user!.id);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Perfil salvo com sucesso!');
      setAvatarFile(null);
      await refreshProfile();
    }
    setSaving(false);
  };

  const showAvatar = previewUrl || avatarUrl;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-slide-up">
        {!isProfileComplete && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm font-medium text-primary">Complete seu cadastro para acessar o sistema</p>
            <p className="mt-1 text-xs text-muted-foreground">Todos os campos são obrigatórios</p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-4 text-center">
            <h1 className="font-heading text-xl font-bold">Meu Perfil</h1>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {showAvatar ? (
                  <img
                    src={showAvatar}
                    alt="Avatar"
                    className="h-28 w-28 rounded-full object-cover border-4 border-primary/20"
                  />
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Camera className="h-4 w-4" />
                  Câmera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="h-4 w-4" />
                  Galeria
                </Button>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo *</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome completo" className="h-12" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Celular *</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="h-12" required type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Endereço *</Label>
                <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Seu endereço completo" className="h-12" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profileEmail">E-mail *</Label>
                <Input id="profileEmail" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="h-12" required type="email" />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="h-12 w-full text-base">
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
              ) : (
                'Salvar Perfil'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
