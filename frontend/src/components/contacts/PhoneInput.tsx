import { forwardRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

// Simple phone formatting function
function formatPhoneNumber(value: string): string {
  // Remove all non-numeric characters except +
  const cleaned = value.replace(/[^\d+]/g, '');

  // If starts with +, keep it
  if (cleaned.startsWith('+')) {
    // Brazilian format: +55 11 99999-9999
    const numbers = cleaned.slice(1);
    if (numbers.length <= 2) {
      return `+${numbers}`;
    } else if (numbers.length <= 4) {
      return `+${numbers.slice(0, 2)} ${numbers.slice(2)}`;
    } else if (numbers.length <= 9) {
      return `+${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4)}`;
    } else {
      return `+${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4, 9)}-${numbers.slice(9, 13)}`;
    }
  }

  // Without +, assume local format
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 7) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  } else {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  }
}

// Get only digits and + from phone
function getPhoneDigits(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

// Validate international phone format
function isValidPhone(value: string): boolean {
  const digits = getPhoneDigits(value);
  // International format: starts with + and has at least 10 digits
  if (digits.startsWith('+')) {
    return digits.length >= 11 && digits.length <= 16;
  }
  // Local format: at least 10 digits
  return digits.length >= 10 && digits.length <= 11;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = '', onChange, error, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(() => formatPhoneNumber(value));
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
      setDisplayValue(formatPhoneNumber(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const formatted = formatPhoneNumber(rawValue);
      setDisplayValue(formatted);
      setIsValid(rawValue === '' || isValidPhone(rawValue));

      const digits = getPhoneDigits(rawValue);
      onChange?.(digits.startsWith('+') ? digits : `+55${digits}`);
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="tel"
          value={displayValue}
          onChange={handleChange}
          placeholder="+55 11 99999-9999"
          className={cn(
            !isValid && 'border-destructive focus-visible:ring-destructive',
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          {...props}
        />
        {!isValid && displayValue && (
          <p className="text-xs text-destructive mt-1">
            Formato inválido. Use: +55 11 99999-9999
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export { isValidPhone, getPhoneDigits };
