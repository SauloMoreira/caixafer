import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MovementOrigin =
  | "PDV"
  | "SPR"
  | "Fiado"
  | "Pagamento"
  | "Estoque"
  | "Ajuste Manual"
  | "Cancelamento"
  | "Estorno";

export type MovementType =
  | "venda"
  | "entrada"
  | "saida"
  | "recebimento"
  | "baixa"
  | "cancelamento"
  | "estorno"
  | "ajuste"
  | "fiado"
  | "estoque";

export interface MovementRow {
  key: string;
  occurred_at: string; // ISO
  origin: MovementOrigin;
  type: MovementType;
  ref_id: string;
  ref_label?: string;
  client?: string | null;
  description?: string | null;
  payment_method?: string | null;
  amount: number;
  status: string;
  user_id?: string | null;
  user_name?: string | null;
  notes?: string | null;
  raw: any;
  source_table:
    | "sales"
    | "cash_entries"
    | "spr_fiado_charges"
    | "spr_fiado_payments"
    | "stock_movements";
}

export interface DailySummary {
  pdv_total: number;
  spr_total: number;
  fiado_total: number;
  received_total: number;
  open_total: number;
  income_total: number;
  expense_total: number;
  cancellations_count: number;
  cancellations_total: number;
  reversals_count: number;
  discounts_total: number;
  manual_count: number;
  sales_count: number;
  active_users: number;
}

export interface DailyAuditData {
  rows: MovementRow[];
  summary: DailySummary;
}

