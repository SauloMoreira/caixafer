import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Plus, Minus, Trash2, ShoppingCart, User, ArrowLeft, PenLine } from 'lucide-react';
import ProductImage from '@/components/ProductImage';
import ManualItemDialog from '@/components/ManualItemDialog';
import type { ManualItem } from '@/components/ManualItemDialog';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type Volunteer = Database['public']['Tables']['spr_volunteers']['Row'];

interface CartItem {
  product?: Product;
  manualItem?: ManualItem;
  quantity: number;
  itemType: 'product' | 'manual';
}

const getItemId = (i: CartItem) => i.itemType === 'product' ? i.product!.id : i.manualItem!.id;
const getItemName = (i: CartItem) => i.itemType === 'product' ? i.product!.name : i.manualItem!.name;
const getItemPrice = (i: CartItem) => i.itemType === 'product' ? Number(i.product!.unit_price) : i.manualItem!.unitPrice;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChargeCreated?: () => void;
  preSelectedVolunteerId?: string;
}

type Step = 'select_volunteer' | 'select_products';

export default function FiadoChargeDialog({ open, onOpenChange, onChargeCreated, preSelectedVolunteerId }: Props) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('select_volunteer');
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [volSearch, setVolSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualItemOpen, setManualItemOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setCart([]);
      setSearch('');
      setVolSearch('');
      setNotes('');
      setSelectedVolunteer(null);
      fetchVolunteers();
      fetchProducts();
      setStep(preSelectedVolunteerId ? 'select_products' : 'select_volunteer');
    }
  }, [open, preSelectedVolunteerId]);

  useEffect(() => {
    if (preSelectedVolunteerId && volunteers.length > 0) {
      const vol = volunteers.find(v => v.id === preSelectedVolunteerId);
      if (vol) setSelectedVolunteer(vol);
    }
  }, [preSelectedVolunteerId, volunteers]);

  const fetchVolunteers = async () => {
    const { data } = await supabase.from('spr_volunteers').select('*').eq('is_active', true).order('full_name');
    if (data) setVolunteers(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (data) setProducts(data);
  };

  const selectVolunteer = (vol: Volunteer) => {
    setSelectedVolunteer(vol);
    setStep('select_products');
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.itemType === 'product' && i.product?.id === product.id);
      if (existing) return prev.map(i => i.itemType === 'product' && i.product?.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, itemType: 'product' as const }];
    });
  };

  const addManualToCart = (item: ManualItem) => {
    setCart(prev => [...prev, { manualItem: item, quantity: item.quantity, itemType: 'manual' as const }]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (getItemId(i) !== id) return i;
      const newQty = i.quantity + delta;
      return newQty > 0 ? { ...i, quantity: newQty } : i;
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => getItemId(i) !== id));
  };

  const total = cart.reduce((sum, i) => sum + getItemPrice(i) * i.quantity, 0);

  const confirmCharge = async () => {
    if (!profile || !selectedVolunteer || cart.length === 0) return;
    setLoading(true);
    try {
      const description = cart.map(i => `${i.quantity}x ${getItemName(i)}`).join(', ');

      const { data: charge, error: chargeError } = await supabase.from('spr_fiado_charges').insert({
        volunteer_id: selectedVolunteer.id,
        business_date: todayISO(),
        description,
        amount: total,
        notes: notes || null,
        created_by: profile.id,
      }).select().single();

      if (chargeError) throw chargeError;

      const items = cart.map(i => ({
        charge_id: charge.id,
        product_id: i.itemType === 'product' ? i.product!.id : null,
        manual_item_name: i.itemType === 'manual' ? i.manualItem!.name : null,
        item_type: i.itemType,
        quantity: i.quantity,
        unit_price: getItemPrice(i),
        line_total: getItemPrice(i) * i.quantity,
        notes: i.itemType === 'manual' ? (i.manualItem!.notes || null) : null,
      }));

      const { error: itemsError } = await supabase.from('spr_fiado_charge_items').insert(items as any);
      if (itemsError) throw itemsError;

      toast.success(`Fiado de ${formatCurrency(total)} registrado para ${selectedVolunteer.full_name}!`);
      onChargeCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao registrar fiado: ' + err.message);
    }
    setLoading(false);
  };

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
  }, [products, search]);

  const filteredVolunteers = useMemo(() => {
    if (!volSearch) return volunteers;
    const s = volSearch.toLowerCase();
    return volunteers.filter(v => v.full_name.toLowerCase().includes(s));
  }, [volunteers, volSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'select_products' && !preSelectedVolunteerId && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep('select_volunteer')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <ShoppingCart className="h-4 w-4 text-primary" />
            {step === 'select_volunteer' ? 'Novo Fiado — Selecionar Voluntário' : 'Novo Fiado'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select volunteer */}
        {step === 'select_volunteer' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar voluntário..." value={volSearch} onChange={e => setVolSearch(e.target.value)} className="h-12 pl-10" />
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredVolunteers.map(v => (
                <Card key={v.id} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => selectVolunteer(v)}>
                  <CardContent className="flex items-center gap-3 p-3">
                    {v.avatar_url ? (
                      <img src={v.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <p className="text-sm font-medium">{v.full_name}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredVolunteers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum voluntário encontrado.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select products (PDV-style) */}
        {step === 'select_products' && selectedVolunteer && (
          <div className="space-y-3">
            {/* Volunteer header */}
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              {selectedVolunteer.avatar_url ? (
                <img src={selectedVolunteer.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
              )}
              <p className="text-sm font-medium">{selectedVolunteer.full_name}</p>
            </div>

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 pl-10" />
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {/* Manual item button */}
              <button
                onClick={() => setManualItemOpen(true)}
                className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30 border-2 border-dashed border-muted-foreground/20 p-2"
              >
                <div className="flex items-center gap-1.5">
                  <PenLine className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs font-medium leading-tight text-muted-foreground">Item Avulso</p>
                </div>
              </button>
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30 flex flex-col items-center gap-1 p-2"
                >
                  <ProductImage src={(product as any).image_url} size="sm" alt={product.name} />
                  <p className="text-xs font-medium leading-tight truncate text-center w-full">{product.name}</p>
                  <p className="financial-value text-xs text-primary">{formatCurrency(Number(product.unit_price))}</p>
                </button>
              ))}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens ({cart.length})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {cart.map(item => {
                    const id = getItemId(item);
                    return (
                    <div key={id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {getItemName(item)}
                          {item.itemType === 'manual' && <span className="ml-1 text-[10px] text-muted-foreground">(avulso)</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(getItemPrice(item))}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center text-xs font-medium">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-expense" onClick={() => removeItem(id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <Input placeholder="Observações (opcional)" value={notes} onChange={e => setNotes(e.target.value)} />

                <div className="flex justify-between text-base font-bold pt-1">
                  <span>Total</span>
                  <span className="financial-value text-primary">{formatCurrency(total)}</span>
                </div>

                <Button className="h-12 w-full" onClick={confirmCharge} disabled={loading}>
                  {loading ? 'Registrando...' : `Registrar Fiado ${formatCurrency(total)}`}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>

      {/* Manual Item Dialog */}
      <ManualItemDialog open={manualItemOpen} onOpenChange={setManualItemOpen} onAdd={addManualToCart} />
    </Dialog>
  );
}
