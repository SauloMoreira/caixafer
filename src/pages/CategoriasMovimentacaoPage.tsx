import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useMovementCategories, type MovementCategory, type MovementCategoryType } from '@/hooks/useMovementCategories';

const movementTypeLabels: Record<MovementCategoryType, string> = {
  income: 'Entrada',
  expense: 'Saída',
};

export default function CategoriasMovimentacaoPage() {
  const { categories, loading, refresh } = useMovementCategories({ includeInactive: true });
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MovementCategory | null>(null);
  const [name, setName] = useState('');
  const [movementType, setMovementType] = useState<MovementCategoryType>('income');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;

    return categories.filter(category =>
      category.name.toLowerCase().includes(query) ||
      category.description?.toLowerCase().includes(query)
    );
  }, [categories, search]);

  const groupedCategories = useMemo(() => ({
    income: filteredCategories.filter(category => category.movement_type === 'income'),
    expense: filteredCategories.filter(category => category.movement_type === 'expense'),
  }), [filteredCategories]);

  const openNew = (type: MovementCategoryType = 'income') => {
    setEditing(null);
    setName('');
    setMovementType(type);
    setDescription('');
    setIsActive(true);
    setSortOrder(String(categories.filter(category => category.movement_type === type).length + 1));
    setDialogOpen(true);
  };

  const openEdit = (category: MovementCategory) => {
    setEditing(category);
    setName(category.name);
    setMovementType(category.movement_type);
    setDescription(category.description || '');
    setIsActive(category.is_active);
    setSortOrder(String(category.sort_order));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }

    const payload = {
      name: name.trim(),
      movement_type: movementType,
      description: description.trim() || null,
      is_active: isActive,
      sort_order: Number(sortOrder) || 0,
    };

    let error;
    if (editing) {
      ({ error } = await (supabase as any).from('movement_categories').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await (supabase as any).from('movement_categories').insert(payload));
    }

    if (error) {
      if (error.code === '23505') {
        toast.error('Já existe uma categoria com esse nome para esse tipo.');
      } else {
        toast.error('Erro: ' + error.message);
      }
      return;
    }

    toast.success(editing ? 'Categoria de movimentação atualizada!' : 'Categoria de movimentação criada!');
    setDialogOpen(false);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Categorias de Movimentação</h1>
        <Button size="sm" onClick={() => openNew()}>
          <Plus className="mr-1 h-4 w-4" />Nova
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar categoria de movimentação..."
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="h-12 pl-10"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['income', 'expense'] as const).map(type => (
          <div key={type} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{movementTypeLabels[type]}</h2>
                <p className="text-xs text-muted-foreground">Categorias disponíveis para {movementTypeLabels[type].toLowerCase()} manual.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openNew(type)}>
                <Plus className="mr-1 h-4 w-4" />Adicionar
              </Button>
            </div>

            {groupedCategories[type].length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <ArrowUpDown className="mb-2 h-10 w-10 opacity-30" />
                  <p className="text-sm">Nenhuma categoria encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {groupedCategories[type].map(category => (
                  <Card
                    key={category.id}
                    className={`cursor-pointer transition-all hover:border-primary/30 ${!category.is_active ? 'opacity-60' : ''}`}
                    onClick={() => openEdit(category)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ArrowUpDown className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{category.name}</p>
                          <Badge variant="outline" className="text-[10px]">{movementTypeLabels[category.movement_type]}</Badge>
                          {!category.is_active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ordem {category.sort_order}{category.description ? ` • ${category.description}` : ''}
                        </p>
                      </div>
                      <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria de Movimentação' : 'Nova Categoria de Movimentação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={event => setName(event.target.value)} className="h-12" placeholder="Ex: Despesa extra" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={movementType} onValueChange={value => setMovementType(value as MovementCategoryType)}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Entrada</SelectItem>
                  <SelectItem value="expense">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={event => setDescription(event.target.value)} className="h-12" placeholder="Opcional" />
            </div>
            <div>
              <Label>Ordem de exibição</Label>
              <Input type="number" inputMode="numeric" value={sortOrder} onChange={event => setSortOrder(event.target.value)} className="h-12" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
              <Label>Ativa</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="h-12 w-full" onClick={handleSave} disabled={loading}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}