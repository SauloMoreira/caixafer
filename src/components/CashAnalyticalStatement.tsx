import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSearch, Printer, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate, PAYMENT_METHODS } from '@/lib/constants';
import {
  computePhysicalCash,
  computeFinancialMovement,
  type SaleRow as AcctSaleRow,
  type CashEntryRow as AcctEntryRow,
} from '@/lib/cash-accounting';
import { useCompany } from '@/hooks/useCompany';
import { getCompanyDocumentData, getCompanyFooterLines, escapeHtml } from '@/lib/company-documents';
import { printHtmlDocument } from '@/lib/print-window';

interface Props {
  businessDate: string;
  openingBalance: number;
  countedBalance: number | null;
  operatorName?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
}

interface SaleRowFull {
  id: string;
  sale_number: number;
  total_amount: number;
  payment_method: string;
  is_deleted: boolean;
  status: string | null;
  created_at: string;
  created_by: string;
  notes: string | null;
  sale_items: Array<{
    id: string;
    quantity: number;
    line_total: number;
    manual_item_name: string | null;
    product_id: string | null;
    products: { name: string; category: string | null } | null;
  }>;
}

interface EntryRowFull {
  id: string;
  entry_type: 'income' | 'expense';
  category: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  is_deleted: boolean;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  created_by: string;
  notes: string | null;
}

interface FiadoPaymentDetail {
  id: string;
  amount_paid: number;
  payment_method: string;
  payment_date: string;
  volunteer_name: string | null;
  items_count: number;
}

const PM_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((p) => [p.value, p.label]),
);
const pmLabel = (v: string | null | undefined) =>
  v ? PM_LABEL[v] || v : 'Dinheiro';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ---------- Operation normalized shape (used for grouping) ----------
interface Operation {
  id: string;
  time: string;
  category: string;
  payment_method: string;
  amount: number;
  signed_amount: number; // negative if it reduces cash (expense)
  type: string; // 'Venda PDV', 'Pagamento SPR', 'Sangria', etc.
  origin: string; // 'PDV', 'SPR', 'Manual', 'Fiado'
  description: string;
  user_name: string;
  status: string;
  ref: string; // ID legível
  cancelled: boolean;
  isCashAffecting: boolean;
  consolidated?: { items_count: number };
}

