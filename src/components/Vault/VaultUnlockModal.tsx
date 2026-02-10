import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, KeyRound, AlertTriangle, Key, Loader2 } from 'lucide-react';
import { PasswordInput } from '../UI/PasswordInput';
import Modal from '../Modal';
import PinInput from './PinInput';
import type { UnlockMethod } from '../../types/vault';

interface VaultUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockMethods: UnlockMethod[];
  pinAttemptsRemaining?: number;
  pinLength?: number;
  onUnlockWithPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  onUnlockWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  onUnlockWithSecurityKey?: (pin?: string) => Promise<{ success: boolean; error?: string }>;
}

type UnlockMode = 'pin' | 'password' | 'security_key';

export function VaultUnlockModal({
  isOpen,
  onClose,
  unlockMethods,
  pinAttemptsRemaining,
  pinLength = 4,
  onUnlockWithPassword,
  onUnlockWithPin,
  onUnlockWithSecurityKey,
}: Readonly<VaultUnlockModalProps>) {
  const { t } = useTranslation();
  const hasPin = unlockMethods.includes('pin');
  const hasSecurityKey = unlockMethods.includes('security_key');
  const pinLocked = hasPin && pinAttemptsRemaining === 0;

  // Determine default mode: Security Key > PIN > Password
  const getDefaultMode = (): UnlockMode => {
    if (hasSecurityKey) return 'security_key';
    if (hasPin && !pinLocked) return 'pin';
    return 'password';
  };

  const [mode, setMode] = useState<UnlockMode>(getDefaultMode());
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset mode when methods or pin status changes
  useEffect(() => {
    setMode(getDefaultMode());
  }, [hasPin, hasSecurityKey, pinLocked]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await onUnlockWithPassword(password);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || t('vault.unlock.incorrectPassword'));
      setPassword('');
    }
  };

  const handlePinComplete = async (pin: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await onUnlockWithPin(pin);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || t('vault.unlock.incorrectPin'));
    }
  };

  const handleSecurityKeyUnlock = async () => {
    if (isSubmitting || !onUnlockWithSecurityKey) return;

    setIsSubmitting(true);
    setError(null);

    const result = await onUnlockWithSecurityKey();

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || t('vault.unlock.touchSecurityKey'));
    }
  };

  // Count available methods for tab display
  const methodCount = [hasSecurityKey, hasPin && !pinLocked, true].filter(Boolean).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('vault.unlock.title')} width="sm">
      <div className="flex flex-col gap-6">
        {/* PIN locked warning */}
        {pinLocked && (
          <div className="flex items-center gap-3 p-4 bg-error/10 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
            <p className="text-sm text-error">
              {t('vault.unlock.pinLocked')}
            </p>
          </div>
        )}

        {/* Mode tabs */}
        {methodCount > 1 && (
          <div className="flex bg-surface-0/30 rounded-xl p-1">
            {hasSecurityKey && (
              <button
                onClick={() => { setMode('security_key'); setError(null); }}
                className={`
                  flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                  ${mode === 'security_key'
                    ? 'bg-accent text-crust'
                    : 'text-text-secondary hover:text-text'}
                `}
              >
                <Key size={16} className="inline mr-1" />
                {t('vault.unlock.fido2Key')}
              </button>
            )}
            {hasPin && !pinLocked && (
              <button
                onClick={() => { setMode('pin'); setError(null); }}
                className={`
                  flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                  ${mode === 'pin'
                    ? 'bg-accent text-crust'
                    : 'text-text-secondary hover:text-text'}
                `}
              >
                <KeyRound size={16} className="inline mr-1" />
                {t('vault.unlock.pin')}
              </button>
            )}
            <button
              onClick={() => { setMode('password'); setError(null); }}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                ${mode === 'password'
                  ? 'bg-accent text-crust'
                  : 'text-text-secondary hover:text-text'}
              `}
            >
              <Lock size={16} className="inline mr-1" />
              {t('vault.unlock.password')}
            </button>
          </div>
        )}

        {/* Security Key input */}
        {mode === 'security_key' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
              <Key size={32} className="text-accent" />
            </div>
            <p className="text-sm text-text-muted text-center">
              {t('vault.unlock.insertSecurityKey')}
            </p>

            {error && (
              <p className="text-sm text-error text-center">{error}</p>
            )}

            <button
              onClick={handleSecurityKeyUnlock}
              disabled={isSubmitting}
              className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('vault.unlock.touchingKey')}
                </>
              ) : (
                t('vault.unlock.unlockWithFido2')
              )}
            </button>
          </div>
        )}

        {/* PIN input */}
        {mode === 'pin' && !pinLocked && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-text-muted text-center">
              {t('vault.unlock.enterPin')}
            </p>

            <PinInput
              length={pinLength}
              onComplete={handlePinComplete}
              error={error || undefined}
              disabled={isSubmitting}
              autoFocus
            />

            {pinAttemptsRemaining !== undefined && pinAttemptsRemaining < 3 && (
              <p className="text-sm text-warning">
                {t('vault.unlock.attemptsRemaining', { count: pinAttemptsRemaining })}
              </p>
            )}
          </div>
        )}

        {/* Password input */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">{t('vault.unlock.masterPassword')}</span>
              <PasswordInput
                icon={<Lock size={16} />}
                value={password}
                onChange={setPassword}
                placeholder={t('vault.unlock.enterPassword')}
                autoFocus={mode === 'password'}
                disabled={isSubmitting}
              />
            </label>

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={!password || isSubmitting}
              className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('vault.unlock.unlocking') : t('vault.unlock.unlock')}
            </button>
          </form>
        )}

        {/* Skip option */}
        <div className="pt-2 border-t border-surface-0/30">
          <button
            onClick={onClose}
            className="w-full py-2 text-text-muted text-sm hover:text-text transition-colors"
          >
            {t('vault.unlock.continueWithout')}
          </button>
          <p className="text-xs text-text-muted/60 text-center mt-2">
            {t('vault.unlock.passwordsUnavailable')}
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default VaultUnlockModal;
