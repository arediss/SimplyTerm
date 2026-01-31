import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, KeyRound, Shield } from 'lucide-react';
import Modal from '../Modal';
import PinInput from './PinInput';

interface VaultSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetup: (masterPassword: string, autoLockTimeout: number, pin?: string) => Promise<{ success: boolean; error?: string }>;
  onSkip?: () => void;
  canSkip?: boolean;
}

type SetupStep = 'intro' | 'password' | 'pin' | 'settings';

export function VaultSetupModal({ isOpen, onClose, onSetup, onSkip, canSkip = true }: VaultSetupModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<SetupStep>('intro');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [enablePin, setEnablePin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [autoLockTimeout, setAutoLockTimeout] = useState(300); // 5 minutes
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setStep('intro');
    setMasterPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setEnablePin(false);
    setPin('');
    setPinStep('enter');
    setAutoLockTimeout(300);
    setError(null);
    setIsSubmitting(false);
  };

  const handleSkip = () => {
    resetForm();
    onSkip?.();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validatePassword = () => {
    if (masterPassword.length < 8) {
      setError(t('vault.setup.passwordTooShort'));
      return false;
    }
    if (masterPassword !== confirmPassword) {
      setError(t('vault.setup.passwordMismatch'));
      return false;
    }
    return true;
  };

  const handlePasswordNext = () => {
    if (!validatePassword()) return;
    setError(null);
    setStep('pin');
  };

  const handlePinComplete = (enteredPin: string) => {
    if (pinStep === 'enter') {
      setPin(enteredPin);
      setPinStep('confirm');
    } else {
      if (enteredPin !== pin) {
        setError(t('vault.setup.pinMismatch'));
        setPin('');
        setPinStep('enter');
        return;
      }
      setError(null);
      setStep('settings');
    }
  };

  const handlePinSkip = () => {
    setEnablePin(false);
    setPin('');
    setStep('settings');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const result = await onSetup(
      masterPassword,
      autoLockTimeout,
      enablePin && pin ? pin : undefined
    );

    setIsSubmitting(false);

    if (result.success) {
      resetForm();
    } else {
      setError(result.error || t('vault.setup.creationError'));
    }
  };

  const autoLockOptions = [
    { value: 0, label: t('settings.security.autoLockNever') },
    { value: 60, label: t('settings.security.autoLock1min') },
    { value: 300, label: t('settings.security.autoLock5min') },
    { value: 600, label: t('settings.security.autoLock10min') },
    { value: 1800, label: t('settings.security.autoLock30min') },
    { value: 3600, label: t('settings.security.autoLock1hour') },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('vault.setup.title')} width="md">
      <div className="flex flex-col gap-6">
        {/* Progress indicator - only show after intro */}
        {step !== 'intro' && (
          <div className="flex items-center justify-center gap-2">
            {['password', 'pin', 'settings'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-colors
                    ${step === s ? 'bg-accent text-crust' :
                      ['password', 'pin', 'settings'].indexOf(step) > i
                        ? 'bg-accent/30 text-accent'
                        : 'bg-surface-0/30 text-text-muted'}
                  `}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div className={`w-8 h-0.5 ${
                    ['password', 'pin', 'settings'].indexOf(step) > i
                      ? 'bg-accent/30'
                      : 'bg-surface-0/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step: Intro */}
        {step === 'intro' && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text mb-2">
                  {t('vault.setup.introTitle')}
                </h3>
                <p className="text-sm text-text-muted max-w-sm">
                  {t('vault.setup.introDesc')}
                </p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-surface-0/20 rounded-xl">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text">{t('vault.setup.encryptionTitle')}</p>
                  <p className="text-xs text-text-muted">{t('vault.setup.encryptionDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text">{t('vault.setup.quickUnlockTitle')}</p>
                  <p className="text-xs text-text-muted">{t('vault.setup.quickUnlockDesc')}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep('password')}
                className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors"
              >
                {t('vault.setup.configureVault')}
              </button>

              {canSkip && (
                <button
                  onClick={handleSkip}
                  className="w-full py-2.5 text-text-muted text-sm hover:text-text transition-colors"
                >
                  {t('vault.setup.skipForNow')}
                </button>
              )}
            </div>

            {canSkip && (
              <p className="text-xs text-text-muted/70 text-center">
                {t('vault.setup.skipWarning')}
              </p>
            )}
          </div>
        )}

        {/* Step: Password */}
        {step === 'password' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-xl">
              <Shield className="w-5 h-5 text-accent flex-shrink-0" />
              <p className="text-sm text-text-secondary">
                {t('vault.setup.passwordInfo')}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-text-secondary">{t('vault.setup.masterPassword')}</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder={t('vault.setup.passwordPlaceholder')}
                    className="w-full pl-10 pr-10 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-text-secondary">{t('vault.setup.confirmPassword')}</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('vault.setup.confirmPlaceholder')}
                    className="w-full pl-10 pr-10 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            </div>

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <button
              onClick={handlePasswordNext}
              disabled={!masterPassword || !confirmPassword}
              className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.continue')}
            </button>
          </div>
        )}

        {/* Step: PIN */}
        {step === 'pin' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-xl">
              <KeyRound className="w-5 h-5 text-accent flex-shrink-0" />
              <p className="text-sm text-text-secondary">
                {enablePin
                  ? pinStep === 'enter'
                    ? t('vault.setup.pinInfoEnter')
                    : t('vault.setup.pinInfoConfirm')
                  : t('vault.setup.pinInfoDisabled')}
              </p>
            </div>

            {!enablePin ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setEnablePin(true)}
                  className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors"
                >
                  {t('vault.setup.setupPin')}
                </button>
                <button
                  onClick={handlePinSkip}
                  className="w-full py-3 bg-surface-0/50 text-text-secondary font-medium rounded-xl hover:bg-surface-0 transition-colors"
                >
                  {t('vault.setup.skipStep')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <PinInput
                  length={4}
                  onComplete={handlePinComplete}
                  error={error || undefined}
                  autoFocus
                />
                <button
                  onClick={handlePinSkip}
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: Settings */}
        {step === 'settings' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-xl">
              <Shield className="w-5 h-5 text-accent flex-shrink-0" />
              <p className="text-sm text-text-secondary">
                {t('vault.setup.settingsInfo')}
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">{t('vault.setup.autoLockLabel')}</span>
              <select
                value={autoLockTimeout}
                onChange={(e) => setAutoLockTimeout(Number(e.target.value))}
                className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {autoLockOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <div className="p-4 bg-surface-0/20 rounded-xl">
              <h4 className="text-sm font-medium text-text mb-2">{t('vault.setup.summaryTitle')}</h4>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>{t('vault.setup.passwordConfigured')}</li>
                <li>{enablePin && pin ? t('vault.setup.pinConfigured') : t('vault.setup.pinNotConfigured')}</li>
                <li>{t('vault.setup.autoLockSummary', { timeout: autoLockOptions.find(o => o.value === autoLockTimeout)?.label })}</li>
              </ul>
            </div>

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('pin')}
                className="flex-1 py-3 bg-surface-0/50 text-text-secondary font-medium rounded-xl hover:bg-surface-0 transition-colors"
              >
                {t('common.back')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('vault.setup.creating') : t('vault.setup.createVault')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default VaultSetupModal;
