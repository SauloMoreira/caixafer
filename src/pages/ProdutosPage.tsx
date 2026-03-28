import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Package, Camera, X, Loader2 } from 'lucide-react';
import ProductImage from '@/components/ProductImage';
import CurrencyInput from '@/components/CurrencyInput';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

export default function ProdutosPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [productNotes, setProductNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data as any);
  };

  const openNew = () => {
    setEditing(null); setName(''); setCategory(''); setUnitPrice(''); setCostPrice(''); setInternalCode(''); setProductNotes(''); setIsActive(true);
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null); setRemoveImage(false);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p); setName(p.name); setCategory(p.category); setUnitPrice(String(p.unit_price)); setCostPrice(p.cost_price != null ? String(p.cost_price) : ''); setInternalCode(p.internal_code || ''); setProductNotes(p.notes || ''); setIsActive(p.is_active);
    setImageFile(null); setImagePreview(null); setExistingImageUrl((p as any).image_url || null); setRemoveImage(false);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo 5MB.'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    setRemoveImage(false);
    e.target.value = '';
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (existingImageUrl) setRemoveImage(true);
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);
    const ext = imageFile.name.split('.').pop() || 'jpg';
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) { setUploading(false); return null; }
    const path = `${userId}/${productId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true, cacheControl: '0' });
    setUploading(false);
    if (error) { toast.error('Erro no upload: ' + error.message); return null; }

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl + '?t=' + Date.now();
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome do produto.'); return; }
    if (!unitPrice || Number(unitPrice) <= 0) { toast.error('Informe um preço válido.'); return; }

    const baseData: any = {
      name, category: category || 'geral', unit_price: Number(unitPrice),
      cost_price: costPrice ? Number(costPrice) : null,
      internal_code: internalCode || null, notes: productNotes || null, is_active: isActive,
    };

    let error;
    let productId = editing?.id;

    if (editing) {
      if (removeImage) baseData.image_url = null;
      ({ error } = await supabase.from('products').update(baseData).eq('id', editing.id));
    } else {
      const { data, error: insertErr } = await supabase.from('products').insert(baseData).select('id').single();
      error = insertErr;
      if (data) productId = data.id;
    }

    if (error) { toast.error('Erro: ' + error.message); return; }

    // Upload image if selected
    if (imageFile && productId) {
      const url = await uploadImage(productId);
      if (url) {
        await supabase.from('products').update({ image_url: url } as any).eq('id', productId);
      }
    }

    toast.success(editing ? 'Produto atualizado!' : 'Produto criado!');
    setDialogOpen(false);
    fetchProducts();
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  const currentImage = imagePreview || (removeImage ? null : existingImageUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Produtos</h1>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 pl-10" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mb-2 opacity-30" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <Card key={p.id} className={`cursor-pointer transition-all hover:border-primary/30 ${!p.is_active ? 'opacity-50' : ''}`} onClick={() => openEdit(p)}>
              <CardContent className="flex items-center gap-3 p-3">
                <ProductImage src={(p as any).image_url} size="md" alt={p.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}{p.internal_code ? ` • ${p.internal_code}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="financial-value text-primary">{formatCurrency(Number(p.unit_price))}</p>
                  {isAdmin && p.cost_price != null && (
                    <p className="text-[10px] text-muted-foreground">Custo: {formatCurrency(Number(p.cost_price))}</p>
                  )}
                  {!p.is_active && <span className="text-[10px] text-muted-foreground">Inativo</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Photo upload */}
            <div>
              <Label>Foto do Produto</Label>
              <div className="mt-1 flex items-center gap-3">
                {currentImage ? (
                  <div className="relative">
                    <img src={currentImage} alt="Preview" className="h-20 w-20 rounded-lg object-cover border" />
                    <button
                      onClick={clearImage}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20">
                    <ProductImage size="lg" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Camera className="mr-1 h-3 w-3" />}
                    {currentImage ? 'Trocar' : 'Adicionar foto'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <p className="text-[10px] text-muted-foreground">JPG, PNG. Máx 5MB</p>
                </div>
              </div>
            </div>

            <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12" /></div>
            <div><Label>Categoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} className="h-12" placeholder="geral" /></div>
            <div><Label>Preço de Venda (R$) *</Label><CurrencyInput value={unitPrice} onValueChange={setUnitPrice} className="h-12" placeholder="0,00" /></div>
            <div><Label>Preço de Custo (R$)</Label><CurrencyInput value={costPrice} onValueChange={setCostPrice} className="h-12" placeholder="0,00" /></div>
            <div><Label>Código Interno</Label><Input value={internalCode} onChange={e => setInternalCode(e.target.value)} className="h-12" /></div>
            <div><Label>Observações</Label><Input value={productNotes} onChange={e => setProductNotes(e.target.value)} /></div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="h-12 w-full" onClick={handleSave} disabled={uploading}>
              {uploading ? 'Enviando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
