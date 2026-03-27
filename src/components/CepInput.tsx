import { Input } from '@/components/ui/input';
import { applyCepMask } from '@/lib/masks';

interface CepInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CepInput({ value, onChange, placeholder = '00000-000', className, disabled }: CepInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(applyCepMask(e.target.value));
  };

  return (
    <Input
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      inputMode="numeric"
      maxLength={9}
      disabled={disabled}
    />
  );
}
