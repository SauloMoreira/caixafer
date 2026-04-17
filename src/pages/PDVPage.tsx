import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, PAYMENT_METHODS, todayISO } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Plus, Minus, ShoppingCart, Trash2, X, Lock, Unlock, Heart, PenLine, ArrowRightLeft, ShoppingBag } from 'lucide-react';
import CashOpeningDialog from '@/components/CashOpeningDialog';
import SaleReceiptDialog from '@/components/SaleReceiptDialog';
import SPRPaymentDialog from '@/components/SPRPaymentDialog';
import QuickIncomeDialog, { QUICK_INCOME_CATEGORIES } from '@/components/QuickIncomeDialog';
import ProductImage from '@/components/ProductImage';
import ManualItemDialog from '@/components/ManualItemDialog';
import PendingTransferBanner from '@/components/PendingTransferBanner';
import type { ManualItem } from '@/components/ManualItemDialog';
import CashTransferDialog from '@/components/CashTransferDialog';
import OverrideConfirmDialog from '@/components/OverrideConfirmDialog';
import { useCashSession, logOverrideAction } from '@/hooks/useCashSession';
import type { ReceiptData } from '@/components/SaleReceipt';
import type { Database } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';

type Product = Database['public']['Tables']['products']['Row'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

interface CartItem {
  product?: Product;
  manualItem?: ManualItem;
  quantity: number;
  itemType: 'product' | 'manual';
}

const getCartItemId = (item: CartItem) => item.itemType === 'product' ? item.product!.id : item.manualItem!.id;
const getCartItemName = (item: CartItem) => item.itemType === 'product' ? item.product!.name : item.manualItem!.name;
const getCartItemPrice = (item: CartItem) => item.itemType === 'product' ? Number(item.product!.unit_price) : item.manualItem!.unitPrice;

export default function PDVPage() {
  const { profile, hasOperationalOverride } = useAuth();
  const navigate = useNavigate();
  const {
    loading: sessionLoading,
    cashStatus,
    closingId,
    isTransferredSession,
    responsibleName: sessionResponsibleName,
    isOverrideMode,
    pendingDate,
    refresh: refreshSession,
  } = useCashSession();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Opening dialog state
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false);

  // Receipt state
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // SPR Payment state
  const [sprPaymentOpen, setSprPaymentOpen] = useState(false);
  const [manualItemOpen, setManualItemOpen] = useState(false);

  // Quick income state
  const [quickIncomeOpen, setQuickIncomeOpen] = useState(false);
  const [quickIncomeCategory, setQuickIncomeCategory] = useState<typeof QUICK_INCOME_CATEGORIES[number]['value'] | null>(null);

  // Transfer state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSummary, setTransferSummary] = useState({
    openingBalance: 0,
    currentStats: { sales: 0, income: 0, expense: 0 },
  });

  // Override state
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState<(() => void) | null>(null);
  const [overrideLabel, setOverrideLabel] = useState('');

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (data) setProducts(data);
  }, []);

  const fetchTransferSummary = useCallback(async () => {
    if (!closingId) return;

    const today = todayISO();
    const [{ data: closingData }, { data: salesData }, { data: entriesData }] = await Promise.all([
      supabase
        .from('cash_closings')
        .select('opening_balance')
        .eq('id', closingId)
        .maybeSingle(),
      supabase
        .from('sales')
        .select('total_amount, is_deleted')
        .eq('business_date', today),
      supabase
        .from('cash_entries')
        .select('entry_type, amount, is_deleted')
        .eq('business_date', today),
    ]);

    const activeSales = (salesData || []).filter((sale) => !sale.is_deleted);
    const activeEntries = (entriesData || []).filter((entry) => !entry.is_deleted);

    setTransferSummary({
      openingBalance: Number(closingData?.opening_balance || 0),
      currentStats: {
        sales: activeSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0),
        income: activeEntries
          .filter((entry) => entry.entry_type === 'income')
          .reduce((sum, entry) => sum + Number(entry.amount), 0),
        expense: activeEntries
          .filter((entry) => entry.entry_type === 'expense')
          .reduce((sum, entry) => sum + Number(entry.amount), 0),
      },
    });
  }, [closingId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!transferOpen || !closingId) return;
    fetchTransferSummary();
  }, [transferOpen, closingId, fetchTransferSummary]);

  useEffect(() => {
    if (!transferOpen || !closingId) return;
    fetchTransferSummary();
  }, [transferOpen, closingId, fetchTransferSummary]);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s) || p.internal_code?.toLowerCase().includes(s));
  }, [products, search]);

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
      if (getCartItemId(i) !== id) return i;
      const newQty = i.quantity + delta;
      return newQty > 0 ? { ...i, quantity: newQty } : i;
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => getCartItemId(i) !== id));
  };

  const subtotal = cart.reduce((sum, i) => sum + getCartItemPrice(i) * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);

  const doFinalizeSale = async () => {
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
        product_id: i.itemType === 'product' ? i.product!.id : null,
        manual_item_name: i.itemType === 'manual' ? i.manualItem!.name : null,
        item_type: i.itemType,
        quantity: i.quantity,
        unit_price: getCartItemPrice(i),
        line_total: getCartItemPrice(i) * i.quantity,
        notes: i.itemType === 'manual' ? (i.manualItem!.notes || null) : null,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(items as any);
      if (itemsError) throw itemsError;

      await fetchProducts();

      // Show receipt
      setReceiptData({
        saleNumber: sale.sale_number,
        createdAt: sale.created_at,
        operatorName: profile.full_name,
        items: cart.map(i => ({
          name: getCartItemName(i),
          quantity: i.quantity,
          unitPrice: getCartItemPrice(i),
          lineTotal: getCartItemPrice(i) * i.quantity,
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

  const finalizeSale = () => {
    if (isOverrideMode) {
      setOverrideLabel('Finalizar venda no PDV');
      setOverrideAction(() => () => doFinalizeSale());
      setOverrideDialogOpen(true);
    } else {
      doFinalizeSale();
    }
  };

  // Loading state
  if (sessionLoading) {
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
        <PendingTransferBanner
          onTransferAccepted={refreshSession}
          onTransferStatusChanged={refreshSession}
        />

        {/* Blocked: another cashier has the session */}
        {cashStatus === 'blocked' && sessionResponsibleName && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-2 max-w-md mx-auto">
            <div className="flex items-start gap-2">
              <Lock className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive">Caixa já aberto</p>
                <p className="text-sm text-destructive/90">
                  Caixa já foi aberto por <strong>{sessionResponsibleName}</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  Se você precisa operar, solicite a transferência da responsabilidade.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <Lock className="h-8 w-8 text-warning" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="font-heading text-lg font-bold">
                {cashStatus === 'blocked' ? 'Operação Bloqueada' : 'Caixa Fechado'}
              </h2>
              {cashStatus === 'blocked' ? (
                <p className="text-sm text-muted-foreground">
                  Você não pode operar enquanto outro operador estiver com o caixa aberto.
                </p>
              ) : cashStatus === 'closed_today' ? (
                <p className="text-sm text-muted-foreground">O caixa do dia já foi fechado. Para continuar o atendimento e registrar novas vendas, reabra o caixa.</p>
              ) : pendingDate ? (
                <p className="text-sm text-muted-foreground">
                  Existe um caixa anterior em aberto. Feche o caixa antes de iniciar um novo dia.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Abra o caixa para começar a registrar vendas.</p>
              )}
            </div>
            {cashStatus === 'blocked' ? (
              <Button variant="outline" className="h-12 w-full max-w-xs" onClick={() => navigate('/fechamento')}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Ir para Fechamento
              </Button>
            ) : pendingDate ? (
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

        {profile && cashStatus === 'none' && (
          <CashOpeningDialog
            open={openingDialogOpen}
            onOpenChange={setOpeningDialogOpen}
            userId={profile.id}
            pendingDate={pendingDate}
            onOpened={refreshSession}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending transfer banner */}
      <PendingTransferBanner
        onTransferAccepted={refreshSession}
        onTransferStatusChanged={refreshSession}
      />

      {/* Override mode banner */}
      {isOverrideMode && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex items-start gap-2">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Modo Override Ativo</p>
            <p className="text-muted-foreground text-xs">
              Responsável atual: <strong>{sessionResponsibleName}</strong>. Suas ações serão auditadas como override do administrador principal.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
          PDV
          <span className="inline-flex items-center gap-1 rounded-full bg-income/10 px-2 py-0.5 text-[10px] font-medium text-income">
            <Unlock className="h-3 w-3" />Aberto
          </span>
          {isTransferredSession && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Transferido
            </span>
          )}
          {isOverrideMode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              Override
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {closingId && (
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)} className="text-xs">
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
              Transferir
            </Button>
          )}
          {totalQty > 0 && (
            <Button onClick={() => setShowCart(true)} className="md:hidden relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-expense text-[10px] font-bold text-expense-foreground">
                {totalQty}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Mini cart banner — mobile, when cart has items and drawer is closed */}
      {cart.length > 0 && !showCart && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="md:hidden flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 transition-colors"
          style={{
            background: 'var(--color-accent-bg)',
            borderColor: '#e2d9cc',
          }}
        >
          <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--color-accent)' }}>
            <ShoppingCart className="h-4 w-4" />
            {cart.length} {cart.length === 1 ? 'item' : 'itens'} · {formatCurrency(total)}
          </span>
          <span
            className="flex items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ background: 'var(--color-accent)', width: 22, height: 22 }}
          >
            {cart.length}
          </span>
        </button>
      )}

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

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <button
              onClick={() => setSprPaymentOpen(true)}
              className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30 border-2 border-dashed border-primary/20 bg-primary/5"
            >
              <div className="flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium leading-tight text-primary">Receber SPR</p>
              </div>
            </button>
            {QUICK_INCOME_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.value}
                  onClick={() => { setQuickIncomeCategory(cat.value); setQuickIncomeOpen(true); }}
                  className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30 border-2 border-dashed border-primary/20 bg-primary/5"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium leading-tight text-primary">{cat.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {/* Manual item button */}
            <button
              onClick={() => setManualItemOpen(true)}
              className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30 border-2 border-dashed border-muted-foreground/20"
            >
              <div className="flex items-center gap-1.5">
                <PenLine className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium leading-tight text-muted-foreground">Item Avulso</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Sem cadastro</p>
            </button>
            {filteredProducts.map(product => {
              const stock = product.quantity_in_stock ?? 0;
              const minLevel = product.minimum_stock_level;
              const isZero = stock <= 0;
              const isLow = !isZero && minLevel != null && stock <= minLevel;
              const stockColor = isZero ? 'text-destructive' : isLow ? 'text-warning' : 'text-income';
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="stat-card text-left transition-transform active:scale-95 hover:border-primary/30 flex flex-col items-center gap-1 p-2"
                >
                  <ProductImage src={(product as any).image_url} size="md" alt={product.name} />
                  <p className="text-xs font-medium leading-tight text-center w-full truncate">{product.name}</p>
                  <p className="financial-value text-sm text-primary">{formatCurrency(Number(product.unit_price))}</p>
                  <span className={`text-[10px] font-medium ${stockColor}`}>
                    {isZero ? 'Sem estoque' : `${stock} un.`}
                  </span>
                </button>
              );
            })}
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
                  {cart.map(item => {
                    const id = getCartItemId(item);
                    return (
                    <div key={id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                      <ProductImage
                        src={item.itemType === 'product' ? (item.product as any)?.image_url : null}
                        itemType={item.itemType}
                        size="sm"
                        alt={getCartItemName(item)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getCartItemName(item)}
                          {item.itemType === 'manual' && <span className="ml-1 text-[10px] text-muted-foreground">(avulso)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(getCartItemPrice(item))}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-expense" onClick={() => removeItem(id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
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
                  <Button
                    variant="outline"
                    className="h-10 w-full text-[13px]"
                    onClick={() => setShowCart(false)}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Adicionar mais itens
                  </Button>
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

      {/* Quick Income Dialog */}
      <QuickIncomeDialog open={quickIncomeOpen} onOpenChange={setQuickIncomeOpen} category={quickIncomeCategory} />

      {/* Manual Item Dialog */}
      <ManualItemDialog open={manualItemOpen} onOpenChange={setManualItemOpen} onAdd={addManualToCart} />

      {/* Cash Transfer Dialog */}
      {closingId && (
        <CashTransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          closingId={closingId}
          businessDate={todayISO()}
          currentStats={transferSummary.currentStats}
          openingBalance={transferSummary.openingBalance}
          onTransferred={refreshSession}
        />
      )}

      {/* Override Confirm Dialog */}
      <OverrideConfirmDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        actionLabel={overrideLabel}
        responsibleName={sessionResponsibleName}
        onConfirm={(reason) => {
          logOverrideAction({
            action_type: 'primary_admin_cash_operation',
            reason,
            responsible_id: null,
            session_id: closingId,
          });
          overrideAction?.();
        }}
      />
    </div>
  );
}
