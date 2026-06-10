import type { VolunteerHistoryData } from '@/hooks/useVolunteerFiadoHistory';

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportVolunteerHistoryCSV(data: VolunteerHistoryData, periodLabel: string) {
  const lines: string[] = [];
  lines.push(`Histórico de Fiado;${data.volunteer?.full_name ?? ''};Período;${periodLabel}`);
  lines.push('');
  lines.push('Resumo');
  lines.push(`Saldo atual;${data.summary.current_balance.toFixed(2)}`);
  lines.push(`Adquirido no período;${data.summary.acquired_total.toFixed(2)}`);
  lines.push(`Pago no período;${data.summary.paid_total.toFixed(2)}`);
  lines.push(`Saldo anterior;${data.previousBalance.toFixed(2)}`);
  lines.push('');
  lines.push('Fiados adquiridos');
  lines.push(['Data', 'Descrição', 'Itens', 'Valor', 'Status', 'Usuário'].join(';'));
  for (const c of data.charges) {
    lines.push([c.created_at, c.description || '', c.items.length, c.amount.toFixed(2), c.status, c.created_by_name || ''].map(csvEscape).join(';'));
  }
  lines.push('');
  lines.push('Pagamentos (consolidados)');
  lines.push(['Data', 'Forma', 'Itens baixados', 'Valor total', 'Usuário'].join(';'));
  for (const g of data.paymentGroups) {
    lines.push([g.created_at, g.payment_method, g.items.length, g.total_paid.toFixed(2), g.created_by_name || ''].map(csvEscape).join(';'));
  }
  lines.push('');
  lines.push('Linha do Tempo');
  lines.push(['Data', 'Tipo', 'Descrição', 'Débito', 'Crédito', 'Saldo após', 'Usuário'].join(';'));
  for (const t of data.timeline) {
    lines.push([t.occurred_at, t.kind, t.description, t.debit.toFixed(2), t.credit.toFixed(2), t.balance_after.toFixed(2), t.user_name || ''].map(csvEscape).join(';'));
  }
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_${data.volunteer?.full_name?.replace(/\s+/g, '_') || 'pessoa'}_${periodLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildLocalAISummary(data: VolunteerHistoryData, periodLabel: string): string {
  const s = data.summary;
  const parts: string[] = [];
  parts.push(`Período: ${periodLabel}.`);
  parts.push(`Saldo atual: R$ ${s.current_balance.toFixed(2)}.`);
  parts.push(`No período, adquiriu R$ ${s.acquired_total.toFixed(2)} e pagou R$ ${s.paid_total.toFixed(2)}.`);
  if (data.previousBalance > 0.01) {
    parts.push(`Havia saldo devedor anterior de R$ ${data.previousBalance.toFixed(2)}.`);
  }
  const fragmented = data.paymentGroups.filter(g => g.items.length === 1).length;
  const consolidated = data.paymentGroups.filter(g => g.items.length > 1).length;
  if (consolidated > 0) parts.push(`${consolidated} pagamento(s) quitaram múltiplos itens em uma única operação.`);
  if (fragmented > 3) parts.push(`Há ${fragmented} pagamentos individuais — considerar consolidar.`);
  const noGroup = data.paymentGroups.filter(g => !g.hasGroupId).length;
  if (noGroup > 0) parts.push(`⚠ ${noGroup} pagamento(s) sem identificador de agrupamento — verificar.`);
  if (s.current_balance > 0.01 && s.paid_total === 0) parts.push('Pessoa não realizou nenhum pagamento no período.');
  return parts.join(' ');
}
