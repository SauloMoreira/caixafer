import { forwardRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { isValidEmail } from '@/lib/masks';
import { cn } from '@/lib/utils';

interface EmailInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  showError?: boolean;
}

const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(
  ({ value, onChange, showError, className, onBlur, ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const hasError = touched && value.trim().length > 0 && !isValidEmail(value);
    const showValidationError = showError !== undefined ? showError : hasError;

    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={(e) => { setTouched(true); onBlur?.(e); }}
          className={cn(
            showValidationError && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          {...props}
        />
        {showValidationError && (
          <p className="text-xs text-destructive">E-mail inválido. Verifique o formato.</p>
        )}
      </div>
    );
  }
);

EmailInput.displayName = 'EmailInput';
export default EmailInput;
