import type { MovementRow, DailyAuditData } from "@/hooks/useDailyAudit";

export type PersonStatus =
  | "Adquiriu e pagou"
  | "Somente adquiriu"
  | "Somente pagou"
  | "Sem pendência no dia"
  | "Atenção: pagamento menor que lançamentos";

export interface PersonSummary {
  person_id: string;
  person_name: string;
  origins: ("SPR" | "Fiado")[];
  acquired_total: number;
  paid_total: number;
  net_balance: number;
  charges_count: number;
  payments_count: number;
  charges: MovementRow[];
  payments: MovementRow[];
  status: PersonStatus;
}

function getRowPersonId(row: MovementRow): string | null {
  if (row.source_table === "spr_fiado_charges") {
    return row.raw?.volunteer_id ?? null;
  }
  if (row.source_table === "spr_fiado_payments") {
    const first = row.raw?.payments?.[0];
    return first?.volunteer_id ?? null;
  }
  return null;
}

function getRowPersonName(row: MovementRow): string {
  if (row.source_table === "spr_fiado_charges") {
    return row.raw?.spr_volunteers?.full_name ?? row.client ?? "—";
  }
  if (row.source_table === "spr_fiado_payments") {
    const first = row.raw?.payments?.[0];
    return first?.spr_volunteers?.full_name ?? row.client ?? "—";
  }
  return row.client ?? "—";
}

export function buildPersonSummaries(data: DailyAuditData): PersonSummary[] {
  const map = new Map<string, PersonSummary>();

  for (const row of data.rows) {
    if (
      row.source_table !== "spr_fiado_charges" &&
      row.source_table !== "spr_fiado_payments"
    ) {
      continue;
    }
    const personId = getRowPersonId(row);
    if (!personId) continue;

    const existing =
      map.get(personId) ??
      ({
        person_id: personId,
        person_name: getRowPersonName(row),
        origins: [],
        acquired_total: 0,
        paid_total: 0,
        net_balance: 0,
        charges_count: 0,
        payments_count: 0,
        charges: [],
        payments: [],
        status: "Sem pendência no dia",
      } as PersonSummary);

    if (row.source_table === "spr_fiado_charges") {
      existing.acquired_total += row.amount;
      existing.charges_count += 1;
      existing.charges.push(row);
      if (!existing.origins.includes("Fiado")) existing.origins.push("Fiado");
    } else {
      existing.paid_total += row.amount;
      existing.payments_count += row.items_count ?? 1;
      existing.payments.push(row);
      if (!existing.origins.includes("SPR")) existing.origins.push("SPR");
    }

    map.set(personId, existing);
  }

  const list = Array.from(map.values()).map((p) => {
    p.net_balance = p.acquired_total - p.paid_total;
    if (p.charges_count > 0 && p.payments_count > 0) {
      p.status =
        p.paid_total < p.acquired_total
          ? "Atenção: pagamento menor que lançamentos"
          : "Adquiriu e pagou";
    } else if (p.charges_count > 0) {
      p.status = "Somente adquiriu";
    } else if (p.payments_count > 0) {
      p.status = "Somente pagou";
    } else {
      p.status = "Sem pendência no dia";
    }
    return p;
  });

  // Sort by total movement value desc
  list.sort(
    (a, b) =>
      b.acquired_total + b.paid_total - (a.acquired_total + a.paid_total),
  );

  return list;
}
