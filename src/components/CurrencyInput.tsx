import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
}

/** Format a numeric string (e.g. "12.5") into BRL display ("12,50") */
export function formatToBRL(raw: string): string {
  if (!raw) return '';
  const num = parseFloat(raw);
  if (isNaN(num)) return '';
  return num.toFixed(2).replace('.', ',');
}

/** Parse a BRL display string ("12,50") back to a plain number string ("12.50") */
export function parseBRL(display: string): string {
  // Remove everything except digits and comma
  const cleaned = display.replace(/[^\d,]/g, '');
  if (!cleaned) return '';
  return cleaned.replace(',', '.');
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, ...props }, ref) => {
    const [display, setDisplay] = React.useState(() => formatToBRL(value));

    // Sync display when external value changes (e.g. editing existing product)
    React.useEffect(() => {
      setDisplay(formatToBRL(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;
      // Allow only digits and one comma
      raw = raw.replace(/[^\d,]/g, '');
      // Ensure only one comma
      const parts = raw.split(',');
      if (parts.length > 2) {
        raw = parts[0] + ',' + parts.slice(1).join('');
      }
      // Limit to 2 decimal places
      if (parts.length === 2 && parts[1].length > 2) {
        raw = parts[0] + ',' + parts[1].slice(0, 2);
      }
      setDisplay(raw);
      onValueChange(parseBRL(raw));
    };

    const handleBlur = () => {
      // Format on blur
      if (value) {
        setDisplay(formatToBRL(value));
      }
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          R$
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          className={cn('pl-9', className)}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export default CurrencyInput;
