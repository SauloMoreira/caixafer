import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, todayISO } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Plus, Minus, Trash2, ShoppingCart, User, ArrowLeft, PenLine, ChevronRight, X } from 'lucide-react';
import ProductImage from '@/components/ProductImage';
import ManualItemDialog from '@/components/ManualItemDialog';
import SaleReceiptDialog from '@/components/SaleReceiptDialog';
import type { ManualItem } from '@/components/ManualItemDialog';
import type { ReceiptData } from '@/components/SaleReceipt';
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
  const [showCart, setShowCart] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (open) {
      setCart([]);
      setSearch('');
      setVolSearch('');
      setNotes('');
      setSelectedVolunteer(null);
      setShowCart(false);
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
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

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

      // Montar dados do recibo (número = últimos 4 chars do UUID como referência)
      const refNumber = parseInt(charge.id.replace(/-/g, '').slice(-6), 16) % 100000;
      setReceiptData({
        saleNumber: refNumber,
        createdAt: charge.created_at,
        operatorName: profile.full_name,
        items: cart.map(i => ({
          name: getItemName(i),
          quantity: i.quantity,
          unitPrice: getItemPrice(i),
          lineTotal: getItemPrice(i) * i.quantity,
        })),
        subtotal: total,
        discount: 0,
        total,
        isFiado: true,
        volunteerName: selectedVolunteer.full_name,
        notes: notes || null,
      });
      setReceiptOpen(true);
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

  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    cart.forEach(i => { map[getItemId(i)] = i.quantity; });
    return map;
  }, [cart]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-full sm:max-w-4xl w-[95vw] p-0 gap-0 max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0 bg-[var(--color-surface)]">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {step === 'select_products' && !preSelectedVolunteerId && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setStep('select_volunteer'); setShowCart(false); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              {step === 'select_volunteer' ? 'Selecionar Voluntário' : 'Novo Fiado'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full hover:bg-[var(--color-surface-alt)]"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="h-5 w-5 text-[var(--color-text-muted)]" />
            </Button>
          </div>
        </DialogHeader>

        {/* Step 1: Select volunteer */}
        {step === 'select_volunteer' && (
          <div className="flex flex-col flex-1 overflow-hidden px-4 sm:px-6 py-4 gap-4">
            <div className="relative shrink-0 max-w-3xl mx-auto w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar voluntário..." value={volSearch} onChange={e => setVolSearch(e.target.value)} className="h-12 pl-10 text-sm sm:text-base" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 max-w-3xl mx-auto w-full">
              {filteredVolunteers.map(v => (
                <button
                  key={v.id}
                  onClick={() => selectVolunteer(v)}
                  className="w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left active:scale-[0.98]"
                >
                  {v.avatar_url ? (
                    <img src={v.avatar_url} alt="" className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                  )}
                  <p className="text-sm sm:text-base font-medium flex-1 text-left">{v.full_name}</p>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              ))}
              {filteredVolunteers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                  <User className="h-10 w-10 opacity-30" />
                  <p className="text-sm sm:text-base">Nenhum voluntário encontrado.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Products */}
        {step === 'select_products' && selectedVolunteer && !showCart && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Volunteer pill */}
            <div className="px-4 sm:px-6 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 w-fit">
                {selectedVolunteer.avatar_url ? (
                  <img src={selectedVolunteer.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <p className="text-xs sm:text-sm font-semibold text-primary">{selectedVolunteer.full_name}</p>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 sm:px-6 pb-2 shrink-0 max-w-3xl w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 pl-10 text-sm sm:text-base" />
              </div>
            </div>

            {/* Product grid — full scrollable area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 max-w-5xl mx-auto">
                {/* Item Avulso */}
                <button
                  onClick={() => setManualItemOpen(true)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95 min-h-[100px] sm:min-h-[120px]"
                >
                  <PenLine className="h-5 w-5 text-muted-foreground" />
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight text-center">Item Avulso</p>
                </button>

                {filteredProducts.map(product => {
                  const qty = cartQtyMap[product.id] || 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl border transition-all active:scale-95 min-h-[100px] sm:min-h-[120px] ${
                        qty > 0
                          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/30 hover:bg-primary/5'
                      }`}
                    >
                      {qty > 0 && (
                        <Badge className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary">
                          {qty}
                        </Badge>
                      )}
                      <ProductImage src={(product as any).image_url} size="sm" alt={product.name} />
                      <p className="text-xs sm:text-sm font-medium leading-tight text-center line-clamp-2 w-full">{product.name}</p>
                      <p className="financial-value text-xs sm:text-sm text-primary font-semibold">{formatCurrency(Number(product.unit_price))}</p>
                    </button>
                  );
                })}

                {filteredProducts.length === 0 && search && (
                  <div className="col-span-full flex flex-col items-center py-10 text-muted-foreground gap-2">
                    <Search className="h-8 w-8 opacity-30" />
                    <p className="text-sm sm:text-base">Nenhum produto encontrado.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cart fab / bottom bar */}
            {cart.length > 0 && (
              <div className="px-4 sm:px-6 pb-4 pt-3 border-t shrink-0">
                <Button
                  className="h-12 sm:h-14 w-full gap-2 text-sm sm:text-base font-semibold"
                  onClick={() => setShowCart(true)}
                >
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                  Ver carrinho
                  <Badge variant="secondary" className="ml-auto bg-white/20 text-white border-0 text-xs sm:text-sm">
                    {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                  </Badge>
                  <span className="font-bold">{formatCurrency(total)}</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Cart review */}
        {step === 'select_products' && selectedVolunteer && showCart && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Back to products */}
            <div className="px-4 sm:px-6 pt-4 pb-2 shrink-0">
              <button
                onClick={() => setShowCart(false)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar aos produtos
              </button>
            </div>

            {/* Volunteer pill */}
            <div className="px-4 sm:px-6 pb-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 w-fit">
                {selectedVolunteer.avatar_url ? (
                  <img src={selectedVolunteer.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <p className="text-xs sm:text-sm font-semibold text-primary">{selectedVolunteer.full_name}</p>
              </div>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-2 pb-2 max-w-3xl mx-auto w-full">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Itens do fiado
              </p>
              {cart.map(item => {
                const id = getItemId(item);
                return (
                  <div key={id} className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-3 sm:p-4">
                    <ProductImage
                      src={item.itemType === 'product' ? (item.product as any)?.image_url : null}
                      itemType={item.itemType}
                      size="sm"
                      alt={getItemName(item)}
                      className="h-10 w-10 sm:h-12 sm:w-12 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate">{getItemName(item)}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {formatCurrency(getItemPrice(item))} × {item.quantity} = <span className="font-semibold text-foreground">{formatCurrency(getItemPrice(item) * item.quantity)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(id, -1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center text-xs sm:text-sm font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(id, 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notes + total + confirm */}
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3 border-t space-y-3 shrink-0 max-w-3xl mx-auto w-full">
              <Input
                placeholder="Observações (opcional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-11 text-sm sm:text-base"
              />
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-muted-foreground">Total</span>
                <span className="financial-value text-lg sm:text-xl font-bold text-primary">{formatCurrency(total)}</span>
              </div>
              <Button className="h-12 sm:h-14 w-full text-sm sm:text-base font-semibold" onClick={confirmCharge} disabled={loading || cart.length === 0}>
                {loading ? 'Registrando...' : `Registrar Fiado · ${formatCurrency(total)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <ManualItemDialog open={manualItemOpen} onOpenChange={setManualItemOpen} onAdd={addManualToCart} />
    </Dialog>

    <SaleReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />
    </>
  );
}
