import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit, Search, Package } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [productNotes, setProductNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const openNew = () => { setEditing(null); setName(''); setCategory(''); setUnitPrice(''); setInternalCode(''); setProductNotes(''); setIsActive(true); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setName(p.name); setCategory(p.category); setUnitPrice(String(p.unit_price)); setInternalCode(p.internal_code || ''); setProductNotes(p.notes || ''); setIsActive(p.is_active); setDialogOpen(true); };

  const handleSave = async () => {
    const data = { name, category: category || 'geral', unit_price: Number(unitPrice), internal_code: internalCode || null, notes: productNotes || null, is_active: isActive };
    let error;
    if (editing) {
      ({ error } = await supabase.from('products').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('products').insert(data));
    }
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(editing ? 'Produto atualizado!' : 'Produto criado!'); setDialogOpen(false); fetchProducts(); }
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

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
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}{p.internal_code ? ` • ${p.internal_code}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="financial-value text-primary">{formatCurrency(Number(p.unit_price))}</p>
                  {!p.is_active && <span className="text-[10px] text-muted-foreground">Inativo</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12" /></div>
            <div><Label>Categoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} className="h-12" placeholder="geral" /></div>
            <div><Label>Preço (R$)</Label><Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="h-12" /></div>
            <div><Label>Código Interno</Label><Input value={internalCode} onChange={e => setInternalCode(e.target.value)} className="h-12" /></div>
            <div><Label>Observações</Label><Input value={productNotes} onChange={e => setProductNotes(e.target.value)} /></div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="h-12 w-full" onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
