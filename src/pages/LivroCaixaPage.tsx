import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Printer, ChevronLeft, ChevronRight, RefreshCw, BookOpen, Calendar, Search, Lock } from 'lucide-react';
import { formatCurrency, formatDate, PAYMENT_METHODS, todayISO } from '@/lib/constants';
import {
  buildCashBookPage,
  assignPageNumbers,
  type CashBookPage,
} from '@/lib/cash-book';
import { computePhysicalCash } from '@/lib/cash-accounting';
import {
  escapeHtml,
  getCompanyDocumentData,
  getCompanyFooterLines,
  getCompanyHeaderLines,
} from '@/lib/company-documents';
import { printHtmlDocument } from '@/lib/print-window';

interface ClosingRow {
  business_date: string;
  opening_balance: number | string | null;
}

const PM_LABEL = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]));

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function LivroCaixaPage() {
  const { company } = useCompany();
  const { isAdmin } = useAuth();
  const companyData = getCompanyDocumentData(company);
  const companyHeader = getCompanyHeaderLines(companyData);
  const companyFooter = getCompanyFooterLines(companyData);

  const [date, setDate] = useState<string>(todayISO());
  const [pageQuery, setPageQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [page, setPage] = useState<CashBookPage | null>(null);
  const [saldoAnterior, setSaldoAnterior] = useState(0);

  const pageNumbers = useMemo(() => assignPageNumbers(closings), [closings]);
  const pageNumber = pageNumbers[date] || null;

  // Load all closings once for page numbering and navigation
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cash_closings')
        .select('business_date, opening_balance')
        .order('business_date', { ascending: true });
      setClosings((data || []) as ClosingRow[]);
    })();
  }, []);

  const loadPage = async (d: string) => {
    setLoading(true);
    try {
      // Saldo anterior: pega o último dia ANTES de d que teve movimento e calcula
      // seu saldo esperado em dinheiro físico.
      const earlier = closings
        .map((c) => c.business_date)
        .filter((bd) => bd < d)
        .sort();
      const prevDate = earlier[earlier.length - 1] || null;

      let prevBalance = 0;
      if (prevDate) {
        const prevClosing = closings.find((c) => c.business_date === prevDate);
        const opening = Number(prevClosing?.opening_balance || 0);
        const [prevSales, prevEntries] = await Promise.all([
          supabase
            .from('sales')
            .select('total_amount, payment_method, is_deleted, status')
            .eq('business_date', prevDate),
          supabase
            .from('cash_entries')
            .select('entry_type, amount, payment_method, is_deleted, category, source_type')
            .eq('business_date', prevDate),
        ]);
        const physical = computePhysicalCash({
          openingBalance: opening,
          sales: (prevSales.data || []) as any,
          entries: (prevEntries.data || []) as any,
        });
        prevBalance = physical.expectedCash;
      }
      setSaldoAnterior(prevBalance);

      // Movimentos do dia consultado
      const [salesRes, entriesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('id, total_amount, payment_method, notes, is_deleted, status, created_at')
          .eq('business_date', d)
          .order('created_at', { ascending: true }),
        supabase
          .from('cash_entries')
          .select(
            'id, entry_type, category, description, amount, payment_method, document_type, document_reference, source_type, is_deleted, created_at',
          )
          .eq('business_date', d)
          .order('created_at', { ascending: true }),
      ]);

      const built = buildCashBookPage({
        date: d,
        sales: (salesRes.data || []) as any,
        entries: (entriesRes.data || []) as any,
        saldoAnterior: prevBalance,
      });
      setPage(built);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (closings.length === 0 && date) {
      // mesmo sem closings carregados ainda, tenta carregar para já mostrar algo
      loadPage(date);
      return;
    }
    loadPage(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, closings.length]);

  const goPrev = () => {
    const datesWithMov = Object.keys(pageNumbers).sort();
    const prev = datesWithMov.filter((d) => d < date).pop();
    if (prev) setDate(prev);
    else setDate(shiftDate(date, -1));
  };
  const goNext = () => {
    const datesWithMov = Object.keys(pageNumbers).sort();
    const next = datesWithMov.find((d) => d > date);
    if (next) setDate(next);
    else setDate(shiftDate(date, 1));
  };
  const goToday = () => setDate(todayISO());

  const handleSearchByPage = () => {
    const q = pageQuery.trim().padStart(5, '0');
    const found = Object.entries(pageNumbers).find(([, n]) => n === q);
    if (found) setDate(found[0]);
  };

  // ------------- Print (A4 paisagem, B&W) -------------
  const handlePrint = async () => {
    if (!page) return;

    const rowsHtml = !page.hasMovement
      ? `<tr><td colspan="7" class="empty">NÃO HOUVE MOVIMENTO NESTA DATA</td></tr>`
      : page.rows
          .map(
            (r) => `
        <tr>
          <td class="c">${escapeHtml(r.docNumber)}</td>
          <td>${escapeHtml(r.origem)}</td>
          <td>${escapeHtml(r.historico)}</td>
          <td class="r">${r.entrada > 0 ? escapeHtml(formatCurrency(r.entrada)) : '—'}</td>
          <td class="r">${r.saida > 0 ? escapeHtml(formatCurrency(r.saida)) : '—'}</td>
          <td>${escapeHtml(r.documentType || '—')}</td>
          <td>${escapeHtml(r.documentReference || '—')}</td>
        </tr>`,
          )
          .join('');

    const methodRows = PAYMENT_METHODS.map((pm) => {
      const v = page.byMethod[pm.value];
      if (!v || (v.entradas === 0 && v.saidas === 0)) return '';
      return `<tr><td>${escapeHtml(pm.label)}</td><td class="r">${escapeHtml(formatCurrency(v.entradas))}</td><td class="r">${escapeHtml(formatCurrency(v.saidas))}</td></tr>`;
    }).join('');

    await printHtmlDocument({
      title: `Livro de Caixa — ${formatDate(page.date)}`,
      bodyHtml: `
        <div class="head">
          <h1>LIVRO DE MOVIMENTO DE CAIXA</h1>
          <div class="head-grid">
            <div><b>Empresa:</b> ${escapeHtml(companyData.name)}</div>
            <div><b>Data:</b> ${escapeHtml(formatDate(page.date))}</div>
            <div><b>Nº da página:</b> ${escapeHtml(pageNumber || '—')}</div>
          </div>
          ${companyHeader.length ? `<div class="company-meta">${companyHeader.map((l) => `<span>${escapeHtml(l)}</span>`).join(' · ')}</div>` : ''}
        </div>

        <table class="book">
          <thead>
            <tr>
              <th style="width:50px">DOC Nº</th>
              <th style="width:100px">Origem</th>
              <th>Histórico</th>
              <th style="width:110px" class="r">Entrada</th>
              <th style="width:110px" class="r">Saída</th>
              <th style="width:110px">Tipo Documento</th>
              <th style="width:140px">Referência</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="footer-grid">
          <table class="totals">
            <tbody>
              <tr><td>Total de Entradas</td><td class="r">${escapeHtml(formatCurrency(page.totalEntradas))}</td></tr>
              <tr><td>Total de Saídas</td><td class="r">${escapeHtml(formatCurrency(page.totalSaidas))}</td></tr>
              <tr class="strong"><td>TOTAL DO DIA (Entradas − Saídas)</td><td class="r">${escapeHtml(formatCurrency(page.totalEntradas - page.totalSaidas))}</td></tr>
            </tbody>
          </table>

          <table class="totals">
            <thead><tr><th>Forma de Pagamento</th><th class="r">Entradas</th><th class="r">Saídas</th></tr></thead>
            <tbody>${methodRows || '<tr><td colspan="3" class="empty">—</td></tr>'}</tbody>
          </table>
        </div>

        ${isAdmin ? `
        <div class="admin-block">
          <div class="admin-title">Reconciliação de Dinheiro Físico (Administrativo)</div>
          <table class="totals">
            <tbody>
              <tr><td>Saldo Anterior (dinheiro físico)</td><td class="r">${escapeHtml(formatCurrency(page.saldoAnterior))}</td></tr>
              <tr class="strong"><td>SALDO ATUAL (dinheiro físico)</td><td class="r">${escapeHtml(formatCurrency(page.saldoAtual))}</td></tr>
            </tbody>
          </table>
        </div>` : ''}

        <div class="sign">
          <div>Operador: _______________________</div>
          <div>Conferente: _____________________</div>
          <div>Data/hora: ___/___/______  ___:___</div>
        </div>

        ${companyFooter.length ? `<div class="company-footer">${companyFooter.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>` : ''}
      `,
      styles: `
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000 !important; background: transparent !important; box-sizing: border-box; }
        html, body { background: #fff !important; margin: 0; }
        body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 12px; padding: 8mm; color: #000; }
        h1 { text-align: center; font-size: 18px; letter-spacing: 1px; margin: 0 0 6px; font-weight: 900; }
        .head { border: 2px solid #000; padding: 8px; margin-bottom: 8px; }
        .head-grid { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
        .company-meta { margin-top: 4px; font-size: 11px; text-align: center; }
        table.book { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
        table.book th, table.book td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; vertical-align: top; }
        table.book th { background: #f0f0f0 !important; font-weight: 900; text-align: left; text-transform: uppercase; font-size: 11px; }
        table.book td.r, table.book th.r { text-align: right; }
        table.book td.c { text-align: center; font-weight: 700; }
        table.book td.empty { text-align: center; font-style: italic; padding: 30px; font-size: 14px; font-weight: 700; }
        .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        table.totals { width: 100%; border-collapse: collapse; }
        table.totals th, table.totals td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; }
        table.totals th { background: #f0f0f0 !important; font-weight: 900; text-transform: uppercase; font-size: 11px; }
        table.totals tr.strong td { font-weight: 900; font-size: 13px; border-top: 2px solid #000; }
        table.totals td.r, table.totals th.r { text-align: right; }
        .sign { margin-top: 16px; display: flex; justify-content: space-between; font-size: 12px; gap: 16px; }
        .admin-block { margin-top: 8px; border: 2px solid #000; padding: 6px 8px; }
        .admin-title { font-weight: 900; text-transform: uppercase; font-size: 11px; margin-bottom: 4px; letter-spacing: 0.5px; }
        .company-footer { margin-top: 12px; text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 4px; }
        .company-footer p { margin: 1px 0; }
        @media print { @page { size: A4 landscape; margin: 8mm; } }
      `,
      windowFeatures: 'width=1000,height=700',
    });
  };

  // ------------- UI -------------
  return (
    <div className="max-w-7xl mx-auto space-y-4 p-2">
      {/* Filtros e navegação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-primary" />
            Livro de Movimento de Caixa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date" className="text-xs">Data</Label>
              <div className="flex gap-1">
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="page" className="text-xs">Buscar por nº da página</Label>
              <div className="flex gap-1">
                <Input
                  id="page"
                  placeholder="ex.: 00007"
                  value={pageQuery}
                  onChange={(e) => setPageQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchByPage()}
                />
                <Button variant="outline" size="icon" onClick={handleSearchByPage}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Empresa</Label>
              <Input value={companyData.name} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs invisible">Ações</Label>
              <div className="flex gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={goPrev} title="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToday} title="Ir para hoje">
                  <Calendar className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goNext} title="Próxima página">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadPage(date)} title="Reprocessar">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handlePrint} title="Imprimir">
                  <Printer className="h-4 w-4 mr-1" /> Imprimir
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Livro */}
      <Card className="border-2 border-foreground/20">
        {/* Cabeçalho do livro */}
        <CardHeader className="border-b-2 border-foreground/20 bg-muted/30">
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase">
              Livro de Movimento de Caixa
            </h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm pt-2">
            <div><span className="font-semibold">Empresa:</span> {companyData.name}</div>
            <div className="md:text-center"><span className="font-semibold">Data:</span> {formatDate(date)}</div>
            <div className="md:text-right">
              <span className="font-semibold">Nº da página:</span>{' '}
              {pageNumber ? (
                <Badge variant="outline" className="font-mono text-sm">{pageNumber}</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !page || !page.hasMovement ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-lg font-bold tracking-wide uppercase">
                Não houve movimento nesta data
              </p>
              <p className="text-xs text-muted-foreground">
                A página existe no livro e pode ser consultada / impressa.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/30 bg-muted/40 text-xs uppercase tracking-wider">
                    <th className="px-2 py-2 text-center w-[60px]">DOC Nº</th>
                    <th className="px-2 py-2 text-left w-[110px]">Origem</th>
                    <th className="px-2 py-2 text-left">Histórico</th>
                    <th className="px-2 py-2 text-right w-[110px]">Entrada</th>
                    <th className="px-2 py-2 text-right w-[110px]">Saída</th>
                    <th className="px-2 py-2 text-left w-[110px]">Tipo Doc.</th>
                    <th className="px-2 py-2 text-left w-[120px]">Referência</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((r, i) => (
                    <tr key={i} className="border-b border-foreground/10 hover:bg-muted/30">
                      <td className="px-2 py-1.5 text-center font-mono font-semibold">{r.docNumber}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="secondary" className="text-[10px] font-normal">{r.origem}</Badge>
                      </td>
                      <td className="px-2 py-1.5">{r.historico}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {r.entrada > 0 ? formatCurrency(r.entrada) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {r.saida > 0 ? formatCurrency(r.saida) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-xs">{r.documentType || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-2 py-1.5 text-xs font-mono">{r.documentReference || <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Rodapé contábil */}
        {page && (
          <div className="border-t-2 border-foreground/20 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b border-foreground/10 pb-1">
                <span className="text-muted-foreground">Total de Entradas</span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(page.totalEntradas)}
                </span>
              </div>
              <div className="flex justify-between border-b border-foreground/10 pb-1">
                <span className="text-muted-foreground">Total de Saídas</span>
                <span className="font-mono font-semibold text-destructive">
                  {formatCurrency(page.totalSaidas)}
                </span>
              </div>
              <div className="flex justify-between border-b border-foreground/10 pb-1">
                <span className="text-muted-foreground">Saldo Anterior (dinheiro físico)</span>
                <span className="font-mono">{formatCurrency(page.saldoAnterior)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t-2 border-foreground/30">
                <span className="font-bold uppercase text-sm">Saldo Atual (dinheiro físico)</span>
                <span className="font-mono font-bold text-primary">{formatCurrency(page.saldoAtual)}</span>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Detalhamento por Forma de Pagamento
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-foreground/20">
                    <th className="text-left py-1">Forma</th>
                    <th className="text-right py-1">Entradas</th>
                    <th className="text-right py-1">Saídas</th>
                  </tr>
                </thead>
                <tbody>
                  {PAYMENT_METHODS.map((pm) => {
                    const v = page.byMethod[pm.value];
                    if (!v || (v.entradas === 0 && v.saidas === 0)) return null;
                    return (
                      <tr key={pm.value} className="border-b border-foreground/10">
                        <td className="py-1">{pm.label}</td>
                        <td className="text-right font-mono py-1">{formatCurrency(v.entradas)}</td>
                        <td className="text-right font-mono py-1">{formatCurrency(v.saidas)}</td>
                      </tr>
                    );
                  })}
                  {Object.values(page.byMethod).every((v) => v.entradas === 0 && v.saidas === 0) && (
                    <tr><td colSpan={3} className="py-2 text-center text-muted-foreground italic">—</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground text-center italic">
        Os totais respeitam a lógica contábil validada (saldo esperado em dinheiro físico).
        Esta tela é apenas de consulta e não altera nenhum cálculo do fechamento.
      </p>
    </div>
  );
}
