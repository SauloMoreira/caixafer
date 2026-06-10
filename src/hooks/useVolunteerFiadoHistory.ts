import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PeriodRange = { from: string; to: string }; // YYYY-MM-DD inclusive

export interface ChargeItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_name: string;
  notes: string | null;
}

export interface ChargeRow {
  id: string;
  business_date: string;
  created_at: string;
  amount: number;
  status: string;
  description: string | null;
  notes: string | null;
  created_by: string;
  created_by_name?: string;
  items: ChargeItemRow[];
}

export interface PaymentRow {
  id: string;
  fiado_charge_id: string;
  payment_date: string;
  created_at: string;
  amount_paid: number;
  payment_method: string;
  document_type: string | null;
  document_reference: string | null;
  notes: string | null;
  created_by: string;
  created_by_name?: string;
  payment_group_id: string | null;
  charge_description?: string | null;
  charge_amount?: number;
}

export interface PaymentGroup {
  group_id: string;
  created_at: string;
  payment_date: string;
  payment_method: string;
  document_type: string | null;
  document_reference: string | null;
  created_by: string;
  created_by_name?: string;
  notes: string | null;
  total_paid: number;
  items: PaymentRow[];
  hasGroupId: boolean;
}

export interface TimelineEntry {
  occurred_at: string;
  kind: 'charge' | 'payment';
  description: string;
  debit: number;
  credit: number;
  balance_before: number;
  balance_after: number;
  user_name?: string;
  ref_id: string;
}

export interface VolunteerHistoryData {
  volunteer: { id: string; full_name: string; avatar_url: string | null } | null;
  charges: ChargeRow[];
  payments: PaymentRow[];
  paymentGroups: PaymentGroup[];
  timeline: TimelineEntry[];
  previousBalance: number;
  summary: {
    acquired_total: number;
    paid_total: number;
    current_balance: number; // saldo TOTAL atual (todos os tempos)
    period_net: number;
    open_charges_count: number;
    payments_count: number;
    last_payment_at: string | null;
    last_payment_amount: number | null;
    status: 'paid' | 'partial' | 'open';
  };
}

