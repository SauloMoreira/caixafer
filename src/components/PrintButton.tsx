import { Button } from '@/components/ui/button';
import { Zap, Loader2 } from 'lucide-react';
import { usePrinter } from '@/hooks/usePrinter';

interface Props {
  lines: string[];
  label?: string;
  variant?: 'default' | 'ghost' | 'outline';
  className?: string;
}

/**
 * Direct-print button using RawBT on Android (no app picker).
 * Falls back to window.print() on other platforms.
 */
export default function PrintButton({
  lines,
  label = 'RawBT',
  variant = 'outline',
  className,
}: Props) {
  const { printReceipt, isPrinting } = usePrinter();

  return (
    <Button
      variant={variant}
      onClick={() => printReceipt(lines)}
      disabled={isPrinting}
      className={`h-12 flex-col gap-1 ${className || ''}`}
    >
      {isPrinting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
      <span className="text-[10px]">{label}</span>
    </Button>
  );
}
