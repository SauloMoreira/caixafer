import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import type { MovementRow } from "@/hooks/useDailyAudit";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ORIGIN_LINK: Record<string, string> = {
  PDV: "/pdv",
  SPR: "/spr",
  Fiado: "/spr",
  Pagamento: "/movimentos",
  "Ajuste Manual": "/movimentos",
  Estoque: "/estoque",
  Cancelamento: "/pdv",
  Estorno: "/movimentos",
};

interface Props {
  row: MovementRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovementDetailSheet({ row, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhe do movimento</SheetTitle>
        </SheetHeader>
        {row && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{row.origin}</Badge>
              <Badge variant="outline" className="capitalize">{row.type}</Badge>
              <Badge variant="outline" className="capitalize">{row.status}</Badge>
            </div>

            <Field label="Data/hora" value={format(new Date(row.occurred_at), "dd/MM/yyyy HH:mm:ss")} />
            <Field label="Referência" value={row.ref_label ?? row.ref_id} />
            <Field label="Cliente" value={row.client ?? "—"} />
            <Field label="Descrição" value={row.description ?? "—"} />
            <Field label="Forma de pagamento" value={row.payment_method ?? "—"} />
            <Field label="Valor" value={fmtBRL(row.amount)} />
            <Field label="Usuário responsável" value={row.user_name ?? "—"} />
            {row.notes && <Field label="Observações" value={row.notes} />}

            {row.source_table === "sales" && Array.isArray(row.raw.items) && row.raw.items.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                  Itens
                </div>
                <ul className="space-y-1">
                  {row.raw.items.map((it: any) => (
                    <li key={it.id} className="flex justify-between">
                      <span>
                        {it.quantity}× {it.manual_item_name ?? it.products?.name ?? "Item"}
                      </span>
                      <span className="font-medium">{fmtBRL(Number(it.line_total))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Dados brutos
              </div>
              <pre className="text-[11px] bg-[var(--color-surface-alt)] p-3 rounded overflow-x-auto">
                {JSON.stringify(row.raw, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button asChild size="sm" variant="outline">
                <Link to={ORIGIN_LINK[row.origin] ?? "/"}>Abrir tela original</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
