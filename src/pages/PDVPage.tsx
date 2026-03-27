import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, PAYMENT_METHODS, todayISO } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Plus, Minus, ShoppingCart, Trash2, X, Lock, Unlock, Heart } from 'lucide-react';
import CashOpeningDialog from '@/components/CashOpeningDialog';
import SaleReceiptDialog from '@/components/SaleReceiptDialog';
import SPRPaymentDialog from '@/components/SPRPaymentDialog';
import QuickIncomeDialog, { QUICK_INCOME_CATEGORIES } from '@/components/QuickIncomeDialog';
import type { ReceiptData } from '@/components/SaleReceipt';
import type { Database } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';

type Product = Database['public']['Tables']['products']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

interface CartItem {
  product: Product;
  quantity: number;
}

export default function PDVPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Cash register state
  const [cashStatus, setCashStatus] = useState<'loading' | 'open' | 'closed_today' | 'none'>('loading');
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false);

  // Receipt state
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // SPR Payment state
  const [sprPaymentOpen, setSprPaymentOpen] = useState(false);

  // Quick income state
  const [quickIncomeOpen, setQuickIncomeOpen] = useState(false);
  const [quickIncomeCategory, setQuickIncomeCategory] = useState<typeof QUICK_INCOME_CATEGORIES[number]['value'] | null>(null);

  const checkCashRegister = useCallback(async () => {
    if (!profile) return;
    setCashStatus('loading');
    const today = todayISO();

    // Check if there's an open cash register for today
    const { data: todayClosing } = await supabase
      .from('cash_closings')
      .select('id, status')
      .eq('business_date', today)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (todayClosing) {
      setCashStatus(todayClosing.status === 'open' ? 'open' : 'closed_today');
      setPendingDate(null);
    } else {
      // Check for pending previous days (open closings before today)
      const { data: pendingClosings } = await supabase
        .from('cash_closings')
        .select('business_date')
        .eq('user_id', profile.id)
        .eq('status', 'open')
        .lt('business_date', today)
        .order('business_date', { ascending: false })
        .limit(1);

      setPendingDate(pendingClosings?.[0]?.business_date || null);
      setCashStatus('none');
    }
  }, [profile]);

  useEffect(() => {
    supabase.from('products').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setProducts(data); });
  }, []);

  useEffect(() => {
    checkCashRegister();
  }, [checkCashRegister]);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s) || p.internal_code?.toLowerCase().includes(s));
  }, [products, search]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty > 0 ? { ...i, quantity: newQty } : i;
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + Number(i.product.unit_price) * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const finalizeSale = async () => {
    if (!profile || cart.length === 0) return;
    if (cashStatus !== 'open') {
      toast.error('Abra o caixa do dia antes de realizar vendas.');
      return;
    }
    setLoading(true);
    try {
      const { data: sale, error: saleError } = await supabase.from('sales').insert({
        business_date: todayISO(),
        created_by: profile.id,
        subtotal,
        discount_amount: discount,
        total_amount: total,
        payment_method: paymentMethod,
        notes: notes || null,
      }).select().single();

      if (saleError) throw saleError;

      const items = cart.map(i => ({
        sale_id: sale.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: Number(i.product.unit_price),
        line_total: Number(i.product.unit_price) * i.quantity,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(items);
      if (itemsError) throw itemsError;

      // Show receipt
      setReceiptData({
        saleNumber: sale.sale_number,
        createdAt: sale.created_at,
        operatorName: profile.full_name,
        items: cart.map(i => ({
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: Number(i.product.unit_price),
          lineTotal: Number(i.product.unit_price) * i.quantity,
        })),
        subtotal,
        discount,
        total,
        paymentMethod,
        notes: notes || null,
      });
      setReceiptOpen(true);

      toast.success(`Venda #${sale.sale_number} registrada!`);
      setCart([]);
      setDiscount(0);
      setNotes('');
      setShowCart(false);
    } catch (err: any) {
      toast.error('Erro ao registrar venda: ' + err.message);
    }
    setLoading(false);
  };

  // Loading state
  if (cashStatus === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Cash register not open — show blocking screen
  if (cashStatus !== 'open') {
    return (
      <div className="space-y-4">
        <h1 className="page-title">PDV</h1>
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <Lock className="h-8 w-8 text-warning" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="font-heading text-lg font-bold">Caixa Fechado</h2>
              {cashStatus === 'closed_today' ? (
                <p className="text-sm text-muted-foreground">O caixa de hoje já foi fechado. Não é possível realizar novas vendas.</p>
              ) : pendingDate ? (
                <p className="text-sm text-muted-foreground">
                  Existe um caixa anterior em aberto. Feche o caixa antes de iniciar um novo dia.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Abra o caixa para começar a registrar vendas.</p>
              )}
            </div>
            {pendingDate ? (
              <Button className="h-12 w-full max-w-xs" onClick={() => navigate('/fechamento')}>
                Ir para Fechamento
              </Button>
            ) : cashStatus !== 'closed_today' ? (
              <Button className="h-12 w-full max-w-xs" onClick={() => setOpeningDialogOpen(true)}>
                <Unlock className="mr-2 h-4 w-4" />
                Abrir Caixa
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {profile && (
          <CashOpeningDialog
            open={openingDialogOpen}
            onOpenChange={setOpeningDialogOpen}
            userId={profile.id}
            pendingDate={pendingDate}
            onOpened={checkCashRegister}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
          PDV
          <span className="inline-flex items-center gap-1 rounded-full bg-income/10 px-2 py-0.5 text-[10px] font-medium text-income">
            <Unlock className="h-3 w-3" />Aberto
          </span>
        </h1>
        {cart.length > 0 && (
          <Button onClick={() => setShowCart(true)} className="md:hidden relative">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-expense text-[10px] font-bold text-expense-foreground">
              {cart.length}
            </span>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Products */}
        <div className="flex-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-12 pl-10"
            />
          </div>

          {/* SPR action */}
          <button
            onClick={() => setSprPaymentOpen(true)}
            className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30 border-2 border-dashed border-primary/20 bg-primary/5"
          >
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium leading-tight text-primary">Receber SPR</p>
            </div>
            <p className="text-xs text-muted-foreground">Pagamento de fiado</p>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30"
              >
                <p className="text-sm font-medium leading-tight">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.category}</p>
                <p className="mt-1 financial-value text-base text-primary">{formatCurrency(Number(product.unit_price))}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className={`${showCart ? 'fixed inset-0 z-50 flex items-end md:relative md:inset-auto md:z-auto' : 'hidden md:block'} md:w-80`}>
          {showCart && <div className="absolute inset-0 bg-foreground/20 md:hidden" onClick={() => setShowCart(false)} />}
          <Card className={`${showCart ? 'relative w-full rounded-t-2xl md:rounded-xl' : ''} md:sticky md:top-4`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-base font-bold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Carrinho ({cart.length})
                </h2>
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowCart(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {cart.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Carrinho vazio</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(Number(item.product.unit_price))}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-expense" onClick={() => removeItem(item.product.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Desconto (R$)"
                    value={discount || ''}
                    onChange={e => setDiscount(Number(e.target.value))}
                    className="h-10"
                  />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span className="financial-value text-primary">{formatCurrency(total)}</span>
                  </div>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Observações (opcional)" value={notes} onChange={e => setNotes(e.target.value)} />
                  <Button className="h-12 w-full text-base" onClick={finalizeSale} disabled={loading}>
                    {loading ? 'Finalizando...' : `Finalizar ${formatCurrency(total)}`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receipt Dialog */}
      <SaleReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />

      {/* SPR Payment Dialog */}
      <SPRPaymentDialog open={sprPaymentOpen} onOpenChange={setSprPaymentOpen} />
    </div>
  );
}
