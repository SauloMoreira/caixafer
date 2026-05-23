import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SaleReceipt, { type ReceiptData } from './SaleReceipt';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Printer, Zap } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import PrintButton from './PrintButton';
import { useCompany } from '@/hooks/useCompany';
import { getCompanyDocumentData, getCompanyFooterLines, getCompanyHeaderLines } from '@/lib/company-documents';
import { printHtmlDocument } from '@/lib/print-window';

type PaymentMethod = Database['public']['Enums']['payment_method'];

const paymentLabel = (m: PaymentMethod) => PAYMENT_METHODS.find(p => p.value === m)?.label || m;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}

export default function SaleReceiptDialog({ open, onOpenChange, data }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { company } = useCompany();

  if (!data) return null;

  const companyData = getCompanyDocumentData(company);
  const companyHeaderLines = getCompanyHeaderLines(companyData);
  const companyFooterLines = getCompanyFooterLines(companyData);

  const handlePrint = async () => {
    const content = receiptRef.current;
    if (!content) return;

    await printHtmlDocument({
      title: `Pedido #${data.saleNumber}`,
      bodyHtml: content.innerHTML,
      styles: `
        * { box-sizing: border-box; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; padding: 8mm; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; color: #000; }
        img { display: block; margin: 0 auto 6px; max-width: 140px; max-height: 60px; object-fit: contain; }
        .receipt-company-name { font-size: 19px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
        .receipt-legal-name { font-size: 12px; font-weight: 700; color: #000; }
        .receipt-header-line { font-size: 12px; font-weight: 600; color: #000; }
        .receipt-order-highlight { font-size: 16px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 0; text-align: center; display: flex; justify-content: center; }
        .receipt-items-header { font-size: 12px; font-weight: 800; border-bottom: 2px solid #000; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .receipt-item-row { font-size: 14px; font-weight: 600; }
        .receipt-total-line { font-size: 18px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 0; }
        .receipt-sep-secondary { border-bottom: 2px dashed #333; margin: 6px 0; }
        @media print { body { padding: 4mm; } @page { size: 80mm auto; margin: 0; } }
      `,
      windowFeatures: 'width=400,height=700',
    });
  };

  const buildPlainText = () => {
    const lines = [
      '=============================',
      `      ${companyData.name.toUpperCase()}`,
      '=============================',
      ...companyHeaderLines,
      '',
      '',
      data.isFiado ? `FIADO: #${data.saleNumber}` : `Pedido: #${data.saleNumber}`,
      ...(data.isFiado && data.volunteerName ? [`Voluntário: ${data.volunteerName}`] : []),
      `Data: ${formatDateTime(data.createdAt)}`,
      `Operador: ${data.operatorName}`,
      '-----------------------------',
      ...data.items.map(i => `${i.quantity}x ${i.name} ${formatCurrency(i.lineTotal)}`),
      '-----------------------------',
      `Subtotal: ${formatCurrency(data.subtotal)}`,
      ...(data.discount > 0 ? [`Desconto: -${formatCurrency(data.discount)}`] : []),
      `TOTAL: ${formatCurrency(data.total)}`,
      `Pagamento: ${data.isFiado ? 'FIADO' : data.paymentMethod ? paymentLabel(data.paymentMethod) : '—'}`,
      '-----------------------------',
      'Obrigado pela preferência! 💚',
      ...companyFooterLines,
    ];
    return lines.join('\n');
  };

  const rawBtLines = buildPlainText().split('\n');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">{data.isFiado ? 'Fiado Registrado' : 'Pedido'}</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <SaleReceipt ref={receiptRef} data={data} company={company} />
        </div>

        <div className="flex gap-3 w-full mt-4">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex-1 flex flex-col items-center gap-1 h-16"
          >
            <Printer className="w-5 h-5" />
            <span className="text-xs">Imprimir</span>
          </Button>
          <PrintButton lines={rawBtLines} label="RawBT" className="flex-1 !h-16" />
        </div>

        <Button variant="default" className="h-12 w-full mt-2" onClick={() => onOpenChange(false)}>
          {data.isFiado ? 'Fechar' : 'Nova Venda'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
