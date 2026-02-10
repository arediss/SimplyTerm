import { useState, useRef, useEffect, useCallback } from 'react';

interface PinInputProps {
  /** Number of digits (4-6) */
  length?: number;
  /** Called when PIN is complete */
  onComplete: (pin: string) => void;
  /** Error message to display */
  error?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export function PinInput({
  length = 4,
  onComplete,
  error,
  disabled = false,
  autoFocus = true,
}: PinInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Reset digits when error changes (wrong PIN)
  useEffect(() => {
    if (error) {
      setDigits(Array(length).fill(''));
      inputRefs.current[0]?.focus();
    }
  }, [error, length]);

  const handleChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // Move to next input if digit entered
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if PIN is complete
    if (digit && index === length - 1) {
      const pin = newDigits.join('');
      if (pin.length === length) {
        onComplete(pin);
      }
    }
  }, [digits, length, onComplete]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits, length]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (paste.length > 0) {
      const newDigits = Array(length).fill('');
      for (let i = 0; i < paste.length; i++) {
        newDigits[i] = paste[i];
      }
      setDigits(newDigits);

      // Focus the next empty input or the last one
      const nextEmptyIndex = newDigits.findIndex(d => !d);
      if (nextEmptyIndex >= 0) {
        inputRefs.current[nextEmptyIndex]?.focus();
      } else {
        inputRefs.current[length - 1]?.focus();
        // PIN is complete
        onComplete(paste.slice(0, length));
      }
    }
  }, [length, onComplete]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`
              w-12 h-14 text-center text-2xl font-mono
              bg-surface-0/30 border rounded-xl
              text-text placeholder-text-muted/30
              focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              ${error ? 'border-error/50 animate-shake' : 'border-surface-0/50'}
            `}
            aria-label={`PIN digit ${index + 1}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-error animate-fade-in">{error}</p>
      )}
    </div>
  );
}

export default PinInput;
