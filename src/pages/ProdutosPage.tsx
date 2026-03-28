import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { optimizeImage } from '@/lib/image-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Package, Camera, ImagePlus, X, Loader2, ScanLine, PackageX, AlertTriangle, Settings } from 'lucide-react';
import BarcodeScannerDialog from '@/components/BarcodeScannerDialog';
import StockAdjustmentDialog from '@/components/StockAdjustmentDialog';
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
  const [categoryId, setCategoryId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [productNotes, setProductNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<{ id: string; name: string; quantity_in_stock: number } | null>(null);
  const [quantityInStock, setQuantityInStock] = useState('0');
  const [minimumStockLevel, setMinimumStockLevel] = useState('');

  // Categories
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data as any);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order').order('name');
    if (data) setCategories(data as any);
  };

  const openNew = () => {
    setEditing(null); setName(''); setCategoryId(''); setUnitPrice(''); setCostPrice(''); setInternalCode(''); setProductNotes(''); setIsActive(true);
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null); setRemoveImage(false);
    setQuantityInStock('0'); setMinimumStockLevel('');
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p); setName(p.name); setCategoryId(p.category_id || ''); setUnitPrice(String(p.unit_price)); setCostPrice(p.cost_price != null ? String(p.cost_price) : ''); setInternalCode(p.internal_code || ''); setProductNotes(p.notes || ''); setIsActive(p.is_active);
    setImageFile(null); setImagePreview(null); setExistingImageUrl((p as any).image_url || null); setRemoveImage(false);
    setQuantityInStock(String((p as any).quantity_in_stock ?? 0));
    setMinimumStockLevel((p as any).minimum_stock_level != null ? String((p as any).minimum_stock_level) : '');
    setDialogOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so re-selecting same file works
    e.target.value = '';

    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo 15MB.'); return; }

    try {
      // Optimize (resize + compress to JPEG)
      const optimized = await optimizeImage(file);
      setImageFile(optimized);

      // Generate preview from optimized file
      const previewUrl = URL.createObjectURL(optimized);
      setImagePreview(previewUrl);
      setRemoveImage(false);
    } catch {
      toast.error('Erro ao processar imagem. Tente novamente.');
    }
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (existingImageUrl) setRemoveImage(true);
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) { setUploading(false); toast.error('Usuário não autenticado.'); return null; }

    // Always use .jpg since we optimize to JPEG
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const path = `${userId}/${productId}-${uniqueId}.jpg`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, imageFile, {
        upsert: false,
        cacheControl: '3600',
        contentType: 'image/jpeg',
      });
    setUploading(false);

    if (error) { toast.error('Erro no upload: ' + error.message); return null; }

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome do produto.'); return; }
    if (!unitPrice || Number(unitPrice) <= 0) { toast.error('Informe um preço válido.'); return; }

    if (!categoryId) { toast.error('Selecione uma categoria.'); return; }

    // Find category name for dual-write
    const selectedCat = categories.find(c => c.id === categoryId);
    const categoryName = selectedCat?.name || 'Geral';

    const baseData: any = {
      name, category: categoryName, category_id: categoryId, unit_price: Number(unitPrice),
      cost_price: costPrice ? Number(costPrice) : null,
      internal_code: internalCode || null, notes: productNotes || null, is_active: isActive,
      quantity_in_stock: parseInt(quantityInStock) || 0,
      minimum_stock_level: minimumStockLevel ? parseInt(minimumStockLevel) : null,
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
        const { error: imgErr } = await supabase.from('products').update({ image_url: url }).eq('id', productId);
        if (imgErr) { toast.error('Produto salvo, mas erro ao vincular imagem.'); }
      }
    }

    // Cleanup preview blob URL
    if (imagePreview) URL.revokeObjectURL(imagePreview);

    toast.success(editing ? 'Produto atualizado!' : 'Produto criado!');
    setDialogOpen(false);
    fetchProducts();
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  const currentImage = imagePreview || (removeImage ? null : existingImageUrl);

  const totalProducts = products.length;
  const totalActive = products.filter(p => p.is_active).length;
  const totalInactive = totalProducts - totalActive;
  const totalZeroStock = products.filter(p => (p as any).quantity_in_stock <= 0 && p.is_active).length;
  const totalLowStock = products.filter(p => {
    const q = (p as any).quantity_in_stock;
    const min = (p as any).minimum_stock_level;
    return min != null && q > 0 && q <= min && p.is_active;
  }).length;

  const getStockBadge = (p: Product) => {
    const qty = (p as any).quantity_in_stock ?? 0;
    const min = (p as any).minimum_stock_level;
    if (qty <= 0) return <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">Sem estoque</Badge>;
    if (min != null && qty <= min) return <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">Estoque baixo</Badge>;
    return null;
  };

  const openStockAdjust = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setStockAdjustProduct({ id: p.id, name: p.name, quantity_in_stock: (p as any).quantity_in_stock ?? 0 });
    setStockAdjustOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Produtos</h1>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo</Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="stat-card flex flex-col items-center justify-center py-3 sm:py-4">
          <span className="text-lg sm:text-2xl font-bold text-foreground">{totalProducts}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Total</span>
        </div>
        <div className="stat-card flex flex-col items-center justify-center py-3 sm:py-4">
          <span className="text-lg sm:text-2xl font-bold text-primary">{totalActive}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Ativos</span>
        </div>
        <div className="stat-card flex flex-col items-center justify-center py-3 sm:py-4">
          <span className="text-lg sm:text-2xl font-bold text-destructive">{totalInactive}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Inativos</span>
        </div>
      </div>

      {(totalZeroStock > 0 || totalLowStock > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {totalZeroStock > 0 && (
            <div className="stat-card flex items-center gap-2 py-2 px-3 border-destructive/20">
              <PackageX className="h-4 w-4 text-destructive shrink-0" />
              <div>
                <span className="text-sm font-bold text-destructive">{totalZeroStock}</span>
                <span className="text-[10px] text-muted-foreground ml-1">sem estoque</span>
              </div>
            </div>
          )}
          {totalLowStock > 0 && (
            <div className="stat-card flex items-center gap-2 py-2 px-3 border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <div>
                <span className="text-sm font-bold text-warning">{totalLowStock}</span>
                <span className="text-[10px] text-muted-foreground ml-1">estoque baixo</span>
              </div>
            </div>
          )}
        </div>
      )}

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
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">Est: {(p as any).quantity_in_stock ?? 0}</span>
                    {getStockBadge(p)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="financial-value text-primary">{formatCurrency(Number(p.unit_price))}</p>
                  {isAdmin && p.cost_price != null && (
                    <p className="text-[10px] text-muted-foreground">Custo: {formatCurrency(Number(p.cost_price))}</p>
                  )}
                  {isAdmin && (
                    <button
                      className="text-[10px] text-primary hover:underline mt-0.5"
                      onClick={(e) => openStockAdjust(p, e)}
                    >
                      Ajustar estoque
                    </button>
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
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Camera className="mr-1 h-3 w-3" />}
                      Câmera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <ImagePlus className="mr-1 h-3 w-3" />
                      Galeria
                    </Button>
                  </div>
                  {/* Camera input - with capture */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {/* File/gallery input - without capture */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <p className="text-[10px] text-muted-foreground">Foto otimizada automaticamente</p>
                </div>
              </div>
            </div>

            <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12" /></div>
            <div>
              <Label>Categoria *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Preço de Venda (R$) *</Label><CurrencyInput value={unitPrice} onValueChange={setUnitPrice} className="h-12" placeholder="0,00" /></div>
            <div><Label>Preço de Custo (R$)</Label><CurrencyInput value={costPrice} onValueChange={setCostPrice} className="h-12" placeholder="0,00" /></div>
            <div>
              <Label>Código Interno</Label>
              <div className="flex gap-2">
                <Input value={internalCode} onChange={e => setInternalCode(e.target.value)} className="h-12 flex-1" placeholder="Digite ou escaneie" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() => setScannerOpen(true)}
                  title="Escanear código"
                >
                  <ScanLine className="h-5 w-5" />
                </Button>
              </div>
            </div>
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

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(value) => setInternalCode(value)}
      />
    </div>
  );
}
