import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, FileDown, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useDailyAudit, type MovementRow } from "@/hooks/useDailyAudit";
import { DailySummaryCards } from "@/components/audit/DailySummaryCards";
import { DailyAIAnalysis } from "@/components/audit/DailyAIAnalysis";
import { DailyMovementsTable } from "@/components/audit/DailyMovementsTable";
import { MovementDetailSheet } from "@/components/audit/MovementDetailSheet";
import { exportCSV, exportPDF } from "@/lib/audit-export";
import { supabase } from "@/integrations/supabase/client";

export default function AuditoriaDiariaPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const { data, isFetching, refetch } = useDailyAudit(date);
  const [selected, setSelected] = useState<MovementRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filtered, setFiltered] = useState<MovementRow[]>([]);

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  const visibleRows = useMemo(() => (filtered.length ? filtered : rows), [filtered, rows]);

  async function logExport(kind: "pdf" | "csv") {
    try {
      await supabase.rpc("log_security_event", {
        _event_type: "daily_audit_exported",
        _entity_type: "daily_audit",
        _action: kind.toUpperCase(),
        _route: "/auditoria-diaria",
        _notes: `Exportação ${kind} da auditoria de ${date}`,
        _severity: "info",
        _business_date: date,
      });
    } catch {
      /* noop */
    }
  }

  function handleCSV() {
    if (!summary) return;
    exportCSV(date, summary, visibleRows);
    logExport("csv");
  }
  function handlePDF() {
    if (!summary) return;
    exportPDF(date, summary, visibleRows);
    logExport("pdf");
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div>
              <h1 className="text-xl font-semibold">Auditoria Diária / Movimento do Dia</h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                Tudo que aconteceu no sistema na data selecionada.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                  Data
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-[170px]"
                />
              </div>
              <Button onClick={() => refetch()} variant="secondary" size="sm" disabled={isFetching}>
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCSV} variant="secondary" size="sm" disabled={!summary}>
              <FileDown className="h-4 w-4" />
              CSV
            </Button>
            <Button onClick={handlePDF} variant="outline" size="sm" disabled={!summary}>
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && <DailySummaryCards summary={summary} />}

      {data && <DailyAIAnalysis date={date} data={data} />}

      {data && (
        <DailyMovementsTable
          rows={rows}
          onSelect={(r) => {
            setSelected(r);
            setSheetOpen(true);
          }}
          onFiltered={setFiltered}
        />
      )}

      <MovementDetailSheet row={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
