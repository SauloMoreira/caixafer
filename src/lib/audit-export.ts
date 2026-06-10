import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { DailySummary, MovementRow } from "@/hooks/useDailyAudit";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function summaryEntries(s: DailySummary) {
  return [
    ["PDV", fmtBRL(s.pdv_total)],
    ["SPR (mov.)", fmtBRL(s.spr_total)],
    ["Fiado lançado", fmtBRL(s.fiado_total)],
    ["Recebido", fmtBRL(s.received_total)],
    ["Em aberto", fmtBRL(s.open_total)],
    ["Entradas", fmtBRL(s.income_total)],
    ["Saídas", fmtBRL(s.expense_total)],
    ["Cancelamentos", `${s.cancellations_count} (${fmtBRL(s.cancellations_total)})`],
    ["Estornos", String(s.reversals_count)],
    ["Descontos", fmtBRL(s.discounts_total)],
    ["Mov. manuais", String(s.manual_count)],
    ["Vendas", String(s.sales_count)],
    ["Usuários ativos", String(s.active_users)],
  ];
}

export function exportCSV(date: string, summary: DailySummary, rows: MovementRow[]) {
  const lines: string[] = [];
  lines.push(`Auditoria Diária;${date}`);
  lines.push("");
  lines.push("Resumo;Valor");
  summaryEntries(summary).forEach(([k, v]) => lines.push(`${k};${v}`));
  lines.push("");
  lines.push(
    "Hora;Origem;Tipo;Ref;Cliente;Descrição;Pgto;Valor;Status;Usuário;Observação",
  );
  rows.forEach((r) =>
    lines.push(
      [
        format(new Date(r.occurred_at), "HH:mm:ss"),
        r.origin,
        r.type,
        r.ref_label ?? r.ref_id,
        r.client ?? "",
        (r.description ?? "").replace(/;/g, ","),
        r.payment_method ?? "",
        r.amount.toString().replace(".", ","),
        r.status,
        r.user_name ?? "",
        (r.notes ?? "").replace(/;/g, ","),
      ].join(";"),
    ),
  );
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `auditoria-${date}.csv`);
}

export function exportPDF(
  date: string,
  summary: DailySummary,
  rows: MovementRow[],
  aiText?: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`Auditoria Diária — ${date}`, 14, 14);

  autoTable(doc, {
    startY: 20,
    head: [["Indicador", "Valor"]],
    body: summaryEntries(summary),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [40, 40, 40] },
    theme: "grid",
  });

  let nextY = (doc as any).lastAutoTable.finalY + 6;

  if (aiText) {
    doc.setFontSize(11);
    doc.text("Análise da IA", 14, nextY);
    nextY += 4;
    const lines = doc.splitTextToSize(aiText, 270);
    doc.setFontSize(9);
    doc.text(lines, 14, nextY + 4);
    nextY += 4 + lines.length * 4 + 4;
  }

  autoTable(doc, {
    startY: nextY,
    head: [["Hora", "Origem", "Tipo", "Ref", "Cliente", "Descrição", "Pgto", "Valor", "Status", "Usuário"]],
    body: rows.map((r) => [
      format(new Date(r.occurred_at), "HH:mm:ss"),
      r.origin,
      r.type,
      r.ref_label ?? "",
      r.client ?? "",
      r.description ?? "",
      r.payment_method ?? "",
      fmtBRL(r.amount),
      r.status,
      r.user_name ?? "",
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 40, 40] },
    theme: "striped",
  });

  doc.save(`auditoria-${date}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
