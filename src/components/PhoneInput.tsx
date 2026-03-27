import { forwardRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { applyPhoneMask, isValidPhone, phoneDigits } from '@/lib/masks';
import { cn } from '@/lib/utils';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  showError?: boolean;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, showError, className, onBlur, ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const digits = phoneDigits(value);
    const hasError = touched && digits.length > 0 && !isValidPhone(value);
    const showValidationError = showError !== undefined ? showError : hasError;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(applyPhoneMask(e.target.value));
    };

    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onBlur={(e) => { setTouched(true); onBlur?.(e); }}
          className={cn(
            showValidationError && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          {...props}
        />
        {showValidationError && (
          <p className="text-xs text-destructive">Celular inválido. Use o formato (11) 99999-9999</p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
export default PhoneInput;