export default function CashAnalyticalStatement({
  businessDate,
  openingBalance,
  countedBalance,
  operatorName,
  openedAt,
  closedAt,
}: Props) {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<SaleRowFull[]>([]);
  const [entries, setEntries] = useState<EntryRowFull[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [fiadoDetails, setFiadoDetails] = useState<Record<string, FiadoPaymentDetail>>({});

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessDate]);

  const load = async () => {
    setLoading(true);
    const [salesRes, entriesRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, sale_number, total_amount, payment_method, is_deleted, status, created_at, created_by, notes, sale_items(id, quantity, line_total, manual_item_name, product_id, products(name, category))')
        .eq('business_date', businessDate)
        .order('created_at', { ascending: true }),
      supabase
        .from('cash_entries')
        .select('id, entry_type, category, description, amount, payment_method, is_deleted, source_type, source_id, created_at, created_by, notes')
        .eq('business_date', businessDate)
        .order('created_at', { ascending: true }),
    ]);

    const salesData = (salesRes.data || []) as unknown as SaleRowFull[];
    const entriesData = (entriesRes.data || []) as unknown as EntryRowFull[];
    setSales(salesData);
    setEntries(entriesData);

    // Names
    const userIds = new Set<string>();
    salesData.forEach((s) => userIds.add(s.created_by));
    entriesData.forEach((e) => userIds.add(e.created_by));
    if (userIds.size > 0) {
      const { data } = await supabase.rpc('get_user_names', { _user_ids: Array.from(userIds) });
      setNameMap(Object.fromEntries((data || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])));
    }

    // Fiado payment details (consolidated)
    const fiadoIds = entriesData
      .filter((e) => e.source_type === 'spr_fiado_payment' && e.source_id)
      .map((e) => e.source_id!) as string[];
    if (fiadoIds.length > 0) {
      const { data: pays } = await (supabase as any)
        .from('spr_fiado_payments')
        .select('id, amount_paid, payment_method, payment_date, volunteer_id, fiado_charge_id, spr_volunteers(full_name), spr_fiado_charges(spr_fiado_charge_items(id))')
        .in('id', fiadoIds);
      const map: Record<string, FiadoPaymentDetail> = {};
      (pays || []).forEach((p: any) => {
        map[p.id] = {
          id: p.id,
          amount_paid: Number(p.amount_paid),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          volunteer_name: p.spr_volunteers?.full_name || null,
          items_count: p.spr_fiado_charges?.spr_fiado_charge_items?.length || 0,
        };
      });
      setFiadoDetails(map);
    }

    setLoading(false);
  };

  // ---------- Cálculos contábeis (mesma fonte única de verdade) ----------
  const physical = useMemo(
    () => computePhysicalCash({ openingBalance, sales: sales as unknown as AcctSaleRow[], entries: entries as unknown as AcctEntryRow[] }),
    [openingBalance, sales, entries],
  );
  const financial = useMemo(
    () => computeFinancialMovement({ sales: sales as unknown as AcctSaleRow[], entries: entries as unknown as AcctEntryRow[] }),
    [sales, entries],
  );
  const expected = physical.expectedCash;
  const diff = countedBalance != null ? countedBalance - expected : null;
  const statusLine =
    diff == null ? 'STATUS: CAIXA EM ABERTO'
    : Math.abs(diff) < 0.005 ? 'STATUS: CAIXA SEM DIFERENÇA'
    : diff > 0 ? 'STATUS: SOBRA DE CAIXA'
    : 'STATUS: FALTA DE CAIXA';

  // ---------- Normaliza operações ----------
  const operations: Operation[] = useMemo(() => {
    const ops: Operation[] = [];

    // Vendas: cada venda vira UMA operação; categoria derivada do(s) item(s).
    // Se há vários produtos com a mesma categoria, usa essa. Caso contrário "PDV / Misto".
    sales.forEach((s) => {
      const cats = new Set<string>();
      (s.sale_items || []).forEach((it) => {
        const c = it.products?.category || (it.manual_item_name ? 'PDV - Manual' : 'PDV');
        cats.add(c);
      });
      const category = cats.size === 0 ? 'PDV'
        : cats.size === 1 ? Array.from(cats)[0]
        : 'PDV - Misto';
      const cancelled = s.is_deleted || (s.status && /cancel|void/i.test(s.status)) || false;
      const desc = (s.sale_items || [])
        .map((it) => `${it.quantity}x ${it.products?.name || it.manual_item_name || 'item'}`)
        .join(' · ') || `Venda #${s.sale_number}`;
      ops.push({
        id: `sale-${s.id}`,
        time: s.created_at,
        category,
        payment_method: s.payment_method,
        amount: Number(s.total_amount),
        signed_amount: cancelled ? 0 : Number(s.total_amount),
        type: 'Venda PDV',
        origin: 'PDV',
        description: desc,
        user_name: nameMap[s.created_by] || '—',
        status: cancelled ? 'Cancelada' : 'Confirmada',
        ref: `#${s.sale_number}`,
        cancelled,
        isCashAffecting: !cancelled && s.payment_method === 'dinheiro',
      });
    });

    entries.forEach((e) => {
      const cancelled = e.is_deleted;
      const isExpense = e.entry_type === 'expense';
      const amt = Number(e.amount);
      let type = isExpense ? 'Saída' : 'Entrada';
      let origin = 'Manual';
      let description = e.description || e.category || '';
      let consolidated: Operation['consolidated'] | undefined;

      if (e.source_type === 'spr_fiado_payment') {
        type = 'Pagamento SPR';
        origin = 'SPR';
        const det = e.source_id ? fiadoDetails[e.source_id] : undefined;
        if (det) {
          consolidated = { items_count: det.items_count };
          description = `${det.volunteer_name || 'Voluntário'} · ${det.items_count} item(ns) baixado(s)`;
        }
      } else if (/sangria/i.test(e.category || '')) {
        type = 'Sangria';
      } else if (/suprimento/i.test(e.category || '')) {
        type = 'Suprimento';
      } else if (/estorno|devoluc|reembolso/i.test(e.category || '')) {
        type = 'Estorno/Devolução';
      } else if (/despesa/i.test(e.category || '')) {
        type = 'Despesa';
      } else if (/mensalidad/i.test(e.category || '')) {
        type = 'Mensalidade';
      } else if (/doaca/i.test(e.category || '')) {
        type = 'Doação';
      }

      const pm = e.payment_method || 'dinheiro';
      const isCashEntry = pm === 'dinheiro';
      ops.push({
        id: `entry-${e.id}`,
        time: e.created_at,
        category: e.category || (isExpense ? 'Outras saídas' : 'Outras entradas'),
        payment_method: pm,
        amount: amt,
        signed_amount: cancelled ? 0 : isExpense ? -amt : amt,
        type,
        origin,
        description,
        user_name: nameMap[e.created_by] || '—',
        status: cancelled ? 'Excluída' : 'Confirmada',
        ref: `#${e.id.slice(0, 8)}`,
        cancelled,
        isCashAffecting: !cancelled && isCashEntry,
        consolidated,
      });
    });

    ops.sort((a, b) => a.time.localeCompare(b.time));
    return ops;
  }, [sales, entries, nameMap, fiadoDetails]);

  // ---------- Resumos ----------
  const resumoPorForma = useMemo(() => {
    const map: Record<string, number> = {};
    operations.forEach((o) => {
      if (o.cancelled) return;
      if (o.signed_amount === 0) return;
      if (o.signed_amount < 0) return; // só entradas no "recebido"
      map[o.payment_method] = (map[o.payment_method] || 0) + o.signed_amount;
    });
    return map;
  }, [operations]);

  const resumoPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    operations.forEach((o) => {
      if (o.cancelled) return;
      map[o.category] = (map[o.category] || 0) + o.signed_amount;
    });
    return Object.entries(map).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [operations]);

  // Agrupa: categoria > forma de pagamento > lista cronológica
  const grouped = useMemo(() => {
    const tree: Record<string, Record<string, Operation[]>> = {};
    operations.forEach((o) => {
      if (!tree[o.category]) tree[o.category] = {};
      if (!tree[o.category][o.payment_method]) tree[o.category][o.payment_method] = [];
      tree[o.category][o.payment_method].push(o);
    });
    return Object.entries(tree).sort((a, b) => a[0].localeCompare(b[0]));
  }, [operations]);

  // ---------- Conferência cruzada ----------
  const totalRecebido = Object.values(resumoPorForma).reduce((s, v) => s + v, 0);
  const totalCategoriasAbs = resumoPorCategoria.reduce((s, [, v]) => s + (v > 0 ? v : 0), 0);
  const saidasValidas = -resumoPorCategoria.reduce((s, [, v]) => s + (v < 0 ? v : 0), 0);

  // ---------- Pontos de atenção ----------
  const pontos: string[] = useMemo(() => {
    const list: string[] = [];
    const sangrias = operations.filter((o) => o.type === 'Sangria' && !o.cancelled);
    if (sangrias.length > 0) list.push(`${sangrias.length} sangria(s) no dia. Conferir comprovante.`);
    const canc = operations.filter((o) => o.cancelled);
    if (canc.length > 0) list.push(`${canc.length} operação(ões) cancelada(s)/excluída(s). Conferir se não impactam o caixa.`);
    const estornos = operations.filter((o) => o.type === 'Estorno/Devolução' && !o.cancelled);
    if (estornos.length > 0) list.push(`${estornos.length} estorno(s)/devolução(ões) lançado(s).`);
    const fiadoNonCash = operations.filter((o) => o.type === 'Pagamento SPR' && o.payment_method !== 'dinheiro' && !o.cancelled);
    if (fiadoNonCash.length > 0) list.push(`${fiadoNonCash.length} pagamento(s) de SPR/Fiado em PIX/cartão — NÃO entram no dinheiro físico.`);
    const despSemDesc = operations.filter((o) => o.type === 'Despesa' && !o.description.trim());
    if (despSemDesc.length > 0) list.push(`${despSemDesc.length} despesa(s) sem descrição.`);
    if (diff != null && Math.abs(diff) >= 0.005) list.push(`Diferença detectada de ${formatCurrency(diff)}. Verifique forma de pagamento, categoria e lançamentos manuais.`);
    return list;
  }, [operations, diff]);

  // ---------- Impressão térmica ----------
  const handlePrint = async () => {
    const companyData = getCompanyDocumentData(company);
    const footer = getCompanyFooterLines(companyData);
    const HR = '================================';
    const hr = () => `<div class="hr">${HR}</div>`;
    const title = (t: string) => `<p class="block-title">${escapeHtml(t)}</p>`;
    const row = (l: string, v: string, opts: { bold?: boolean; strong?: boolean } = {}) => {
      const cls = opts.strong ? 'row strong' : opts.bold ? 'row bold' : 'row';
      return `<div class="${cls}"><span>${escapeHtml(l)}</span><span>${escapeHtml(v)}</span></div>`;
    };

    const formaBloco = PAYMENT_METHODS
      .map((pm) => ({ label: pm.label, value: resumoPorForma[pm.value] || 0 }))
      .filter((r) => r.value > 0)
      .map((r) => row(r.label + ':', formatCurrency(r.value)))
      .join('') + row('Total recebido:', formatCurrency(totalRecebido), { strong: true });

    const catBloco = resumoPorCategoria.length === 0
      ? '<p class="empty">Sem movimentações.</p>'
      : resumoPorCategoria.map(([c, v]) => row(c + ':', formatCurrency(v))).join('')
        + row('Total categorias:', formatCurrency(resumoPorCategoria.reduce((s, [, v]) => s + v, 0)), { strong: true });

    const detalhamento = grouped.map(([cat, byMethod]) => {
      const catTotal = Object.values(byMethod).flat().filter((o) => !o.cancelled).reduce((s, o) => s + o.signed_amount, 0);
      const pmBlocks = Object.entries(byMethod).map(([pm, ops]) => {
        const pmTotal = ops.filter((o) => !o.cancelled).reduce((s, o) => s + o.signed_amount, 0);
        const opsHtml = ops.map((o) => `
          <div class="op">
            <div class="op-head">${escapeHtml(fmtTime(o.time))} | ${escapeHtml(o.ref)} ${o.cancelled ? '· <b>[CANCELADA]</b>' : ''}</div>
            <div class="op-line">Origem: ${escapeHtml(o.origin)} · Tipo: ${escapeHtml(o.type)}</div>
            <div class="op-line">${escapeHtml(o.description || '—')}</div>
            ${o.consolidated ? `<div class="op-line">Pagamento consolidado · Itens baixados: ${o.consolidated.items_count}</div>` : ''}
            <div class="op-line">Valor: <b>${escapeHtml(formatCurrency(o.amount))}</b> · ${escapeHtml(o.user_name)}</div>
          </div>
        `).join('');
        return `
          <p class="sub-title">Forma: ${escapeHtml(pmLabel(pm))}</p>
          ${row('Total ' + pmLabel(pm) + ':', formatCurrency(pmTotal), { bold: true })}
          ${opsHtml}
        `;
      }).join('');
      return `
        <p class="cat-title">CATEGORIA: ${escapeHtml(cat.toUpperCase())}</p>
        ${row('Total categoria:', formatCurrency(catTotal), { bold: true })}
        ${pmBlocks}
        ${hr()}
      `;
    }).join('');

    const saidas = operations.filter((o) => !o.cancelled && o.signed_amount < 0);
    const saidasTotal = saidas.reduce((s, o) => s + Math.abs(o.signed_amount), 0);
    const saidasHtml = saidas.length === 0
      ? '<p class="empty">Sem saídas no período.</p>'
      : saidas.map((o) => `
          <div class="op">
            <div class="op-head">${escapeHtml(fmtTime(o.time))} · ${escapeHtml(o.type)}</div>
            <div class="op-line">${escapeHtml(o.description || '—')}</div>
            <div class="op-line">Forma: ${escapeHtml(pmLabel(o.payment_method))} · ID: ${escapeHtml(o.ref)}</div>
            <div class="op-line">Valor: <b>${escapeHtml(formatCurrency(o.amount))}</b> · ${escapeHtml(o.user_name)}</div>
          </div>
        `).join('') + row('Total de saídas:', formatCurrency(saidasTotal), { strong: true });

    const pontosHtml = pontos.length === 0
      ? '<p class="empty">Nenhum ponto de atenção identificado.</p>'
      : pontos.map((p) => `<p class="pa">• ${escapeHtml(p)}</p>`).join('');

    await printHtmlDocument({
      title: `Extrato Analítico ${formatDate(businessDate)}`,
      bodyHtml: `
        <div class="header">
          <p class="company">${escapeHtml(companyData.name.toUpperCase())}</p>
          <p class="doc">EXTRATO ANALÍTICO DO CAIXA</p>
          <p class="meta">Data do caixa: ${escapeHtml(formatDate(businessDate))}</p>
          <p class="meta">Operador: ${escapeHtml(operatorName || '—')}</p>
          <p class="meta">Abertura: ${escapeHtml(fmtDateTime(openedAt))}</p>
          <p class="meta">Fechamento: ${escapeHtml(fmtDateTime(closedAt))}</p>
          <p class="meta">Impresso em: ${escapeHtml(fmtDateTime(new Date().toISOString()))}</p>
        </div>
        ${hr()}
        <p class="status">${escapeHtml(statusLine)}</p>
        ${row('Saldo inicial:', formatCurrency(physical.openingBalance))}
        ${row('Entradas dinheiro:', formatCurrency(physical.cashIn))}
        ${row('Saídas dinheiro:', formatCurrency(physical.cashOut))}
        ${row('Saldo esperado:', formatCurrency(expected), { strong: true })}
        ${countedBalance != null ? row('Valor contado:', formatCurrency(countedBalance), { bold: true }) : ''}
        ${diff != null ? `<div class="diff"><span>DIFERENÇA:</span><span>${escapeHtml(formatCurrency(diff))}</span></div>` : ''}
        ${hr()}

        ${title('RESUMO POR FORMA DE PAGAMENTO')}
        ${formaBloco}
        <p class="note">Somente dinheiro compõe o caixa físico. PIX, cartão e transferência compõem o movimento financeiro.</p>
        ${hr()}

        ${title('RESUMO POR CATEGORIA')}
        ${catBloco}
        ${hr()}

        ${title('CONFERÊNCIA CRUZADA')}
        ${row('Total por forma de pagamento:', formatCurrency(totalRecebido))}
        ${row('Total por categoria (entradas):', formatCurrency(totalCategoriasAbs))}
        ${row('Total de saídas válidas:', formatCurrency(saidasValidas))}
        ${row('Saldo esperado dinheiro:', formatCurrency(expected))}
        ${countedBalance != null ? row('Valor contado dinheiro:', formatCurrency(countedBalance)) : ''}
        ${diff != null ? row('Diferença:', formatCurrency(diff), { bold: true }) : ''}
        ${row('Conferência cruzada:', Math.abs(totalRecebido - totalCategoriasAbs) < 0.01 ? 'OK' : 'VERIFICAR', { strong: true })}
        ${hr()}

        ${title('DETALHAMENTO ANALÍTICO')}
        ${detalhamento || '<p class="empty">Sem operações no período.</p>'}

        ${title('SAÍDAS / REDUÇÕES DO CAIXA')}
        ${saidasHtml}
        ${hr()}

        ${title('PONTOS DE ATENÇÃO')}
        ${pontosHtml}
        ${hr()}

        <div class="sign">
          <p>Operador: ______________________</p>
          <p>Conferente: ____________________</p>
          <p>Observações: ___________________</p>
          <p>Data/hora: ___/___/______  ___:___</p>
        </div>
        ${footer.length > 0 ? `<div class="footer">${footer.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>` : ''}
      `,
      styles: `
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000 !important; }
        html, body { background: #fff; }
        body { margin: 0; padding: 4mm; font-family: 'Courier New', 'Consolas', monospace; font-size: 13px; font-weight: 700; line-height: 1.4; color: #000; }
        .header { text-align: center; margin-bottom: 6px; }
        .company { font-size: 17px; font-weight: 900; margin: 0 0 3px; letter-spacing: 0.5px; }
        .doc { font-size: 15px; font-weight: 900; margin: 2px 0; }
        .meta { font-size: 12px; font-weight: 700; margin: 1px 0; }
        .hr { font-weight: 900; text-align: center; margin: 6px 0; font-size: 13px; overflow: hidden; white-space: nowrap; }
        .status { text-align: center; font-weight: 900; font-size: 15px; margin: 4px 0; text-transform: uppercase; }
        .block-title { font-weight: 900; font-size: 14px; text-transform: uppercase; margin: 6px 0 4px; }
        .cat-title { font-weight: 900; font-size: 14px; text-transform: uppercase; margin: 6px 0 2px; border-bottom: 2px solid #000; }
        .sub-title { font-weight: 900; font-size: 13px; margin: 4px 0 2px; }
        .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 700; padding: 1px 0; }
        .row.bold { font-weight: 900; }
        .row.strong { font-weight: 900; font-size: 14px; border-top: 2px solid #000; padding-top: 3px; margin-top: 2px; }
        .op { margin: 4px 0 6px; border-left: 3px solid #000; padding: 2px 0 2px 6px; }
        .op-head { font-weight: 900; font-size: 13px; }
        .op-line { font-size: 12px; font-weight: 700; }
        .empty { font-size: 12px; font-style: italic; margin: 2px 0; }
        .note { font-size: 11px; font-style: italic; margin: 4px 0; }
        .pa { font-size: 13px; font-weight: 700; margin: 2px 0; }
        .diff { display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; border: 3px solid #000; padding: 5px 7px; margin: 6px 0; }
        .sign { margin-top: 10px; font-size: 12px; font-weight: 700; }
        .sign p { margin: 3px 0; }
        .footer { text-align: center; font-size: 11px; font-weight: 700; margin-top: 8px; }
        @media print { @page { size: 80mm auto; margin: 0; } body { padding: 3mm; } }
      `,
      windowFeatures: 'width=420,height=700',
    });
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full h-11 border-primary/30 text-primary hover:bg-primary/5"
        onClick={() => setOpen(true)}
      >
        <FileSearch className="mr-2 h-4 w-4" />
        Extrato Analítico
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] p-0 flex flex-col top-2 sm:top-1/2 translate-y-0 sm:-translate-y-1/2">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-base">Extrato Analítico — {formatDate(businessDate)}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className={`rounded-lg border-2 p-3 text-center font-bold ${
                  diff == null ? 'border-muted'
                  : Math.abs(diff) < 0.005 ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                  : diff > 0 ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                  : 'border-destructive bg-destructive/10'
                }`}>
                  {statusLine}
                  {diff != null && <div className="text-2xl font-extrabold mt-1">{formatCurrency(diff)}</div>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Saldo inicial" value={formatCurrency(physical.openingBalance)} />
                  <Stat label="Entradas dinheiro" value={formatCurrency(physical.cashIn)} />
                  <Stat label="Saídas dinheiro" value={formatCurrency(physical.cashOut)} />
                  <Stat label="Saldo esperado" value={formatCurrency(expected)} highlight />
                  {countedBalance != null && <Stat label="Valor contado" value={formatCurrency(countedBalance)} />}
                </div>

                <Section title="Resumo por forma de pagamento">
                  {PAYMENT_METHODS.map((pm) => {
                    const v = resumoPorForma[pm.value] || 0;
                    if (v === 0) return null;
                    return <Row key={pm.value} l={pm.label} v={formatCurrency(v)} />;
                  })}
                  <Row l="Total recebido" v={formatCurrency(totalRecebido)} strong />
                  <p className="text-[11px] italic text-muted-foreground mt-2">
                    Somente dinheiro compõe o caixa físico. PIX/cartão/transferência compõem apenas o movimento financeiro.
                  </p>
                </Section>

                <Section title="Resumo por categoria">
                  {resumoPorCategoria.length === 0 && <p className="text-xs italic text-muted-foreground">Sem movimentações.</p>}
                  {resumoPorCategoria.map(([c, v]) => (
                    <Row key={c} l={c} v={formatCurrency(v)} negative={v < 0} />
                  ))}
                </Section>

                <Section title="Conferência cruzada">
                  <Row l="Total por forma de pagamento" v={formatCurrency(totalRecebido)} />
                  <Row l="Total entradas por categoria" v={formatCurrency(totalCategoriasAbs)} />
                  <Row l="Total de saídas válidas" v={formatCurrency(saidasValidas)} />
                  <Row l="Saldo esperado dinheiro" v={formatCurrency(expected)} />
                  {diff != null && <Row l="Diferença" v={formatCurrency(diff)} strong />}
                  <Row
                    l="Conferência cruzada"
                    v={Math.abs(totalRecebido - totalCategoriasAbs) < 0.01 ? 'OK' : 'VERIFICAR'}
                    strong
                  />
                </Section>

                <Section title="Detalhamento analítico">
                  {grouped.length === 0 && <p className="text-xs italic text-muted-foreground">Sem operações no período.</p>}
                  {grouped.map(([cat, byMethod]) => {
                    const catTotal = Object.values(byMethod).flat().filter((o) => !o.cancelled).reduce((s, o) => s + o.signed_amount, 0);
                    return (
                      <div key={cat} className="mt-3 first:mt-0">
                        <div className="flex justify-between border-b-2 border-foreground/60 pb-1 font-bold uppercase text-xs">
                          <span>{cat}</span><span>{formatCurrency(catTotal)}</span>
                        </div>
                        {Object.entries(byMethod).map(([pm, ops]) => {
                          const total = ops.filter((o) => !o.cancelled).reduce((s, o) => s + o.signed_amount, 0);
                          return (
                            <div key={pm} className="mt-2">
                              <div className="flex justify-between text-xs font-semibold">
                                <span>Forma: {pmLabel(pm)}</span>
                                <span>{formatCurrency(total)}</span>
                              </div>
                              <ul className="mt-1 space-y-1">
                                {ops.map((o) => (
                                  <li key={o.id} className={`rounded border-l-2 pl-2 py-1 text-[11px] ${o.cancelled ? 'border-destructive bg-destructive/5 line-through opacity-70' : 'border-primary/60 bg-muted/30'}`}>
                                    <div className="flex justify-between font-bold">
                                      <span>{fmtTime(o.time)} · {o.ref}</span>
                                      <span>{formatCurrency(o.amount)}</span>
                                    </div>
                                    <div className="text-muted-foreground">{o.origin} · {o.type} · {o.user_name}</div>
                                    <div>{o.description}</div>
                                    {o.consolidated && (
                                      <div className="text-[10px] italic text-muted-foreground">
                                        Pagamento consolidado · {o.consolidated.items_count} item(ns) baixado(s)
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </Section>

                <Section title="Pontos de atenção">
                  {pontos.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">Nenhum ponto de atenção identificado.</p>
                  ) : (
                    <ul className="space-y-1">
                      {pontos.map((p, i) => <li key={i} className="text-xs">• {p}</li>)}
                    </ul>
                  )}
                </Section>
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-3 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Fechar</Button>
            <Button className="flex-1" onClick={handlePrint} disabled={loading}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir Extrato Analítico
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${highlight ? 'border-primary bg-primary/5' : 'bg-background'}`}>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className={`font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}

function Row({ l, v, strong, negative }: { l: string; v: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 text-xs ${strong ? 'border-t mt-1 pt-1 font-bold' : ''} ${negative ? 'text-destructive' : ''}`}>
      <span>{l}</span><span className="font-mono">{v}</span>
    </div>
  );
}
