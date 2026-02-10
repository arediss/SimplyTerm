import { useState, useRef, useEffect } from 'react';

export function useAutoHideSuccess(delay = 2000): [boolean, (onComplete?: () => void) => void] {
  const [success, setSuccess] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const trigger = (onComplete?: () => void) => {
    setSuccess(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setSuccess(false);
      onComplete?.();
    }, delay);
  };

  return [success, trigger];
}
