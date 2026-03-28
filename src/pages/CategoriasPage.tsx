import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Tag, Pencil } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order').order('name');
    if (data) setCategories(data as any);
  };

  const openNew = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setSortOrder(String(categories.length));
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setDescription(c.description || '');
    setIsActive(c.is_active);
    setSortOrder(String(c.sort_order));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome da categoria.'); return; }

    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
      sort_order: Number(sortOrder) || 0,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('categories').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('categories').insert(payload));
    }

    if (error) {
      if (error.code === '23505') {
        toast.error('Já existe uma categoria com esse nome.');
      } else {
        toast.error('Erro: ' + error.message);
      }
      return;
    }

    toast.success(editing ? 'Categoria atualizada!' : 'Categoria criada!');
    setDialogOpen(false);
    fetchCategories();
  };

  const filtered = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Categorias</h1>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Nova</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar categoria..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 pl-10" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Tag className="h-12 w-12 mb-2 opacity-30" />
          <p className="text-sm">Nenhuma categoria encontrada</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <Card
              key={c.id}
              className={`cursor-pointer transition-all hover:border-primary/30 ${!c.is_active ? 'opacity-50' : ''}`}
              onClick={() => openEdit(c)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!c.is_active && <span className="text-[10px] text-muted-foreground">Inativa</span>}
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="h-12" placeholder="Ex: Bebidas" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} className="h-12" placeholder="Opcional" />
            </div>
            <div>
              <Label>Ordem de exibição</Label>
              <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="h-12" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="h-12 w-full" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
