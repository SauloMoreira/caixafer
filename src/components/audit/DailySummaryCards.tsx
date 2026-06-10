import { Card, CardContent } from "@/components/ui/card";
import type { DailySummary } from "@/hooks/useDailyAudit";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  summary: DailySummary;
}

export function DailySummaryCards({ summary }: Props) {
  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "PDV", value: fmt(summary.pdv_total), hint: `${summary.sales_count} vendas` },
    { label: "SPR (mov.)", value: fmt(summary.spr_total) },
    { label: "Fiado lançado", value: fmt(summary.fiado_total) },
    { label: "Recebido", value: fmt(summary.received_total) },
    { label: "Em aberto", value: fmt(summary.open_total) },
    { label: "Entradas", value: fmt(summary.income_total) },
    { label: "Saídas", value: fmt(summary.expense_total) },
    {
      label: "Cancelamentos",
      value: fmt(summary.cancellations_total),
      hint: `${summary.cancellations_count} venda(s)`,
    },
    { label: "Estornos", value: String(summary.reversals_count) },
    { label: "Descontos", value: fmt(summary.discounts_total) },
    { label: "Mov. manuais", value: String(summary.manual_count) },
    { label: "Usuários ativos", value: String(summary.active_users) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {c.label}
            </div>
            <div className="text-base font-semibold mt-1 text-[var(--color-text-primary)]">
              {c.value}
            </div>
            {c.hint && (
              <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{c.hint}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
