import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import type { MovementRow } from "@/hooks/useDailyAudit";

const ORIGINS = [
  "PDV",
  "SPR",
  "Fiado",
  "Pagamento",
  "Estoque",
  "Ajuste Manual",
  "Cancelamento",
  "Estorno",
] as const;

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  rows: MovementRow[];
  onSelect: (row: MovementRow) => void;
  onFiltered?: (rows: MovementRow[]) => void;
}

export function DailyMovementsTable({ rows, onSelect, onFiltered }: Props) {
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [user, setUser] = useState<string>("all");
  const [payment, setPayment] = useState<string>("all");
  const [onlyManual, setOnlyManual] = useState(false);
  const [onlyCancelled, setOnlyCancelled] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => r.user_id && map.set(r.user_id, r.user_name ?? r.user_id));
    return Array.from(map.entries());
  }, [rows]);

  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))), [rows]);
  const payments = useMemo(
    () => Array.from(new Set(rows.map((r) => r.payment_method).filter(Boolean) as string[])),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (origin !== "all" && r.origin !== origin) return false;
      if (type !== "all" && r.type !== type) return false;
      if (user !== "all" && r.user_id !== user) return false;
      if (payment !== "all" && r.payment_method !== payment) return false;
      if (onlyManual && r.origin !== "Ajuste Manual") return false;
      if (onlyCancelled && r.origin !== "Cancelamento" && r.origin !== "Estorno") return false;
      if (q) {
        const hay = [
          r.origin,
          r.type,
          r.ref_label,
          r.description,
          r.client,
          r.user_name,
          r.payment_method,
          r.status,
          r.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    onFiltered?.(out);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, origin, type, user, payment, onlyManual, onlyCancelled]);

  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Input
          placeholder="Buscar…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="lg:col-span-2"
        />
        <Select value={origin} onValueChange={(v) => { setOrigin(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={user} onValueChange={(v) => { setUser(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {userOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payment} onValueChange={(v) => { setPayment(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Forma pgto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas formas</SelectItem>
            {payments.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={onlyManual ? "default" : "secondary"}
          onClick={() => { setOnlyManual((v) => !v); setPage(0); }}
        >
          Somente manuais
        </Button>
        <Button
          size="sm"
          variant={onlyCancelled ? "default" : "secondary"}
          onClick={() => { setOnlyCancelled((v) => !v); setPage(0); }}
        >
          Cancelamentos/Estornos
        </Button>
        <div className="ml-auto text-xs text-[var(--color-text-muted)] self-center">
          {filtered.length} movimento(s)
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/hora</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ref.</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Pgto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-[var(--color-text-muted)] py-8">
                  Nenhum movimento.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => (
              <TableRow key={r.key} className="cursor-pointer" onClick={() => onSelect(r)}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(r.occurred_at), "HH:mm:ss")}
                </TableCell>
                <TableCell><Badge variant="outline">{r.origin}</Badge></TableCell>
                <TableCell className="capitalize">{r.type}</TableCell>
                <TableCell className="font-mono text-xs">{r.ref_label}</TableCell>
                <TableCell>{r.client ?? "—"}</TableCell>
                <TableCell className="max-w-[260px] truncate">{r.description ?? "—"}</TableCell>
                <TableCell>{r.payment_method ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">{fmtBRL(r.amount)}</TableCell>
                <TableCell className="capitalize">{r.status}</TableCell>
                <TableCell>{r.user_name ?? "—"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelect(r); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Página {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