async function fetchVolunteerHistory(volunteerId: string, range: PeriodRange): Promise<VolunteerHistoryData> {
  const fromIso = `${range.from}T00:00:00`;
  const toIso = `${range.to}T23:59:59.999`;

  const [volRes, allChargesRes, allPaymentsRes, periodChargesRes, periodPaymentsRes] = await Promise.all([
    supabase.from('spr_volunteers').select('id, full_name, avatar_url').eq('id', volunteerId).maybeSingle(),
    supabase.from('spr_fiado_charges').select('id, amount, created_at').eq('volunteer_id', volunteerId),
    supabase.from('spr_fiado_payments').select('id, amount_paid, created_at, payment_date').eq('volunteer_id', volunteerId).eq('is_deleted', false),
    supabase
      .from('spr_fiado_charges')
      .select('id, business_date, created_at, amount, status, description, notes, created_by, spr_fiado_charge_items(id, quantity, unit_price, line_total, manual_item_name, notes, products(name))')
      .eq('volunteer_id', volunteerId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true }),
    supabase
      .from('spr_fiado_payments')
      .select('id, fiado_charge_id, payment_date, created_at, amount_paid, payment_method, document_type, document_reference, notes, created_by, payment_group_id, spr_fiado_charges(description, amount)')
      .eq('volunteer_id', volunteerId)
      .eq('is_deleted', false)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true }),
  ]);

  const allCharges = allChargesRes.data || [];
  const allPayments = allPaymentsRes.data || [];
  const totalAcquiredEver = allCharges.reduce((s, c) => s + Number(c.amount), 0);
  const totalPaidEver = allPayments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const currentBalance = totalAcquiredEver - totalPaidEver;

  const periodCharges = periodChargesRes.data || [];
  const periodPayments = periodPaymentsRes.data || [];

  // user names
  const userIds = Array.from(new Set([
    ...periodCharges.map((c: any) => c.created_by),
    ...periodPayments.map((p: any) => p.created_by),
  ])).filter(Boolean);
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds as string[]);
    nameMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name]));
  }

  const charges: ChargeRow[] = periodCharges.map((c: any) => ({
    id: c.id,
    business_date: c.business_date,
    created_at: c.created_at,
    amount: Number(c.amount),
    status: c.status,
    description: c.description,
    notes: c.notes,
    created_by: c.created_by,
    created_by_name: nameMap[c.created_by],
    items: (c.spr_fiado_charge_items || []).map((i: any) => ({
      id: i.id,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
      product_name: i.products?.name || i.manual_item_name || 'Item',
      notes: i.notes,
    })),
  }));

  const payments: PaymentRow[] = periodPayments.map((p: any) => ({
    id: p.id,
    fiado_charge_id: p.fiado_charge_id,
    payment_date: p.payment_date,
    created_at: p.created_at,
    amount_paid: Number(p.amount_paid),
    payment_method: p.payment_method,
    document_type: p.document_type,
    document_reference: p.document_reference,
    notes: p.notes,
    created_by: p.created_by,
    created_by_name: nameMap[p.created_by],
    payment_group_id: p.payment_group_id,
    charge_description: p.spr_fiado_charges?.description ?? null,
    charge_amount: p.spr_fiado_charges ? Number(p.spr_fiado_charges.amount) : undefined,
  }));

  // Group payments by payment_group_id (fallback to id)
  const groupsMap = new Map<string, PaymentGroup>();
  for (const p of payments) {
    const key = p.payment_group_id || p.id;
    const existing = groupsMap.get(key);
    if (existing) {
      existing.total_paid += p.amount_paid;
      existing.items.push(p);
    } else {
      groupsMap.set(key, {
        group_id: key,
        created_at: p.created_at,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        document_type: p.document_type,
        document_reference: p.document_reference,
        created_by: p.created_by,
        created_by_name: p.created_by_name,
        notes: p.notes,
        total_paid: p.amount_paid,
        items: [p],
        hasGroupId: !!p.payment_group_id,
      });
    }
  }
  const paymentGroups = Array.from(groupsMap.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Previous balance (before fromIso)
  const previousBalance =
    allCharges.filter(c => c.created_at < fromIso).reduce((s, c) => s + Number(c.amount), 0) -
    allPayments.filter(p => p.created_at < fromIso).reduce((s, p) => s + Number(p.amount_paid), 0);

  // Timeline
  const events: Array<{ at: string; kind: 'charge' | 'payment'; debit: number; credit: number; description: string; user_name?: string; ref_id: string }> = [];
  for (const c of charges) {
    events.push({
      at: c.created_at,
      kind: 'charge',
      debit: c.amount,
      credit: 0,
      description: c.description || (c.items[0]?.product_name ?? 'Fiado adquirido'),
      user_name: c.created_by_name,
      ref_id: c.id,
    });
  }
  for (const g of paymentGroups) {
    events.push({
      at: g.created_at,
      kind: 'payment',
      debit: 0,
      credit: g.total_paid,
      description: `Pagamento (${g.items.length} ${g.items.length === 1 ? 'item' : 'itens'}) · ${g.payment_method}`,
      user_name: g.created_by_name,
      ref_id: g.group_id,
    });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));

  let running = previousBalance;
  const timeline: TimelineEntry[] = events.map(e => {
    const before = running;
    running = running + e.debit - e.credit;
    return {
      occurred_at: e.at,
      kind: e.kind,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance_before: before,
      balance_after: running,
      user_name: e.user_name,
      ref_id: e.ref_id,
    };
  });

  const acquired_total = charges.reduce((s, c) => s + c.amount, 0);
  const paid_total = payments.reduce((s, p) => s + p.amount_paid, 0);
  const lastPay = payments.length ? payments[payments.length - 1] : null;
  const openCharges = allCharges.length; // count of charges with positive remaining handled via status; keep simple
  const status: 'paid' | 'partial' | 'open' = currentBalance <= 0.0001 ? 'paid' : totalPaidEver > 0 ? 'partial' : 'open';

  return {
    volunteer: volRes.data as any,
    charges,
    payments,
    paymentGroups,
    timeline,
    previousBalance,
    summary: {
      acquired_total,
      paid_total,
      current_balance: currentBalance,
      period_net: acquired_total - paid_total,
      open_charges_count: openCharges,
      payments_count: payments.length,
      last_payment_at: lastPay?.created_at ?? null,
      last_payment_amount: lastPay?.amount_paid ?? null,
      status,
    },
  };
}

export function useVolunteerFiadoHistory(volunteerId: string | null, range: PeriodRange) {
  return useQuery({
    queryKey: ['volunteer-history', volunteerId, range.from, range.to],
    queryFn: () => fetchVolunteerHistory(volunteerId!, range),
    enabled: !!volunteerId,
    staleTime: 30_000,
  });
}
