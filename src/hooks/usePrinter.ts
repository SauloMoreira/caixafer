import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { printReceipt as printReceiptUtil } from '@/utils/printer';
import { useCompany } from '@/hooks/useCompany';

export function usePrinter() {
  const { company } = useCompany();
  const [isPrinting, setIsPrinting] = useState(false);

  const printerIp = company?.printer_ip?.trim() || null;

  const printReceipt = useCallback(
    (lines: string[]) => {
      if (!printerIp) {
        toast.error(
          'Impressora não configurada. Acesse Administração > Empresa e informe o IP da impressora.',
          { duration: 6000 },
        );
        return;
      }
      setIsPrinting(true);
      printReceiptUtil(lines);
      window.setTimeout(() => setIsPrinting(false), 1500);
    },
    [printerIp],
  );

  return {
    printReceipt,
    isPrinting,
    printerIp,
  };
}
