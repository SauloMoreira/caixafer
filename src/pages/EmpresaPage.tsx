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
import { applyAccentColor } from '@/hooks/useThemeColor';
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
    theme_color: '',
    printer_ip: '',
  });
  const [printerIpError, setPrinterIpError] = useState<string | null>(null);

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
        theme_color: company.theme_color || '',
        printer_ip: company.printer_ip || '',
      });
    }
  }, [company]);

  const isValidIPv4 = (ip: string) => {
    if (!ip) return true; // empty is allowed
    return /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/.test(ip.trim());
  };

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
    if (form.printer_ip && !isValidIPv4(form.printer_ip)) {
      setPrinterIpError('IP inválido. Use o formato 192.168.0.10');
      toast.error('IP da impressora inválido');
      return;
    }
    setPrinterIpError(null);
    updateCompany({
      name: form.name,
      legal_name: form.legal_name || null,
      cnpj: form.cnpj || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      logo_url: form.logo_url || null,
      receipt_footer: form.receipt_footer || null,
      theme_color: form.theme_color || null,
      printer_ip: form.printer_ip.trim() || null,
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

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="printer_ip">Endereço IP da Impressora</Label>
              <Input
                id="printer_ip"
                value={form.printer_ip}
                onChange={e => {
                  handleChange('printer_ip', e.target.value);
                  setPrinterIpError(null);
                }}
                placeholder="Ex: 192.168.0.10"
                maxLength={15}
                inputMode="decimal"
                aria-invalid={!!printerIpError}
              />
              {printerIpError ? (
                <p className="text-xs text-destructive">{printerIpError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  IP da impressora na rede Wi-Fi local, conforme configurado no app RawBT.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Aparência do Sistema */}
      <div className="flex items-center gap-3">
        <Palette className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Aparência do Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Personalize as cores e o visual do sistema
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cor Principal</CardTitle>
            <CardDescription>Escolha a cor que representa sua marca</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Cor do Tema</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.theme_color || '#2a9d8f'}
                  onChange={e => handleChange('theme_color', e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                />
                <Input
                  value={form.theme_color || '#2a9d8f'}
                  onChange={e => handleChange('theme_color', e.target.value)}
                  placeholder="#2a9d8f"
                  className="max-w-[140px] font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Esta cor será usada como referência principal do sistema em uma atualização futura.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Paletas Sugeridas</Label>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { color: '#2a9d8f', name: 'Verde Teal' },
                  { color: '#264653', name: 'Azul Escuro' },
                  { color: '#e76f51', name: 'Laranja' },
                  { color: '#6366f1', name: 'Indigo' },
                  { color: '#8b5cf6', name: 'Violeta' },
                  { color: '#0891b2', name: 'Ciano' },
                  { color: '#059669', name: 'Esmeralda' },
                  { color: '#d97706', name: 'Âmbar' },
                  { color: '#dc2626', name: 'Vermelho' },
                  { color: '#2563eb', name: 'Azul' },
                  { color: '#7c3aed', name: 'Roxo' },
                  { color: '#db2777', name: 'Rosa' },
                ].map(p => (
                  <button
                    key={p.color}
                    type="button"
                    title={p.name}
                    onClick={() => handleChange('theme_color', p.color)}
                    className="group relative flex h-9 w-full items-center justify-center rounded-md border border-border transition-all hover:scale-110 hover:shadow-md"
                    style={{ backgroundColor: p.color }}
                  >
                    {(form.theme_color || '#2a9d8f').toLowerCase() === p.color.toLowerCase() && (
                      <Check className="h-4 w-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
            <CardDescription>Visualize como ficará a aparência</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="overflow-hidden rounded-lg border border-border"
            >
              {/* Mini header preview */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ backgroundColor: form.theme_color || '#2a9d8f' }}
              >
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-8 w-8 rounded-md object-contain bg-white/20 p-0.5" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/20">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                )}
                <span className="text-sm font-semibold text-white">
                  {form.name || 'Nome da Empresa'}
                </span>
              </div>

              {/* Mini content preview */}
              <div className="bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: form.theme_color || '#2a9d8f' }}
                  />
                  <div className="h-2 w-24 rounded bg-muted" />
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: form.theme_color || '#2a9d8f' }}
                  />
                  <div className="h-2 w-32 rounded bg-muted" />
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: form.theme_color || '#2a9d8f' }}
                  />
                  <div className="h-2 w-20 rounded bg-muted" />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <button
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: form.theme_color || '#2a9d8f' }}
                  >
                    Botão Primário
                  </button>
                  <button
                    className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    style={{ borderColor: form.theme_color || '#2a9d8f', color: form.theme_color || '#2a9d8f' }}
                  >
                    Botão Secundário
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Prévia ilustrativa. A aplicação real das cores será feita em uma próxima atualização.
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Sobre o Sistema */}
      <div className="flex items-center gap-3">
        <Info className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Sobre o Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Informações técnicas e versão
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sistema</p>
              <p className="text-sm font-semibold text-foreground">Caixa da FER</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Versão</p>
              <p className="text-sm font-semibold text-foreground">1.0.0</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Plataforma</p>
              <p className="text-sm font-semibold text-foreground">Lovable Cloud</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Empresa Ativa</p>
              <p className="text-sm font-semibold text-foreground">{company?.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fuso Horário</p>
              <p className="text-sm font-semibold text-foreground">{company?.timezone || 'America/Sao_Paulo'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Moeda</p>
              <p className="text-sm font-semibold text-foreground">{company?.currency || 'BRL'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
