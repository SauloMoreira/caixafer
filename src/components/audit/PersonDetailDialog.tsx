import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { PersonSummary } from "@/lib/person-audit-summary";
import type { MovementRow } from "@/hooks/useDailyAudit";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  person: PersonSummary | null;
  date: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function PersonDetailDialog({ person, date, open, onOpenChange }: Props) {
  if (!person) return null;
  const timeline = [...person.charges, ...person.payments].sort((a, b) =>
    a.occurred_at < b.occurred_at ? -1 : 1,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {person.person_name}
            {person.origins.map((o) => (
              <Badge key={o} variant="outline" className="text-[10px]">
                {o}
              </Badge>
            ))}
          </DialogTitle>
          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
            ID: {person.person_id} · Data:{" "}
            {format(new Date(date + "T12:00:00"), "dd/MM/yyyy")}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
          <Stat label="Adquirido" value={fmt(person.acquired_total)} />
          <Stat label="Pago" value={fmt(person.paid_total)} />
          <Stat
            label="Saldo líquido"
            value={fmt(person.net_balance)}
            tone={
              person.net_balance > 0
                ? "warn"
                : person.net_balance < 0
                  ? "info"
                  : "ok"
            }
          />
          <Stat label="Lançamentos" value={String(person.charges_count)} />
          <Stat label="Pagamentos" value={String(person.payments_count)} />
        </div>

        <Tabs defaultValue="adquiridos" className="mt-4">
          <TabsList>
            <TabsTrigger value="adquiridos">
              Adquiridos ({person.charges.length})
            </TabsTrigger>
            <TabsTrigger value="pagamentos">
              Pagamentos ({person.payments.length})
            </TabsTrigger>
            <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          </TabsList>

          <TabsContent value="adquiridos" className="space-y-2">
            {person.charges.length === 0 && (
              <Empty text="Sem lançamentos adquiridos no dia." />
            )}
            {person.charges.map((r) => (
              <ChargeRow key={r.key} row={r} />
            ))}
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-2">
            {person.payments.length === 0 && (
              <Empty text="Sem pagamentos realizados no dia." />
            )}
            {person.payments.map((r) => (
              <PaymentRow key={r.key} row={r} />
            ))}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-2">
            {timeline.length === 0 && <Empty text="Sem movimentos no dia." />}
            {timeline.map((r) => (
              <div
                key={r.key}
                className="flex items-start gap-3 border-l-2 pl-3 py-1"
                style={{
                  borderColor:
                    r.source_table === "spr_fiado_charges"
                      ? "rgb(245 158 11)"
                      : "rgb(14 165 233)",
                }}
              >
                <div className="text-[11px] text-[var(--color-text-muted)] font-mono w-20 shrink-0">
                  {format(new Date(r.occurred_at), "HH:mm:ss")}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {r.origin}
                </Badge>
                <div className="flex-1 text-sm truncate">
                  {r.description ?? r.ref_label ?? "—"}
                </div>
                <div className="text-sm font-semibold">{fmt(r.amount)}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
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
    <div className="rounded border border-[var(--color-border)] p-2">
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">
      {text}
    </div>
  );
}

function ChargeRow({ row }: { row: MovementRow }) {
  return (
    <div className="rounded border border-[var(--color-border)] p-3 text-sm">
      <div className="flex justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium">{row.description ?? "Fiado"}</div>
          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
            ID: {String(row.ref_id).slice(0, 8)} ·{" "}
            {format(new Date(row.occurred_at), "HH:mm:ss")} ·{" "}
            {row.user_name ?? "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{fmt(row.amount)}</div>
          <Badge variant="outline" className="text-[10px] capitalize mt-1">
            {row.status}
          </Badge>
        </div>
      </div>
      {row.notes && (
        <div className="text-[11px] mt-1 text-[var(--color-text-muted)]">
          {row.notes}
        </div>
      )}
    </div>
  );
}

function PaymentRow({ row }: { row: MovementRow }) {
  return (
    <div className="rounded border border-[var(--color-border)] p-3 text-sm">
      <div className="flex justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium">
            Pagamento {row.payment_method ? `· ${row.payment_method}` : ""}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
            ID: {String(row.ref_id).slice(0, 8)} ·{" "}
            {format(new Date(row.occurred_at), "HH:mm:ss")} ·{" "}
            {row.user_name ?? "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{fmt(row.amount)}</div>
          <Badge variant="outline" className="text-[10px] mt-1">
            {row.items_count ?? 1} item(ns)
          </Badge>
        </div>
      </div>
      {row.group_items && row.group_items.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pt-2">
          {row.group_items.map((p: any) => (
            <li
              key={p.id}
              className="flex justify-between text-[11px] text-[var(--color-text-secondary)]"
            >
              <span className="truncate">
                {p.spr_fiado_charges?.description ?? "Lançamento"}
              </span>
              <span className="font-medium">{fmt(Number(p.amount_paid))}</span>
            </li>
          ))}
        </ul>
      )}
      {row.notes && (
        <div className="text-[11px] mt-1 text-[var(--color-text-muted)]">
          {row.notes}
        </div>
      )}
    </div>
  );
}
