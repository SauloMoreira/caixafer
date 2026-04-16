import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SaleReceipt, { type ReceiptData } from './SaleReceipt';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Printer, FileText, Share2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import BluetoothPrintButton from './BluetoothPrintButton';
import PrintButton from './PrintButton';
import { printReceipt } from '@/lib/bluetooth-printer';
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
        body { margin: 0; padding: 10mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.5; color: #000; }
        * { color: #000 !important; }
        img { display: block; margin: 0 auto 6px; max-width: 140px; max-height: 60px; object-fit: contain; }
        .receipt-company-name { font-size: 15px; font-weight: 700; text-transform: uppercase; }
        .receipt-legal-name { font-weight: 600; }
        .receipt-header-line { font-weight: 500; }
        .receipt-order-highlight { font-size: 12px; font-weight: 700; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; text-align: center; display: flex; justify-content: center; }
        .receipt-items-header { font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 3px; }
        .receipt-item-row { font-size: 11px; font-weight: 500; }
        .receipt-total-line { font-size: 14px; font-weight: 700; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; }
        .receipt-sep-secondary { border-bottom: 1px dashed #666; }
        @media print { body { padding: 5mm; } @page { size: 80mm auto; margin: 0; } }
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
      `Pedido: #${data.saleNumber}`,
      `Data: ${formatDateTime(data.createdAt)}`,
      `Operador: ${data.operatorName}`,
      '-----------------------------',
      ...data.items.map(i => `${i.quantity}x ${i.name} ${formatCurrency(i.lineTotal)}`),
      '-----------------------------',
      `Subtotal: ${formatCurrency(data.subtotal)}`,
      ...(data.discount > 0 ? [`Desconto: -${formatCurrency(data.discount)}`] : []),
      `TOTAL: ${formatCurrency(data.total)}`,
      `Pagamento: ${paymentLabel(data.paymentMethod)}`,
      '-----------------------------',
      'Obrigado pela preferência! 💚',
      ...companyFooterLines,
    ];
    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildPlainText();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Pedido #${data.saleNumber}`, text });
      } catch { /* user cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const handleGeneratePDF = () => {
    // Uses print-to-PDF approach (browser native)
    handlePrint();
  };

  const rawBtLines = buildPlainText().split('\n');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Pedido</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <SaleReceipt ref={receiptRef} data={data} company={company} />
        </div>

        <div className="grid grid-cols-5 gap-2 mt-4">
          <Button variant="outline" onClick={handlePrint} className="h-12 flex-col gap-1">
            <Printer className="h-4 w-4" />
            <span className="text-[10px]">Imprimir</span>
          </Button>
          <Button variant="outline" onClick={handleGeneratePDF} className="h-12 flex-col gap-1">
            <FileText className="h-4 w-4" />
            <span className="text-[10px]">PDF</span>
          </Button>
          <Button variant="outline" onClick={handleShare} className="h-12 flex-col gap-1">
            <Share2 className="h-4 w-4" />
            <span className="text-[10px]">Compartilhar</span>
          </Button>
          <PrintButton lines={rawBtLines} label="RawBT" />
          <BluetoothPrintButton
            onPrint={async () => {
              await printReceipt({
                saleNumber: data.saleNumber,
                createdAt: data.createdAt,
                operatorName: data.operatorName,
                items: data.items,
                subtotal: data.subtotal,
                discount: data.discount,
                total: data.total,
                paymentMethod: data.paymentMethod,
                paymentLabel: paymentLabel(data.paymentMethod),
                company: companyData,
              });
            }}
          />
        </div>

        <Button variant="default" className="h-12 w-full mt-2" onClick={() => onOpenChange(false)}>
          Nova Venda
        </Button>
      </DialogContent>
    </Dialog>
  );
}
