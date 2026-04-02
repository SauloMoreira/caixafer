import { useState, useEffect, useRef } from 'react';
import { useCompany, Company } from '@/hooks/useCompany';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Building2, Save, Loader2, Upload, ImageIcon, Palette, Info, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { optimizeCompanyLogo } from '@/lib/logo-optimizer';
import { toast } from 'sonner';

export default function EmpresaPage() {
  const { company, isLoading, updateCompany, isUpdating } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    cnpj: '',
    email: '',
    phone: '',
    address: '',
    logo_url: '',
    receipt_footer: '',
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        legal_name: company.legal_name || '',
        cnpj: company.cnpj || '',
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
        logo_url: company.logo_url || '',
        receipt_footer: company.receipt_footer || '',
      });
    }
  }, [company]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }

    try {
      setUploading(true);
      const ts = Date.now();
      const basePath = company?.id ? `${company.id}` : 'default';

      // 1. Upload original (preserved)
      const origExt = file.name.split('.').pop() || 'jpg';
      const originalPath = `${basePath}/original_${ts}.${origExt}`;
      await supabase.storage
        .from('company-logos')
        .upload(originalPath, file, { cacheControl: '3600', upsert: true });

      // 2. Generate optimized + thumbnail versions
      const { optimized, thumbnail, isLowQuality } = await optimizeCompanyLogo(file);

      // 3. Upload optimized version
      const optimizedPath = `${basePath}/logo_${ts}.jpg`;
      const { error: optError } = await supabase.storage
        .from('company-logos')
        .upload(optimizedPath, optimized, { cacheControl: '0', upsert: true });
      if (optError) throw optError;

      // 4. Upload thumbnail
      const thumbPath = `${basePath}/thumb_${ts}.jpg`;
      await supabase.storage
        .from('company-logos')
        .upload(thumbPath, thumbnail, { cacheControl: '0', upsert: true });

      // 5. Use optimized URL
      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(optimizedPath);

      handleChange('logo_url', urlData.publicUrl);

      if (isLowQuality) {
        toast.warning('Logo enviado, mas a qualidade da imagem é baixa. Recomendamos enviar uma versão melhor.', { duration: 6000 });
      } else {
        toast.success('Logo enviado e otimizado com sucesso!');
      }
    } catch (err: any) {
      toast.error('Erro ao enviar logo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    updateCompany({
      name: form.name,
      legal_name: form.legal_name || null,
      cnpj: form.cnpj || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      logo_url: form.logo_url || null,
      receipt_footer: form.receipt_footer || null,
    } as Partial<Company>);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dados da Empresa</h1>
          <p className="text-sm text-muted-foreground">
            Configure as informações da sua empresa
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informações Principais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Principais</CardTitle>
            <CardDescription>Nome, razão social e documentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Fantasia *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legal_name">Razão Social</Label>
              <Input
                id="legal_name"
                value={form.legal_name}
                onChange={e => handleChange('legal_name', e.target.value)}
                placeholder="Razão social completa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={e => handleChange('cnpj', e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contato</CardTitle>
            <CardDescription>Telefone, email e endereço</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="contato@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={e => handleChange('address', e.target.value)}
                placeholder="Endereço completo"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Identidade Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Identidade Visual</CardTitle>
            <CardDescription>Logo e personalização</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              {form.logo_url ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <img
                    src={form.logo_url}
                    alt="Logo da empresa"
                    className="max-h-24 max-w-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Trocar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChange('logo_url', '')}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-8 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <ImageIcon className="h-8 w-8" />
                  )}
                  <span className="text-sm font-medium">
                    {uploading ? 'Enviando...' : 'Clique para enviar o logo'}
                  </span>
                  <span className="text-xs">PNG, JPG até 5MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </CardContent>
        </Card>

        {/* Impressão e PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Impressão e PDF</CardTitle>
            <CardDescription>Configurações para documentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receipt_footer">Rodapé para Impressão</Label>
              <Textarea
                id="receipt_footer"
                value={form.receipt_footer}
                onChange={e => handleChange('receipt_footer', e.target.value)}
                placeholder="Texto que aparecerá no rodapé dos recibos e documentos"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Este texto será exibido no rodapé de recibos, fechamentos e documentos impressos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isUpdating || !form.name.trim()}>
          {isUpdating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
