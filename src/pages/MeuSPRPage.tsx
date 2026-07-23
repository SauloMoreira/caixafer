import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, todayISO } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, DollarSign, Calendar, ChevronRight, ShoppingBag, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VolunteerFiadoDetailDialog from '@/components/spr/VolunteerFiadoDetailDialog';

interface ChargeItem {
  id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_name: string;
}

interface Charge {
  id: string;
  business_date: string;
  amount: number;
  status: string;
  description: string | null;
  notes: string | null;
  items: ChargeItem[];
}

interface DayGroup {
  date: string;
  charges: Charge[];
  total: number;
  itemCount: number;
}

interface Payment {
  id: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
}

function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Bom dia, ${name}! ☀️`;
  if (hour < 18) return `Boa tarde, ${name}!`;
  return `Boa noite, ${name}! 🌙`;
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito',
  credito: 'Crédito', transferencia: 'Transferência',
};

export default function MeuSPRPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalOwed, setTotalOwed] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayGroup | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [volunteerName, setVolunteerName] = useState('');

  const volunteerId = profile?.volunteer_id;

  useEffect(() => {
    if (volunteerId) fetchData();
  }, [volunteerId]);

  const fetchData = async () => {
    if (!profile?.volunteer_id) return;
    setLoading(true);

    // Fetch volunteer name
    const { data: vol } = await supabase
      .from('spr_volunteers')
      .select('full_name')
      .eq('id', profile.volunteer_id)
      .single();
    if (vol) setVolunteerName(vol.full_name);

    // Fetch charges
    const { data: charges } = await supabase
      .from('spr_fiado_charges')
      .select('*')
      .eq('volunteer_id', profile.volunteer_id)
      .order('business_date', { ascending: false });

    // Fetch charge items with product names
    const chargeIds = charges?.map(c => c.id) || [];
    let items: any[] = [];
    if (chargeIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('spr_fiado_charge_items')
        .select('*, products(name)')
        .in('charge_id', chargeIds);
      items = itemsData || [];
    }

    // Fetch payments
    const { data: payments } = await supabase
      .from('spr_fiado_payments')
      .select('*')
      .eq('volunteer_id', profile.volunteer_id)
      .order('payment_date', { ascending: false })
      .limit(1);

    if (payments && payments.length > 0) {
      setLastPayment(payments[0] as Payment);
    }

    // Build charges with items
    const chargesWithItems: Charge[] = (charges || []).map(c => ({
      id: c.id,
      business_date: c.business_date,
      amount: Number(c.amount),
      status: c.status,
      description: c.description,
      notes: c.notes,
      items: items
        .filter(i => i.charge_id === c.id)
        .map(i => ({
          id: i.id,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          line_total: Number(i.line_total),
          product_name: (i as any).products?.name || 'Produto',
        })),
    }));

    // Group by day
    const grouped: Record<string, Charge[]> = {};
    chargesWithItems.forEach(c => {
      if (!grouped[c.business_date]) grouped[c.business_date] = [];
      grouped[c.business_date].push(c);
    });

    const groups: DayGroup[] = Object.entries(grouped)
      .map(([date, charges]) => ({
        date,
        charges,
        total: charges.reduce((s, c) => s + c.amount, 0),
        itemCount: charges.reduce((s, c) => s + c.items.reduce((si, i) => si + i.quantity, 0), 0),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    setDayGroups(groups);

    // Totals
    const unpaid = chargesWithItems.filter(c => c.status !== 'paid');
    setTotalOwed(unpaid.reduce((s, c) => s + c.amount, 0));

    const today = todayISO();
    const todayCharges = chargesWithItems.filter(c => c.business_date === today);
    setTodayTotal(todayCharges.reduce((s, c) => s + c.amount, 0));

    setLoading(false);
  };

  const openDayDetail = (group: DayGroup) => {
    setSelectedDay(group);
    setDetailOpen(true);
  };

  const statusBadge = (status: string) => {
    if (status === 'paid') return <Badge variant="default" className="bg-income/10 text-income border-0 text-[10px]">Pago</Badge>;
    if (status === 'partial') return <Badge variant="secondary" className="bg-warning/10 text-warning border-0 text-[10px]">Parcial</Badge>;
    return <Badge variant="secondary" className="bg-expense/10 text-expense border-0 text-[10px]">Em Aberto</Badge>;
  };

  if (!profile?.volunteer_id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Heart className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold">Conta não vinculada</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sua conta ainda não está vinculada a um cadastro de voluntário. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const displayName = profile.full_name?.split(' ')[0] || volunteerName?.split(' ')[0] || '';

  return (
    <div className="space-y-5 pb-20">
      {/* Header greeting */}
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
        {profile.avatar_url ? (
          <img key={profile.avatar_url} src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
            {displayName.charAt(0)?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base md:text-lg font-semibold text-foreground truncate">
            {getGreeting(displayName)}
          </p>
          <p className="text-xs text-muted-foreground">Meu Consumo</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Total owed - hero card */}
        <Card className="sm:col-span-3 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Devido</p>
              <p className={`financial-value text-2xl md:text-3xl ${totalOwed > 0 ? 'text-expense' : 'text-income'}`}>
                {formatCurrency(totalOwed)}
              </p>
            </div>
          </CardContent>
        </Card>

        {volunteerId && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="sm:col-span-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-3 text-sm font-medium text-primary text-center"
          >
            Ver meu histórico completo →
          </button>
        )}

        {/* Today's spending */}
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Gasto Hoje</span>
            </div>
            <p className="financial-value text-lg text-warning">{formatCurrency(todayTotal)}</p>
          </CardContent>
        </Card>

        {/* Last payment */}
        <Card className="stat-card sm:col-span-2">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-income" />
              <span className="text-xs text-muted-foreground">Último Pagamento</span>
            </div>
            {lastPayment ? (
              <div className="flex items-baseline gap-2">
                <p className="financial-value text-lg text-income">{formatCurrency(Number(lastPayment.amount_paid))}</p>
                <span className="text-xs text-muted-foreground">
                  em {formatDate(lastPayment.payment_date)} • {PAYMENT_LABELS[lastPayment.payment_method] || lastPayment.payment_method}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Day-by-day charges */}
      <div>
        <h2 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Gastos por Dia
        </h2>

        {dayGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8 text-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum gasto registrado.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {dayGroups.map(group => (
              <Card
                key={group.date}
                className="cursor-pointer hover:border-primary/30 active:scale-[0.99] transition-all"
                onClick={() => openDayDetail(group)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatDate(group.date)}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.charges.length} lançamento{group.charges.length > 1 ? 's' : ''} • {group.itemCount} {group.itemCount === 1 ? 'item' : 'itens'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="financial-value text-sm">{formatCurrency(group.total)}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Day detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {selectedDay && formatDate(selectedDay.date)}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-4">
              {/* Day summary */}
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                <span className="text-sm text-muted-foreground">Total do dia</span>
                <span className="financial-value text-lg font-bold">{formatCurrency(selectedDay.total)}</span>
              </div>

              {/* Charges */}
              {selectedDay.charges.map((charge, idx) => (
                <div key={charge.id} className="space-y-2">
                  {selectedDay.charges.length > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Lançamento {idx + 1}
                      </p>
                      {statusBadge(charge.status)}
                    </div>
                  )}
                  {selectedDay.charges.length === 1 && (
                    <div className="flex justify-end">{statusBadge(charge.status)}</div>
                  )}

                  {charge.description && (
                    <p className="text-sm text-muted-foreground">{charge.description}</p>
                  )}

                  {/* Items table */}
                  {charge.items.length > 0 ? (
                    <div className="rounded-xl border overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 bg-muted/50 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Produto</span>
                        <span className="text-right">Qtd</span>
                        <span className="text-right">Unit.</span>
                        <span className="text-right">Total</span>
                      </div>
                      {charge.items.map(item => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2.5 text-sm border-t">
                          <span className="truncate">{item.product_name}</span>
                          <span className="text-right text-muted-foreground">{item.quantity}</span>
                          <span className="text-right text-muted-foreground">{formatCurrency(item.unit_price)}</span>
                          <span className="text-right font-medium">{formatCurrency(item.line_total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sem itens detalhados</p>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="financial-value text-base font-bold">{formatCurrency(charge.amount)}</span>
                  </div>

                  {charge.notes && (
                    <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-lg p-2">
                      📝 {charge.notes}
                    </p>
                  )}

                  {idx < selectedDay.charges.length - 1 && <hr className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VolunteerFiadoDetailDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        volunteerId={volunteerId ?? null}
        mode="self"
      />
    </div>
  );
}
