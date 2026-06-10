import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle } from "lucide-react";
import type { PersonSummary } from "@/lib/person-audit-summary";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_VARIANT: Record<PersonSummary["status"], string> = {
  "Adquiriu e pagou": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Somente adquiriu": "bg-amber-100 text-amber-800 border-amber-200",
  "Somente pagou": "bg-sky-100 text-sky-800 border-sky-200",
  "Sem pendência no dia": "bg-muted text-muted-foreground",
  "Atenção: pagamento menor que lançamentos":
    "bg-red-100 text-red-800 border-red-200",
};

interface Props {
  people: PersonSummary[];
  onSelect: (p: PersonSummary) => void;
}

export function PersonSummaryCards({ people, onSelect }: Props) {
  if (people.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-[var(--color-text-muted)] flex items-center gap-2">
          <Users className="h-4 w-4" />
          Nenhuma movimentação de SPR / Fiado por pessoa nesta data.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--color-accent)]" />
        <h2 className="text-sm font-semibold">
          Resumo por Pessoa — SPR / Fiado{" "}
          <span className="text-[var(--color-text-muted)] font-normal">
            ({people.length})
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {people.map((p) => {
          const alert = p.status === "Atenção: pagamento menor que lançamentos";
          return (
            <button
              key={p.person_id}
              type="button"
              onClick={() => onSelect(p)}
              className="text-left"
            >
              <Card className="hover:border-[var(--color-accent)] transition-colors h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm leading-tight truncate">
                      {p.person_name}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {p.origins.map((o) => (
                        <Badge
                          key={o}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {o}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    <Metric label="Adquirido" value={fmt(p.acquired_total)} />
                    <Metric label="Pago" value={fmt(p.paid_total)} />
                    <Metric
                      label="Saldo"
                      value={fmt(p.net_balance)}
                      tone={
                        p.net_balance > 0
                          ? "warn"
                          : p.net_balance < 0
                            ? "info"
                            : "ok"
                      }
                    />
                  </div>

                  <div className="text-[10px] text-[var(--color-text-muted)] flex gap-2">
                    <span>{p.charges_count} lançamento(s)</span>
                    <span>·</span>
                    <span>{p.payments_count} pagamento(s)</span>
                  </div>

                  <div
                    className={`text-[11px] inline-flex items-center gap-1 rounded px-2 py-0.5 border ${STATUS_VARIANT[p.status]}`}
                  >
                    {alert && <AlertTriangle className="h-3 w-3" />}
                    {p.status}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "info";
}) {
  const color =
    tone === "warn"
      ? "text-amber-600"
      : tone === "info"
        ? "text-sky-600"
        : "text-[var(--color-text-primary)]";
  return (
    <div>
      <div className="uppercase tracking-wider text-[9px] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={`font-semibold ${color}`}>{value}</div>
    </div>
  );
}
