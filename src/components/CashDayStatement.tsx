import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, FileText, ChevronDown, ChevronUp, ArrowRightLeft, User, Clock, Calendar, Wallet, Receipt, CreditCard, BookOpen, ShoppingBag, Banknote, Info } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { escapeHtml, getCompanyDocumentData, getCompanyFooterLines, getCompanyHeaderLines, getCompanyLegalLine } from '@/lib/company-documents';
import { printHtmlDocument } from '@/lib/print-window';
import { printReceipt as printReceiptRawBT } from '@/utils/printer';
import { computePhysicalCash, computeFinancialMovement } from '@/lib/cash-accounting';

interface Transfer {
  id: string;
  from_user_id: string;
  to_user_id: string;
  accepted_at: string | null;
  requested_at: string;
  snapshot_sales_total: number | null;
  snapshot_income_total: number | null;
  snapshot_expense_total: number | null;
  snapshot_cash_total: number | null;
  snapshot_pix_total: number | null;
  snapshot_debit_total: number | null;
  snapshot_credit_total: number | null;
  snapshot_bank_transfer_total: number | null;
  snapshot_sale_count: number | null;
  snapshot_movement_count: number | null;
}

interface SaleRow {
  total_amount: number;
  payment_method: string;
  created_at: string;
  sale_number: number;
  notes: string | null;
}

interface EntryRow {
  id: string;
  entry_type: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  document_type: string | null;
  document_reference: string | null;
  notes: string | null;
  created_at: string;
  source_type: string | null;
}

interface Props {
  closingId: string;
  businessDate: string;
  openingBalance: number;
  closingCreatedAt: string;
  closingStatus: string;
  closedAt: string | null;
  openedByName: string;
  currentResponsibleName: string;
  transferCount: number;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  recibo: 'Recibo',
  nota_fiscal: 'Nota Fiscal',
  id_transferencia: 'ID Transferência',
  sem_documento: 'Sem Documento',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map(pm => [pm.value, pm.label])
);

