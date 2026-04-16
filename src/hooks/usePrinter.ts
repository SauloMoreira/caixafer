import { useCallback, useState } from 'react';
import { printReceipt as printReceiptUtil } from '@/utils/printer';

interface PrinterConfig {
  ip: string | null;
  port: number;
  width: '58mm' | '80mm';
  autocutter: boolean;
}

function readConfig(): PrinterConfig {
  if (typeof window === 'undefined') {
    return { ip: null, port: 9100, width: '80mm', autocutter: true };
  }
  return {
    ip: localStorage.getItem('printer_ip'),
    port: Number(localStorage.getItem('printer_port')) || 9100,
    width: (localStorage.getItem('printer_width') as '58mm' | '80mm') || '80mm',
    autocutter: localStorage.getItem('printer_autocutter') !== 'false',
  };
}

export function usePrinter() {
  const [isPrinting, setIsPrinting] = useState(false);

  const printReceipt = useCallback((lines: string[]) => {
    setIsPrinting(true);
    printReceiptUtil(lines);
    window.setTimeout(() => setIsPrinting(false), 1500);
  }, []);

  return {
    printReceipt,
    isPrinting,
    printerConfig: readConfig(),
  };
}
