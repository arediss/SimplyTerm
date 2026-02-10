import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  icon,
  disabled,
  autoFocus,
  className,
}: Readonly<PasswordInputProps>) {
  const [show, setShow] = useState<boolean>(false);

  return (
    <div className={`relative ${className ?? ''}`}>
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted">
          {icon}
        </div>
      )}
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full ${icon ? 'pl-10' : 'px-4'} pr-10 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent${disabled ? ' disabled:opacity-50' : ''}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