function PaymentMethodGrid({ totals, title }: { totals: Record<string, number>; title?: string }) {
  const hasValues = Object.values(totals).some(v => v > 0);
  if (!hasValues) return null;
  const total = Object.values(totals).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-1.5">
      {title && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {PAYMENT_METHODS.map(pm => {
          const val = totals[pm.value] || 0;
          if (val === 0) return null;
          return (
            <div key={pm.value} className="flex justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
              <span className="text-muted-foreground">{pm.label}</span>
              <span className="font-medium">{formatCurrency(val)}</span>
            </div>
          );
        })}
        <div className="col-span-2 flex justify-between rounded-md bg-primary/10 px-2.5 py-1.5 font-semibold text-primary">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function CashDayStatement({
  closingId,
  businessDate,
  openingBalance,
  closingCreatedAt,
  closingStatus,
  closedAt,
  openedByName,
  currentResponsibleName,
  transferCount,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const printRef = useRef<HTMLDivElement>(null);
  const { company } = useCompany();

  useEffect(() => {
    if (expanded && sales.length === 0) fetchStatementData();
  }, [expanded]);

  const fetchStatementData = async () => {
    setLoading(true);

    const [salesRes, entriesRes, transfersRes] = await Promise.all([
      supabase
        .from('sales')
        .select('total_amount, payment_method, created_at, sale_number, notes')
        .eq('business_date', businessDate)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true }),
      supabase
        .from('cash_entries')
        .select('id, entry_type, category, description, amount, payment_method, document_type, document_reference, notes, created_at, source_type')
        .eq('business_date', businessDate)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true }),
      supabase
        .from('cash_session_transfers')
        .select('*')
        .eq('cash_closing_id', closingId)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: true }),
    ]);

    setSales((salesRes.data || []) as SaleRow[]);
    setEntries((entriesRes.data || []) as EntryRow[]);
    const xfers = (transfersRes.data || []) as Transfer[];
    setTransfers(xfers);

    // Fetch names
    const ids = new Set<string>();
    xfers.forEach(t => { ids.add(t.from_user_id); ids.add(t.to_user_id); });
    if (ids.size > 0) {
      const { data: profiles } = await supabase.rpc('get_user_names', { _user_ids: Array.from(ids) });
      setNameMap(Object.fromEntries((profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])));
    }

    setLoading(false);
  };

  // Compute totals
  const salesByMethod: Record<string, number> = {};
  const bazarByMethod: Record<string, number> = {};
  const bibliotecaByMethod: Record<string, number> = {};
  const sprByMethod: Record<string, number> = {};

  sales.forEach(s => {
    salesByMethod[s.payment_method] = (salesByMethod[s.payment_method] || 0) + Number(s.total_amount);
  });

  // Categorize entries
  const mensalidadeEntries: EntryRow[] = [];
  const doacaoEntries: EntryRow[] = [];
  const movementEntries: EntryRow[] = [];
  const sprEntries: EntryRow[] = [];
  let totalIncome = 0;
  let totalExpense = 0;

  entries.forEach(e => {
    const amt = Number(e.amount);
    if (e.entry_type === 'income') totalIncome += amt;
    else totalExpense += amt;

    const catLower = (e.category || '').toLowerCase();

    if (e.source_type === 'spr_fiado_payment') {
      sprEntries.push(e);
      if (e.payment_method) sprByMethod[e.payment_method] = (sprByMethod[e.payment_method] || 0) + amt;
    } else if (catLower.includes('mensalidade')) {
      mensalidadeEntries.push(e);
    } else if (catLower.includes('doacao') || catLower.includes('doação')) {
      doacaoEntries.push(e);
    } else {
      movementEntries.push(e);
    }
  });

  // Bazar/Biblioteca from sales notes or category logic
  // Since sales don't have categories, we check sale notes for "bazar" / "biblioteca"
  // A more robust approach: check sale_items -> products -> category
  // For now, categorize based on notes containing keywords
  sales.forEach(s => {
    const notesLower = (s.notes || '').toLowerCase();
    if (notesLower.includes('bazar')) {
      bazarByMethod[s.payment_method] = (bazarByMethod[s.payment_method] || 0) + Number(s.total_amount);
    } else if (notesLower.includes('biblioteca')) {
      bibliotecaByMethod[s.payment_method] = (bibliotecaByMethod[s.payment_method] || 0) + Number(s.total_amount);
    }
  });

  const totalSales = Object.values(salesByMethod).reduce((s, v) => s + v, 0);

  // Cálculo contábil correto: saldo esperado considera APENAS dinheiro físico.
  const physical = computePhysicalCash({
    openingBalance,
    sales: sales as any,
    entries: entries as any,
  });
  const expectedBalance = physical.expectedCash;
  const financialMov = computeFinancialMovement({
    sales: sales as any,
    entries: entries as any,
  });
  const companyData = getCompanyDocumentData(company);
  const companyLegalLine = getCompanyLegalLine(companyData);
  const companyHeaderLines = getCompanyHeaderLines(companyData);
  const companyFooterLines = getCompanyFooterLines(companyData);

  const handlePrint = async () => {
    const companyHeader = getCompanyHeaderLines(companyData);
    const companyFooter = getCompanyFooterLines(companyData);
    const HR = '================================';
    const hr = () => `<div class="hr">${HR}</div>`;
    const title = (t: string) => `<p class="block-title">${escapeHtml(t)}</p>`;
    const subtitle = (t: string) => `<p class="sub-title">» ${escapeHtml(t)}</p>`;
    const row = (l: string, v: string, opts: { bold?: boolean; strong?: boolean } = {}) => {
      const cls = opts.strong ? 'row strong' : opts.bold ? 'row bold' : 'row';
      return `<div class="${cls}"><span>${escapeHtml(l)}</span><span>${escapeHtml(v)}</span></div>`;
    };
    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const pmLabel = (m: string | null | undefined) => (m ? PAYMENT_METHOD_LABELS[m] || m : '—');

    // --- Cálculos consolidados (espelham a UI) ---
    const classify = (e: EntryRow): string => {
      const cat = (e.category || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      if (cat.includes('biblioteca') || desc.includes('biblioteca')) return 'Biblioteca';
      if (cat.includes('bazar') || desc.includes('bazar')) return 'Bazar';
      return 'Outras';
    };
    const signed = (e: EntryRow) => (e.entry_type === 'income' ? Number(e.amount) : -Number(e.amount));

    const movGroups: Record<string, EntryRow[]> = {};
    movementEntries.forEach(e => { (movGroups[classify(e)] = movGroups[classify(e)] || []).push(e); });
    const movOrder = ['Biblioteca', 'Bazar', 'Outras'].filter(k => movGroups[k]?.length);
    const movGrand = movementEntries.reduce((s, e) => s + signed(e), 0);
    const mensalidadesTotal = mensalidadeEntries.reduce((s, e) => s + Number(e.amount), 0);
    const doacoesTotal = doacaoEntries.reduce((s, e) => s + Number(e.amount), 0);

    // Entradas/Saídas consolidadas do dia
    const inByMethod: Record<string, number> = {};
    const outByMethod: Record<string, number> = {};
    const addIn = (m: string | null | undefined, v: number) => { if (!v) return; const k = m || 'dinheiro'; inByMethod[k] = (inByMethod[k] || 0) + v; };
    const addOut = (m: string | null | undefined, v: number) => { if (!v) return; const k = m || 'dinheiro'; outByMethod[k] = (outByMethod[k] || 0) + v; };
    Object.entries(salesByMethod).forEach(([k, v]) => addIn(k, v));
    Object.entries(sprByMethod).forEach(([k, v]) => addIn(k, v));
    mensalidadeEntries.forEach(e => addIn(e.payment_method, Number(e.amount)));
    doacaoEntries.forEach(e => addIn(e.payment_method, Number(e.amount)));
    movementEntries.forEach(e => {
      if (e.entry_type === 'income') addIn(e.payment_method, Number(e.amount));
      else addOut(e.payment_method, Number(e.amount));
    });
    const totalIn = Object.values(inByMethod).reduce((s, v) => s + v, 0);
    const totalOut = Object.values(outByMethod).reduce((s, v) => s + v, 0);
    const cashIn = inByMethod['dinheiro'] || 0;
    const cashOut = outByMethod['dinheiro'] || 0;

    // --- Blocos HTML ---
    const pdvBlock = (Object.keys(salesByMethod).length === 0)
      ? `<p class="empty">Sem vendas no PDV.</p>`
      : PAYMENT_METHODS.map(pm => {
          const v = salesByMethod[pm.value] || 0;
          return v > 0 ? row(pm.label + ':', formatCurrency(v)) : '';
        }).join('') + row('Total PDV:', formatCurrency(totalSales), { strong: true });

    const blocoMetodo = (titulo: string, totals: Record<string, number>) => {
      const items = PAYMENT_METHODS.map(pm => {
        const v = totals[pm.value] || 0;
        return v > 0 ? row(pm.label + ':', formatCurrency(v)) : '';
      }).join('');
      if (!items) return '';
      const tot = Object.values(totals).reduce((s, v) => s + v, 0);
      return title(titulo) + items + row(`Total ${titulo}:`, formatCurrency(tot), { bold: true }) + hr();
    };

    const mensalidadesBlock = mensalidadeEntries.length === 0 ? '' :
      title('MENSALIDADES') +
      mensalidadeEntries.map(e => row(
        `${fmtTime(e.created_at)} ${e.description || e.category}`.slice(0, 40),
        formatCurrency(e.amount) + ' · ' + pmLabel(e.payment_method),
      )).join('') +
      row('Total Mensalidades:', formatCurrency(mensalidadesTotal), { strong: true }) +
      row('Quantidade:', String(mensalidadeEntries.length)) + hr();

    const doacoesBlock = doacaoEntries.length === 0 ? '' :
      title('DOAÇÕES') +
      doacaoEntries.map(e => row(
        `${fmtTime(e.created_at)} ${e.description || e.category}`.slice(0, 40),
        formatCurrency(e.amount) + ' · ' + pmLabel(e.payment_method),
      )).join('') +
      row('Total Doações:', formatCurrency(doacoesTotal), { strong: true }) + hr();

    const movBlock = movementEntries.length === 0 ? '' :
      title('MOVIMENTAÇÕES') +
      movOrder.map(g => {
        const rows = movGroups[g];
        const sub = rows.reduce((s, e) => s + signed(e), 0);
        return subtitle(g) +
          rows.map(e => row(
            `${fmtTime(e.created_at)} ${e.entry_type === 'income' ? '[+]' : '[-]'} ${e.description || e.category}`.slice(0, 40),
            formatCurrency(e.amount) + ' · ' + pmLabel(e.payment_method),
          )).join('') +
          row(`Total ${g}:`, formatCurrency(sub), { bold: true });
      }).join('') +
      row('Total Geral Movimentações:', formatCurrency(movGrand), { strong: true }) + hr();

    const sprBlock = sprEntries.length === 0 ? '' :
      title('PAGAMENTOS SPR') +
      sprEntries.map(e => row(
        `${fmtTime(e.created_at)} ${e.description || 'SPR'}`.slice(0, 40),
        formatCurrency(e.amount) + ' · ' + pmLabel(e.payment_method),
      )).join('') +
      row('Total SPR:', formatCurrency(Object.values(sprByMethod).reduce((s, v) => s + v, 0)), { strong: true }) + hr();

    const consolidadoBlock = (totalIn === 0 && totalOut === 0) ? '' :
      title('CONSOLIDADO DO DIA') +
      `<p class="sub-title">Entradas por forma de pagamento</p>` +
      PAYMENT_METHODS.map(pm => {
        const v = inByMethod[pm.value] || 0;
        return v > 0 ? row(pm.label + ':', formatCurrency(v)) : '';
      }).join('') +
      row('Total de entradas:', formatCurrency(totalIn), { bold: true }) +
      (totalOut > 0 ? (
        `<p class="sub-title">Saídas por forma de pagamento</p>` +
        PAYMENT_METHODS.map(pm => {
          const v = outByMethod[pm.value] || 0;
          return v > 0 ? row(pm.label + ':', '-' + formatCurrency(v)) : '';
        }).join('') +
        row('Total de saídas:', '-' + formatCurrency(totalOut), { bold: true })
      ) : '') +
      row('Movimento líquido do dia:', formatCurrency(totalIn - totalOut), { strong: true }) + hr();

    const reconciliacaoBlock =
      title('RECONCILIAÇÃO DINHEIRO FÍSICO') +
      row('Saldo inicial:', formatCurrency(openingBalance)) +
      row('+ Entradas dinheiro:', formatCurrency(cashIn)) +
      row('- Saídas dinheiro:', '-' + formatCurrency(cashOut)) +
      row('SALDO ESPERADO:', formatCurrency(expectedBalance), { strong: true }) +
      `<p class="note">PIX, debito, credito e transferencia NAO compoem o dinheiro fisico do caixa.</p>` + hr();

    await printHtmlDocument({
      title: `Extrato do Caixa - ${formatDate(businessDate)}`,
      bodyHtml: `
        <div class="header">
          <p class="company">${escapeHtml(companyData.name.toUpperCase())}</p>
          <p class="doc">EXTRATO DE CONFERÊNCIA DO CAIXA</p>
          ${companyHeader.map(l => `<p class="meta">${escapeHtml(l)}</p>`).join('')}
          <p class="meta">Data: ${escapeHtml(formatDate(businessDate))}</p>
          <p class="meta">Aberto por: ${escapeHtml(openedByName)}</p>
          <p class="meta">Responsável atual: ${escapeHtml(currentResponsibleName)}</p>
          <p class="meta">Abertura: ${escapeHtml(formatDateTime(closingCreatedAt))}</p>
          ${closedAt ? `<p class="meta">Fechamento: ${escapeHtml(formatDateTime(closedAt))}</p>` : ''}
          <p class="meta">Status: ${closingStatus === 'closed' ? 'FECHADO' : 'ABERTO'}</p>
          ${transferCount > 0 ? `<p class="meta">Transferências: ${transferCount}</p>` : ''}
        </div>
        ${hr()}
        ${title('PDV — FORMAS DE PAGAMENTO')}
        ${pdvBlock}
        ${hr()}
        ${blocoMetodo('BAZAR', bazarByMethod)}
        ${blocoMetodo('BIBLIOTECA', bibliotecaByMethod)}
        ${sprBlock}
        ${mensalidadesBlock}
        ${doacoesBlock}
        ${movBlock}
        ${consolidadoBlock}
        ${reconciliacaoBlock}
        <div class="sign">
          <p>Operador: ______________________</p>
          <p>Conferente: ____________________</p>
          <p>Data/hora: ___/___/______  ___:___</p>
        </div>
        ${companyFooter.length > 0 ? `<div class="footer">${companyFooter.map(l => `<p>${escapeHtml(l)}</p>`).join('')}<p>Extrato gerado em ${escapeHtml(formatDateTime(new Date().toISOString()))}</p></div>` : ''}
      `,
      styles: `
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000 !important; background: transparent !important; box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #fff !important; }
        body { margin: 0; padding: 4mm; font-family: 'Courier New', 'Consolas', monospace; font-size: 13px; font-weight: 700; line-height: 1.4; color: #000; }
        .header { text-align: center; margin-bottom: 6px; }
        .company { font-size: 17px; font-weight: 900; margin: 0 0 3px; letter-spacing: 0.5px; }
        .doc { font-size: 15px; font-weight: 900; margin: 2px 0; }
        .meta { font-size: 12px; font-weight: 700; margin: 1px 0; }
        .hr { font-weight: 900; text-align: center; margin: 6px 0; font-size: 13px; overflow: hidden; white-space: nowrap; }
        .block-title { font-weight: 900; font-size: 14px; text-transform: uppercase; margin: 6px 0 4px; border-bottom: 2px solid #000; padding-bottom: 2px; }
        .sub-title { font-weight: 900; font-size: 13px; margin: 4px 0 2px; text-transform: uppercase; }
        .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 700; padding: 2px 0; }
        .row.bold { font-weight: 900; }
        .row.strong { font-weight: 900; font-size: 14px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin: 4px 0; }
        .empty { font-size: 12px; font-style: italic; margin: 2px 0; }
        .note { font-size: 11px; font-style: italic; margin: 4px 0 0; }
        .sign { margin-top: 10px; font-size: 12px; font-weight: 700; }
        .sign p { margin: 4px 0; }
        .footer { text-align: center; font-size: 11px; font-weight: 700; margin-top: 8px; border-top: 1px dashed #000; padding-top: 4px; }
        .footer p { margin: 1px 0; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { padding: 3mm; }
        }
      `,
      windowFeatures: 'width=420,height=700',
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle
          className="flex items-center justify-between text-sm cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Extrato de Conferência do Caixa
          </div>
          <div className="flex items-center gap-2">
            {expanded && (
              <>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={e => { e.stopPropagation(); handlePrint(); }}>
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Imprimir
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={e => {
                  e.stopPropagation();
                  const lines: string[] = [
                    companyData.name.toUpperCase(),
                    'EXTRATO DE CONFERENCIA',
                    `Data: ${formatDate(businessDate)}`,
                    '-----------------------------',
                    `Saldo Inicial: ${formatCurrency(openingBalance)}`,
                    `Vendas: ${formatCurrency(totalSales)}`,
                    `Entradas: ${formatCurrency(totalIncome)}`,
                    `Saidas: ${formatCurrency(totalExpense)}`,
                    '-----------------------------',
                    `Saldo Esperado: ${formatCurrency(expectedBalance)}`,
                    '-----------------------------',
                    ...companyFooterLines,
                  ];
                  printReceiptRawBT(lines);
                }}>
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  RawBT
                </Button>
              </>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Printable content */}
              <div ref={printRef}>
                {/* Header */}
                <div className="print-header border-b border-border pb-3">
                  {companyData.logoUrl && (
                    <img
                      src={companyData.logoUrl}
                      alt={`Logo da empresa ${companyData.name}`}
                      className="mx-auto mb-2 max-h-16 max-w-[160px] object-contain"
                      crossOrigin="anonymous"
                    />
                  )}
                  <h2 style={{ textAlign: 'center', fontSize: '14px', fontWeight: 700 }}>{companyData.name}</h2>
                  {companyLegalLine && <p className="subtitle" style={{ textAlign: 'center', fontSize: '10px', color: '#666', marginBottom: '2px' }}>{companyLegalLine}</p>}
                  {companyHeaderLines.map((line) => (
                    <p key={line} className="subtitle" style={{ textAlign: 'center', fontSize: '10px', color: '#666', marginBottom: '2px' }}>
                      {line}
                    </p>
                  ))}
                  <p className="subtitle" style={{ textAlign: 'center', fontSize: '10px', color: '#666', marginTop: '6px' }}>Extrato de Conferência do Caixa</p>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Data</span><span className="font-semibold">{formatDate(businessDate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Aberto por</span><span className="font-medium">{openedByName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Responsável atual</span><span className="font-medium">{currentResponsibleName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Abertura</span><span>{formatDateTime(closingCreatedAt)}</span></div>
                  {closedAt && <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Fechamento</span><span>{formatDateTime(closedAt)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={closingStatus === 'closed' ? 'secondary' : 'default'} className="text-[10px]">{closingStatus === 'closed' ? 'Fechado' : 'Aberto'}</Badge></div>
                  {transferCount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1"><ArrowRightLeft className="h-3 w-3" /> Transferências</span>
                      <Badge variant="outline" className="text-[10px]">{transferCount}</Badge>
                    </div>
                  )}
                </div>

                {/* Totals by payment method */}
                <div className="mt-4">
                  <PaymentMethodGrid totals={salesByMethod} title="Total Consolidado por Forma de Pagamento" />
                </div>

                {/* Resumo geral */}
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1 text-xs">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Resumo Geral</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo inicial</span><span className="font-medium">{formatCurrency(openingBalance)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Vendas</span><span className="font-medium text-primary">{formatCurrency(totalSales)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entradas</span><span className="font-medium text-emerald-600">{formatCurrency(totalIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saídas</span><span className="font-medium text-destructive">{formatCurrency(totalExpense)}</span></div>
                  <div className="flex justify-between border-t pt-1.5 mt-1"><span className="font-bold">Saldo esperado</span><span className="font-bold text-primary">{formatCurrency(expectedBalance)}</span></div>
                </div>

                {/* Bazar */}
                {Object.values(bazarByMethod).some(v => v > 0) && (
                  <div className="mt-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                      <PaymentMethodGrid totals={bazarByMethod} title="Bazar" />
                    </div>
                  </div>
                )}

                {/* Biblioteca */}
                {Object.values(bibliotecaByMethod).some(v => v > 0) && (
                  <div className="mt-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <PaymentMethodGrid totals={bibliotecaByMethod} title="Biblioteca" />
                    </div>
                  </div>
                )}

                {/* SPR Payments */}
                {Object.values(sprByMethod).some(v => v > 0) && (
                  <div className="mt-4">
                    <PaymentMethodGrid totals={sprByMethod} title="Pagamentos SPR" />
                  </div>
                )}

                {/* Mensalidade entries */}
                {mensalidadeEntries.length > 0 && (() => {
                  const mensalidadesTotal = mensalidadeEntries.reduce((s, e) => s + Number(e.amount), 0);
                  return (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensalidades</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-muted/50"><th className="px-2 py-1.5 text-left">Hora</th><th className="px-2 py-1.5 text-left">Descrição</th><th className="px-2 py-1.5 text-right">Valor</th><th className="px-2 py-1.5 text-left">Pgto</th><th className="px-2 py-1.5 text-left">Doc</th></tr></thead>
                        <tbody>
                          {mensalidadeEntries.map(e => (
                            <tr key={e.id} className="border-t border-border/50">
                              <td className="px-2 py-1">{new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-2 py-1">{e.description || e.category}</td>
                              <td className="px-2 py-1 text-right font-medium">{formatCurrency(e.amount)}</td>
                              <td className="px-2 py-1">{e.payment_method ? PAYMENT_METHOD_LABELS[e.payment_method] || e.payment_method : '—'}</td>
                              <td className="px-2 py-1">{e.document_type ? DOCUMENT_TYPE_LABELS[e.document_type] || e.document_type : '—'}{e.document_reference ? ` #${e.document_reference}` : ''}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-border bg-muted/40">
                            <td colSpan={2} className="px-2 py-1.5 text-right font-bold uppercase">Total Mensalidades</td>
                            <td className="px-2 py-1.5 text-right font-bold text-primary">{formatCurrency(mensalidadesTotal)}</td>
                            <td colSpan={2} className="px-2 py-1.5 text-left text-[10px] text-muted-foreground">{mensalidadeEntries.length} lançamento(s)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );
                })()}

                {/* Doação entries */}
                {doacaoEntries.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Doações</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-muted/50"><th className="px-2 py-1.5 text-left">Hora</th><th className="px-2 py-1.5 text-left">Descrição</th><th className="px-2 py-1.5 text-right">Valor</th><th className="px-2 py-1.5 text-left">Pgto</th><th className="px-2 py-1.5 text-left">Doc</th></tr></thead>
                        <tbody>
                          {doacaoEntries.map(e => (
                            <tr key={e.id} className="border-t border-border/50">
                              <td className="px-2 py-1">{new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-2 py-1">{e.description || e.category}</td>
                              <td className="px-2 py-1 text-right font-medium">{formatCurrency(e.amount)}</td>
                              <td className="px-2 py-1">{e.payment_method ? PAYMENT_METHOD_LABELS[e.payment_method] || e.payment_method : '—'}</td>
                              <td className="px-2 py-1">{e.document_type ? DOCUMENT_TYPE_LABELS[e.document_type] || e.document_type : '—'}{e.document_reference ? ` #${e.document_reference}` : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* All Movements — agrupado por categoria (Biblioteca, Bazar, Outras) */}
                {movementEntries.length > 0 && (() => {
                  const classify = (e: EntryRow): string => {
                    const cat = (e.category || '').toLowerCase();
                    const desc = (e.description || '').toLowerCase();
                    if (cat.includes('biblioteca') || desc.includes('biblioteca')) return 'Biblioteca';
                    if (cat.includes('bazar') || desc.includes('bazar')) return 'Bazar';
                    return 'Outras';
                  };
                  const groups: Record<string, EntryRow[]> = {};
                  movementEntries.forEach(e => {
                    const g = classify(e);
                    (groups[g] = groups[g] || []).push(e);
                  });
                  const order = ['Biblioteca', 'Bazar', 'Outras'].filter(k => groups[k]?.length);
                  const signed = (e: EntryRow) => (e.entry_type === 'income' ? Number(e.amount) : -Number(e.amount));
                  const grandTotal = movementEntries.reduce((s, e) => s + signed(e), 0);

                  return (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Movimentações</p>
                      {order.map(groupName => {
                        const rows = groups[groupName];
                        const subTotal = rows.reduce((s, e) => s + signed(e), 0);
                        return (
                          <div key={groupName} className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">» {groupName}</p>
                            <div className="rounded-lg border overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead><tr className="bg-muted/50"><th className="px-2 py-1.5 text-left">Hora</th><th className="px-2 py-1.5 text-left">Tipo</th><th className="px-2 py-1.5 text-left">Categoria</th><th className="px-2 py-1.5 text-right">Valor</th><th className="px-2 py-1.5 text-left">Pgto</th><th className="px-2 py-1.5 text-left">Doc</th></tr></thead>
                                <tbody>
                                  {rows.map(e => (
                                    <tr key={e.id} className="border-t border-border/50">
                                      <td className="px-2 py-1">{new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                      <td className="px-2 py-1">
                                        <Badge variant={e.entry_type === 'income' ? 'default' : 'destructive'} className="text-[9px] px-1 py-0">
                                          {e.entry_type === 'income' ? 'Entrada' : 'Saída'}
                                        </Badge>
                                      </td>
                                      <td className="px-2 py-1">{e.description || e.category}</td>
                                      <td className="px-2 py-1 text-right font-medium">{formatCurrency(e.amount)}</td>
                                      <td className="px-2 py-1">{e.payment_method ? PAYMENT_METHOD_LABELS[e.payment_method] || e.payment_method : '—'}</td>
                                      <td className="px-2 py-1">{e.document_type ? DOCUMENT_TYPE_LABELS[e.document_type] || e.document_type : '—'}{e.document_reference ? ` #${e.document_reference}` : ''}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t-2 border-border bg-muted/40">
                                    <td colSpan={3} className="px-2 py-1.5 text-right font-bold uppercase">Total {groupName}</td>
                                    <td className="px-2 py-1.5 text-right font-bold text-primary">{formatCurrency(subTotal)}</td>
                                    <td colSpan={2} className="px-2 py-1.5 text-left text-[10px] text-muted-foreground">{rows.length} lançamento(s)</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                      <div className="rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-2 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider">Total Geral Movimentações</span>
                        <span className="text-sm font-bold text-primary">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                  );
                })()}


                {/* SPR detail entries */}
                {sprEntries.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhamento Pagamentos SPR</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-muted/50"><th className="px-2 py-1.5 text-left">Hora</th><th className="px-2 py-1.5 text-left">Descrição</th><th className="px-2 py-1.5 text-right">Valor</th><th className="px-2 py-1.5 text-left">Pgto</th><th className="px-2 py-1.5 text-left">Doc</th></tr></thead>
                        <tbody>
                          {sprEntries.map(e => (
                            <tr key={e.id} className="border-t border-border/50">
                              <td className="px-2 py-1">{new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-2 py-1">{e.description || 'Pagamento SPR'}</td>
                              <td className="px-2 py-1 text-right font-medium">{formatCurrency(e.amount)}</td>
                              <td className="px-2 py-1">{e.payment_method ? PAYMENT_METHOD_LABELS[e.payment_method] || e.payment_method : '—'}</td>
                              <td className="px-2 py-1">{e.document_type ? DOCUMENT_TYPE_LABELS[e.document_type] || e.document_type : '—'}{e.document_reference ? ` #${e.document_reference}` : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Transfer period breakdown */}
                {transfers.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Resumo por Período de Responsabilidade
                    </p>

                    {(() => {
                      const periods: Array<{
                        name: string;
                        start: string;
                        end: string | null;
                        salesByMethod: Record<string, number>;
                        totalSales: number;
                        totalIncome: number;
                        totalExpense: number;
                        saleCount: number;
                        movementCount: number;
                      }> = [];

                      let cumSales = 0, cumIncome = 0, cumExpense = 0;
                      let cumCash = 0, cumPix = 0, cumDebit = 0, cumCredit = 0, cumBank = 0;
                      let cumSaleCount = 0, cumMovCount = 0;

                      for (let i = 0; i < transfers.length; i++) {
                        const t = transfers[i];
                        const prevS = cumSales, prevI = cumIncome, prevE = cumExpense;
                        const prevCash = cumCash, prevPix = cumPix, prevDebit = cumDebit, prevCredit = cumCredit, prevBank = cumBank;
                        const prevSC = cumSaleCount, prevMC = cumMovCount;

                        cumSales = Number(t.snapshot_sales_total || 0);
                        cumIncome = Number(t.snapshot_income_total || 0);
                        cumExpense = Number(t.snapshot_expense_total || 0);
                        cumCash = Number(t.snapshot_cash_total || 0);
                        cumPix = Number(t.snapshot_pix_total || 0);
                        cumDebit = Number(t.snapshot_debit_total || 0);
                        cumCredit = Number(t.snapshot_credit_total || 0);
                        cumBank = Number(t.snapshot_bank_transfer_total || 0);
                        cumSaleCount = Number(t.snapshot_sale_count || 0);
                        cumMovCount = Number(t.snapshot_movement_count || 0);

                        const pm: Record<string, number> = {};
                        if (cumCash - prevCash > 0) pm.dinheiro = cumCash - prevCash;
                        if (cumPix - prevPix > 0) pm.pix = cumPix - prevPix;
                        if (cumDebit - prevDebit > 0) pm.debito = cumDebit - prevDebit;
                        if (cumCredit - prevCredit > 0) pm.credito = cumCredit - prevCredit;
                        if (cumBank - prevBank > 0) pm.transferencia = cumBank - prevBank;

                        periods.push({
                          name: nameMap[t.from_user_id] || 'Operador',
                          start: i === 0 ? closingCreatedAt : transfers[i - 1].accepted_at || transfers[i - 1].requested_at,
                          end: t.accepted_at || t.requested_at,
                          salesByMethod: pm,
                          totalSales: cumSales - prevS,
                          totalIncome: cumIncome - prevI,
                          totalExpense: cumExpense - prevE,
                          saleCount: cumSaleCount - prevSC,
                          movementCount: cumMovCount - prevMC,
                        });
                      }

                      // Current period
                      const lastT = transfers[transfers.length - 1];
                      const curPm: Record<string, number> = {};
                      const curCash = (salesByMethod.dinheiro || 0) - cumCash;
                      const curPix = (salesByMethod.pix || 0) - cumPix;
                      const curDebit = (salesByMethod.debito || 0) - cumDebit;
                      const curCredit = (salesByMethod.credito || 0) - cumCredit;
                      const curBank = (salesByMethod.transferencia || 0) - cumBank;
                      if (curCash > 0) curPm.dinheiro = curCash;
                      if (curPix > 0) curPm.pix = curPix;
                      if (curDebit > 0) curPm.debito = curDebit;
                      if (curCredit > 0) curPm.credito = curCredit;
                      if (curBank > 0) curPm.transferencia = curBank;

                      periods.push({
                        name: nameMap[lastT.to_user_id] || 'Operador atual',
                        start: lastT.accepted_at || lastT.requested_at,
                        end: null,
                        salesByMethod: curPm,
                        totalSales: totalSales - cumSales,
                        totalIncome: totalIncome - cumIncome,
                        totalExpense: totalExpense - cumExpense,
                        saleCount: 0,
                        movementCount: 0,
                      });

                      return periods.map((p, idx) => {
                        const isCurrent = idx === periods.length - 1;
                        return (
                          <div key={idx} className={`rounded-lg border p-3 space-y-2 text-xs ${isCurrent ? 'border-primary/30 bg-primary/5' : ''}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold flex items-center gap-1"><User className="h-3 w-3" /> {p.name}</span>
                              <Badge variant={isCurrent ? 'default' : 'secondary'} className="text-[10px]">{isCurrent ? 'Atual' : `Período ${idx + 1}`}</Badge>
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(p.start)} → {p.end ? formatDateTime(p.end) : 'agora'}
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className="rounded bg-muted/50 p-1.5 text-center"><p className="text-muted-foreground text-[10px]">Vendas</p><p className="font-medium">{formatCurrency(p.totalSales)}</p></div>
                              <div className="rounded bg-muted/50 p-1.5 text-center"><p className="text-muted-foreground text-[10px]">Entradas</p><p className="font-medium text-emerald-600">{formatCurrency(p.totalIncome)}</p></div>
                              <div className="rounded bg-muted/50 p-1.5 text-center"><p className="text-muted-foreground text-[10px]">Saídas</p><p className="font-medium text-destructive">{formatCurrency(p.totalExpense)}</p></div>
                            </div>
                            <PaymentMethodGrid totals={p.salesByMethod} />
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Consolidado geral do dia por forma de pagamento (ENTRADAS líquidas) */}
                {(() => {
                  // ENTRADAS por método (sem duplicar: Bazar/Biblioteca JÁ estão em salesByMethod)
                  const inByMethod: Record<string, number> = {};
                  // SAÍDAS por método (sangrias, despesas, retiradas)
                  const outByMethod: Record<string, number> = {};

                  const addIn = (method: string | null | undefined, val: number) => {
                    if (!val) return;
                    const k = method || 'dinheiro';
                    inByMethod[k] = (inByMethod[k] || 0) + val;
                  };
                  const addOut = (method: string | null | undefined, val: number) => {
                    if (!val) return;
                    const k = method || 'dinheiro';
                    outByMethod[k] = (outByMethod[k] || 0) + val;
                  };

                  // Vendas PDV (já inclui Bazar e Biblioteca — não somar de novo)
                  Object.entries(salesByMethod).forEach(([k, v]) => addIn(k, v));
                  // Pagamentos SPR
                  Object.entries(sprByMethod).forEach(([k, v]) => addIn(k, v));
                  // Mensalidades (income)
                  mensalidadeEntries.forEach(e => addIn(e.payment_method, Number(e.amount)));
                  // Doações (income)
                  doacaoEntries.forEach(e => addIn(e.payment_method, Number(e.amount)));
                  // Movimentações: separar income vs expense
                  movementEntries.forEach(e => {
                    if (e.entry_type === 'income') addIn(e.payment_method, Number(e.amount));
                    else addOut(e.payment_method, Number(e.amount));
                  });

                  const totalIn = Object.values(inByMethod).reduce((s, v) => s + v, 0);
                  const totalOut = Object.values(outByMethod).reduce((s, v) => s + v, 0);
                  const netDay = totalIn - totalOut;
                  const cashIn = inByMethod['dinheiro'] || 0;
                  const cashOut = outByMethod['dinheiro'] || 0;
                  const expectedCashCheck = Number(openingBalance) + cashIn - cashOut;

                  if (totalIn === 0 && totalOut === 0) return null;

                  return (
                    <div className="mt-4 space-y-2">
                      <PaymentMethodGrid totals={inByMethod} title="Entradas do Dia por Forma de Pagamento" />
                      {totalOut > 0 && (
                        <PaymentMethodGrid totals={outByMethod} title="Saídas do Dia por Forma de Pagamento" />
                      )}
                      <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Total de entradas</span><span className="font-semibold text-emerald-600">{formatCurrency(totalIn)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total de saídas</span><span className="font-semibold text-destructive">−{formatCurrency(totalOut)}</span></div>
                        <div className="flex justify-between border-t pt-1.5 mt-1"><span className="font-bold">Movimento líquido do dia</span><span className="font-bold">{formatCurrency(netDay)}</span></div>
                      </div>
                      <div className="rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-2 space-y-1 text-xs">
                        <p className="font-bold uppercase tracking-wider text-primary text-[11px] flex items-center gap-1"><Info className="h-3 w-3" /> Reconciliação do Dinheiro Físico</p>
                        <div className="flex justify-between"><span className="text-muted-foreground">Saldo inicial</span><span>{formatCurrency(openingBalance)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">+ Entradas em dinheiro</span><span className="text-emerald-700">{formatCurrency(cashIn)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">− Saídas em dinheiro</span><span className="text-destructive">−{formatCurrency(cashOut)}</span></div>
                        <div className="flex justify-between border-t border-primary/30 pt-1.5 mt-1"><span className="font-bold">Saldo esperado em dinheiro</span><span className="font-bold text-primary">{formatCurrency(expectedCashCheck)}</span></div>
                        <p className="text-[10px] text-muted-foreground pt-1 italic">PIX, débito, crédito e transferência aparecem nas entradas acima mas NÃO compõem o dinheiro físico do caixa.</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Print footer */}
                <div className="mt-4 text-center text-[10px] text-muted-foreground border-t pt-2">
                  {companyFooterLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <p>{companyData.name} — Extrato gerado em {formatDateTime(new Date().toISOString())}</p>
                </div>
              </div>

              {/* Print button at bottom */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1 min-w-[140px] h-10" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Extrato
                </Button>
                <Button variant="outline" className="flex-1 min-w-[140px] h-10" onClick={handlePrint}>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 min-w-[140px] h-10"
                  onClick={() => {
                    const lines: string[] = [
                      companyData.name.toUpperCase(),
                      'EXTRATO DE CONFERENCIA',
                      `Data: ${formatDate(businessDate)}`,
                      '-----------------------------',
                      `Saldo Inicial: ${formatCurrency(openingBalance)}`,
                      `Vendas: ${formatCurrency(totalSales)}`,
                      `Entradas: ${formatCurrency(totalIncome)}`,
                      `Saidas: ${formatCurrency(totalExpense)}`,
                      '-----------------------------',
                      `Saldo Esperado: ${formatCurrency(expectedBalance)}`,
                      '-----------------------------',
                      ...companyFooterLines,
                    ];
                    printReceiptRawBT(lines);
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  RawBT
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