async function fetchDailyAudit(date: string): Promise<DailyAuditData> {
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59.999`;

  const [salesRes, saleItemsRes, entriesRes, chargesRes, paymentsRes, stockRes, profilesRes, volunteersRes] =
    await Promise.all([
      supabase.from("sales").select("*").eq("business_date", date),
      supabase.from("sale_items").select("*, products(name)"),
      supabase.from("cash_entries").select("*").eq("business_date", date),
      supabase.from("spr_fiado_charges").select("*, spr_volunteers(full_name)").eq("business_date", date),
      supabase
        .from("spr_fiado_payments")
        .select("*, spr_volunteers(full_name)")
        .eq("payment_date", date),
      supabase
        .from("stock_movements")
        .select("*, products(name)")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("spr_volunteers").select("id, full_name"),
    ]);

  const sales = salesRes.data ?? [];
  const allItems = saleItemsRes.data ?? [];
  const entries = entriesRes.data ?? [];
  const charges = chargesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const stocks = stockRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  const nameById = new Map(profiles.map((p: any) => [p.id, p.full_name]));
  const saleIds = new Set(sales.map((s: any) => s.id));
  const itemsBySale = new Map<string, any[]>();
  allItems
    .filter((i: any) => saleIds.has(i.sale_id))
    .forEach((i: any) => {
      const arr = itemsBySale.get(i.sale_id) ?? [];
      arr.push(i);
      itemsBySale.set(i.sale_id, arr);
    });

  const rows: MovementRow[] = [];

  // Sales (PDV / cancelamento)
  for (const s of sales) {
    const items = itemsBySale.get(s.id) ?? [];
    const itemNames = items
      .map((it: any) => `${it.quantity}x ${it.manual_item_name ?? it.products?.name ?? "Item"}`)
      .join(", ");
    const isCancelled = s.is_deleted;
    rows.push({
      key: `sale-${s.id}`,
      occurred_at: s.created_at,
      origin: isCancelled ? "Cancelamento" : "PDV",
      type: isCancelled ? "cancelamento" : "venda",
      ref_id: s.id,
      ref_label: `#${s.sale_number}`,
      description: itemNames || "Venda",
      payment_method: s.payment_method,
      amount: Number(s.total_amount),
      status: isCancelled ? "cancelada" : s.status,
      user_id: s.created_by,
      user_name: nameById.get(s.created_by) ?? null,
      notes: s.notes,
      raw: { ...s, items },
      source_table: "sales",
    });
  }

  // Cash entries (entradas/saídas/ajustes/recebimento de fiado)
  for (const e of entries) {
    const isFiadoPayment = e.source_type === "spr_fiado_payment";
    const isManual = !e.source_type;
    const isDeleted = e.is_deleted;
    let origin: MovementOrigin = isManual ? "Ajuste Manual" : "Pagamento";
    if (isFiadoPayment) origin = "Pagamento";
    if (isDeleted) origin = "Estorno";
    rows.push({
      key: `entry-${e.id}`,
      occurred_at: e.created_at,
      origin,
      type: isDeleted
        ? "estorno"
        : isFiadoPayment
          ? "recebimento"
          : e.entry_type === "income"
            ? "entrada"
            : "saida",
      ref_id: e.id,
      ref_label: e.category,
      description: e.description ?? e.category,
      payment_method: e.payment_method,
      amount: Number(e.amount),
      status: isDeleted ? "excluído" : "ativo",
      user_id: e.created_by,
      user_name: nameById.get(e.created_by) ?? null,
      notes: e.notes,
      raw: e,
      source_table: "cash_entries",
    });
  }

  // Fiado charges
  for (const c of charges) {
    rows.push({
      key: `charge-${c.id}`,
      occurred_at: c.created_at,
      origin: "Fiado",
      type: "fiado",
      ref_id: c.id,
      ref_label: c.description ?? "Fiado",
      client: c.spr_volunteers?.full_name ?? null,
      description: c.description,
      amount: Number(c.amount),
      status: c.status,
      user_id: c.created_by,
      user_name: nameById.get(c.created_by) ?? null,
      notes: c.notes,
      raw: c,
      source_table: "spr_fiado_charges",
    });
  }

  // Fiado payments
  for (const p of payments) {
    rows.push({
      key: `payment-${p.id}`,
      occurred_at: p.created_at,
      origin: "SPR",
      type: "recebimento",
      ref_id: p.id,
      ref_label: "Pagamento SPR",
      client: p.spr_volunteers?.full_name ?? null,
      description: "Pagamento de fiado",
      payment_method: p.payment_method,
      amount: Number(p.amount_paid),
      status: p.is_deleted ? "excluído" : "ativo",
      user_id: p.created_by,
      user_name: nameById.get(p.created_by) ?? null,
      notes: p.notes,
      raw: p,
      source_table: "spr_fiado_payments",
    });
  }

  // Stock movements
  for (const m of stocks) {
    rows.push({
      key: `stock-${m.id}`,
      occurred_at: m.created_at,
      origin: "Estoque",
      type: "estoque",
      ref_id: m.id,
      ref_label: m.movement_type,
      description: `${m.products?.name ?? "Produto"} (${m.previous_stock} → ${m.new_stock})`,
      amount: Number(m.quantity),
      status: m.movement_type,
      user_id: m.created_by,
      user_name: nameById.get(m.created_by) ?? null,
      notes: m.notes,
      raw: m,
      source_table: "stock_movements",
    });
  }

  rows.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));

  // Summary
  const pdv_total = sales
    .filter((s: any) => !s.is_deleted)
    .reduce((acc: number, s: any) => acc + Number(s.total_amount), 0);
  const discounts_total = sales
    .filter((s: any) => !s.is_deleted)
    .reduce((acc: number, s: any) => acc + Number(s.discount_amount || 0), 0);
  const cancellations = sales.filter((s: any) => s.is_deleted);
  const cancellations_total = cancellations.reduce((a: number, s: any) => a + Number(s.total_amount), 0);

  const fiado_total = charges.reduce((a: number, c: any) => a + Number(c.amount), 0);
  const spr_total =
    payments.reduce((a: number, p: any) => a + Number(p.amount_paid), 0) + fiado_total;
  const received_total =
    pdv_total + payments.reduce((a: number, p: any) => a + Number(p.amount_paid), 0);
  const open_total = charges
    .filter((c: any) => c.status === "open" || c.status === "partial")
    .reduce((a: number, c: any) => a + Number(c.amount), 0);
  const income_total = entries
    .filter((e: any) => !e.is_deleted && e.entry_type === "income")
    .reduce((a: number, e: any) => a + Number(e.amount), 0);
  const expense_total = entries
    .filter((e: any) => !e.is_deleted && e.entry_type === "expense")
    .reduce((a: number, e: any) => a + Number(e.amount), 0);
  const reversals = entries.filter((e: any) => e.is_deleted);
  const manual_count = entries.filter((e: any) => !e.source_type && !e.is_deleted).length;

  const active_users = new Set([
    ...sales.map((s: any) => s.created_by),
    ...entries.map((e: any) => e.created_by),
    ...charges.map((c: any) => c.created_by),
    ...payments.map((p: any) => p.created_by),
    ...stocks.map((m: any) => m.created_by),
  ]).size;

  return {
    rows,
    summary: {
      pdv_total,
      spr_total,
      fiado_total,
      received_total,
      open_total,
      income_total,
      expense_total,
      cancellations_count: cancellations.length,
      cancellations_total,
      reversals_count: reversals.length,
      discounts_total,
      manual_count,
      sales_count: sales.filter((s: any) => !s.is_deleted).length,
      active_users,
    },
  };
}

export function useDailyAudit(date: string) {
  return useQuery({
    queryKey: ["daily-audit", date],
    queryFn: () => fetchDailyAudit(date),
    staleTime: 60_000,
  });
}
