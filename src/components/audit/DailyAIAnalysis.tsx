import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DailyAuditData } from "@/hooks/useDailyAudit";
import type { PersonSummary } from "@/lib/person-audit-summary";

interface AIAnalysis {
  resumo: string;
  pontos_de_atencao: string[];
  divergencias: string[];
  sugestoes: string[];
}

interface Props {
  date: string;
  data: DailyAuditData;
  people?: PersonSummary[];
}

export function DailyAIAnalysis({ date, data, people = [] }: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      // Consolidated SPR/Fiado payment stats
      const sprRows = data.rows.filter((r) => r.source_table === "spr_fiado_payments");
      const totalPaidConsolidated = sprRows.reduce((s, r) => s + r.amount, 0);
      const totalItemsSettled = sprRows.reduce((s, r) => s + (r.items_count ?? 1), 0);
      const multiItemPayments = sprRows.filter((r) => (r.items_count ?? 1) > 1).length;
      const missingGroupId = sprRows.filter(
        (r) => !r.raw?.payment_group_id || r.raw.payment_group_id === r.raw?.payments?.[0]?.id,
      ).length;

      // Trim payload for token safety
      const payload = {
        date,
        summary: data.summary,
        consolidated_payments: {
          total_payments: sprRows.length,
          total_amount: totalPaidConsolidated,
          total_items_settled: totalItemsSettled,
          multi_item_payments: multiItemPayments,
          payments_without_group_id: missingGroupId,
        },
        per_person: people.map((p) => ({
          id: p.person_id,
          name: p.person_name,
          origins: p.origins,
          acquired_total: p.acquired_total,
          paid_total: p.paid_total,
          net_balance: p.net_balance,
          charges_count: p.charges_count,
          payments_count: p.payments_count,
          status: p.status,
        })),
        movements_sample: data.rows.slice(0, 200).map((r) => ({
          time: r.occurred_at,
          origin: r.origin,
          type: r.type,
          amount: r.amount,
          status: r.status,
          payment_method: r.payment_method,
          client: r.client,
          user: r.user_name,
          desc: r.description,
          items_count: r.items_count ?? null,
        })),
      };
      const { data: res, error: invokeErr } = await supabase.functions.invoke(
        "daily-audit-analysis",
        { body: payload },
      );
      if (invokeErr) throw invokeErr;
      if ((res as any)?.error) throw new Error((res as any).error);
      setAnalysis(res as AIAnalysis);
    } catch (e: any) {
      const msg = e?.message ?? "Erro ao gerar análise";
      setError(msg);
      toast({ title: "Falha na análise da IA", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            Análise da IA para Auditoria do Dia
          </CardTitle>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            A IA apenas analisa os dados — não altera nenhuma informação.
          </p>
        </div>
        <Button onClick={generate} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analysis ? "Reanalisar" : "Gerar análise"}
        </Button>
      </CardHeader>
      <CardContent>
        {!analysis && !loading && !error && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Clique em "Gerar análise" para que a IA revise os movimentos do dia e aponte pontos de atenção.
          </p>
        )}
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        {analysis && (
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Resumo</h4>
              <p className="text-[var(--color-text-secondary)]">{analysis.resumo}</p>
            </div>
            {analysis.pontos_de_atencao?.length > 0 && (
              <Block
                icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                title="Pontos de atenção"
                items={analysis.pontos_de_atencao}
              />
            )}
            {analysis.divergencias?.length > 0 && (
              <Block
                icon={<AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                title="Divergências"
                items={analysis.divergencias}
              />
            )}
            {analysis.sugestoes?.length > 0 && (
              <Block
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                title="Sugestões de conferência"
                items={analysis.sugestoes}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Block({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-semibold flex items-center gap-1.5 mb-1">
        {icon}
        {title}
      </h4>
      <ul className="list-disc pl-5 space-y-1 text-[var(--color-text-secondary)]">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
