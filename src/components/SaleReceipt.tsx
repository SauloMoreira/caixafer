import { forwardRef } from 'react';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/lib/constants';
import type { Database } from '@/integrations/supabase/types';
import type { Company } from '@/hooks/useCompany';
import { getCompanyDocumentData, getCompanyFooterLines, getCompanyHeaderLines, getCompanyLegalLine } from '@/lib/company-documents';

type PaymentMethod = Database['public']['Enums']['payment_method'];

export interface ReceiptData {
  saleNumber: number;
  createdAt: string;
  operatorName: string;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
}

const paymentLabel = (m: PaymentMethod) => PAYMENT_METHODS.find(p => p.value === m)?.label || m;

const SaleReceipt = forwardRef<HTMLDivElement, { data: ReceiptData; company?: Partial<Company> | null }>(({ data, company }, ref) => {
  const companyData = getCompanyDocumentData(company);
  const companyLegalLine = getCompanyLegalLine(companyData);
  const companyHeaderLines = getCompanyHeaderLines(companyData);
  const companyFooterLines = getCompanyFooterLines(companyData);

  return (
    <div ref={ref} className="w-[320px] mx-auto bg-white text-black p-6 font-mono text-xs leading-relaxed" style={{ fontFamily: "'Courier New', monospace" }}>
      {/* Header */}
      <div className="text-center mb-4">
        {companyData.logoUrl && (
          <img
            src={companyData.logoUrl}
            alt={`Logo da empresa ${companyData.name}`}
            className="mx-auto mb-2 max-h-16 max-w-[140px] object-contain"
            crossOrigin="anonymous"
          />
        )}
        <p className="text-base font-bold tracking-wide">{companyData.name}</p>
        {companyLegalLine && <p className="text-[10px] text-gray-500 mt-0.5">{companyLegalLine}</p>}
        {companyHeaderLines.map((line) => (
          <p key={line} className="text-[10px] text-gray-500 mt-0.5">
            {line}
          </p>
        ))}
        <div className="border-b border-dashed border-gray-400 mt-3" />
      </div>

      {/* Sale info */}
      <div className="mb-3 space-y-0.5">
        <div className="flex justify-between">
          <span>Pedido:</span>
          <span className="font-bold">#{data.saleNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Data:</span>
          <span>{formatDateTime(data.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Operador:</span>
          <span>{data.operatorName}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-gray-400 mb-3" />

      {/* Items */}
      <div className="mb-3 space-y-1.5">
        <div className="flex justify-between font-bold text-[10px] uppercase tracking-wider text-gray-600">
          <span className="flex-1">Item</span>
          <span className="w-8 text-center">Qtd</span>
          <span className="w-16 text-right">Unit.</span>
          <span className="w-16 text-right">Total</span>
        </div>
        <div className="border-b border-dotted border-gray-300" />
        {data.items.map((item, i) => (
          <div key={i} className="flex justify-between">
            <span className="flex-1 truncate pr-1">{item.name}</span>
            <span className="w-8 text-center">{item.quantity}</span>
            <span className="w-16 text-right">{formatCurrency(item.unitPrice)}</span>
            <span className="w-16 text-right">{formatCurrency(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="border-b border-dashed border-gray-400 mb-3" />

      {/* Totals */}
      <div className="space-y-0.5 mb-3">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Desconto:</span>
            <span>-{formatCurrency(data.discount)}</span>
          </div>
        )}
        <div className="border-b border-dotted border-gray-300" />
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL:</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
      </div>

      <div className="flex justify-between mb-3">
        <span>Pagamento:</span>
        <span className="font-bold">{paymentLabel(data.paymentMethod)}</span>
      </div>

      <div className="border-b border-dashed border-gray-400 mb-4" />

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-500 space-y-1">
        <p className="font-bold text-black text-xs">Obrigado pela preferência! 💚</p>
        {companyFooterLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
});

SaleReceipt.displayName = 'SaleReceipt';
export default SaleReceipt;
