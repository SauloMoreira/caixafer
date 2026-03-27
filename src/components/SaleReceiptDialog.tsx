import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SaleReceipt, { type ReceiptData } from './SaleReceipt';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import { Printer, FileText, Share2, X } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Enums']['payment_method'];

const paymentLabel = (m: PaymentMethod) => PAYMENT_METHODS.find(p => p.value === m)?.label || m;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}

export default function SaleReceiptDialog({ open, onOpenChange, data }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Comprovante #${data.saleNumber}</title>
      <style>
        body { margin: 0; padding: 10mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.5; }
        @media print { body { padding: 5mm; } @page { size: 80mm auto; margin: 0; } }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const buildPlainText = () => {
    const lines = [
      '=============================',
      '      CANTINA DA FER',
      '=============================',
      '',
      `Venda: #${data.saleNumber}`,
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
    ];
    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildPlainText();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Comprovante #${data.saleNumber}`, text });
      } catch { /* user cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const handleGeneratePDF = () => {
    // Uses print-to-PDF approach (browser native)
    handlePrint();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Comprovante de Venda</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <SaleReceipt ref={receiptRef} data={data} />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
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
        </div>

        <Button variant="default" className="h-12 w-full mt-2" onClick={() => onOpenChange(false)}>
          Nova Venda
        </Button>
      </DialogContent>
    </Dialog>
  );
}
