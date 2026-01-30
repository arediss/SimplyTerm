import { useState } from 'react';
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
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }
    if (masterPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
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
        setError('Les PINs ne correspondent pas');
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
      setError(result.error || 'Erreur lors de la création du vault');
    }
  };

  const autoLockOptions = [
    { value: 0, label: 'Jamais' },
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 heure' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Configuration du Vault" width="md">
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
                  Protégez vos connexions
                </h3>
                <p className="text-sm text-text-muted max-w-sm">
                  Le vault chiffre et stocke vos mots de passe localement.
                  Vous pourrez vous reconnecter à vos serveurs sans les ressaisir.
                </p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-surface-0/20 rounded-xl">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text">Chiffrement AES-256</p>
                  <p className="text-xs text-text-muted">Vos secrets ne quittent jamais votre machine</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text">Déverrouillage rapide</p>
                  <p className="text-xs text-text-muted">Code PIN optionnel pour un accès facile</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep('password')}
                className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors"
              >
                Configurer le vault
              </button>

              {canSkip && (
                <button
                  onClick={handleSkip}
                  className="w-full py-2.5 text-text-muted text-sm hover:text-text transition-colors"
                >
                  Passer pour l'instant
                </button>
              )}
            </div>

            {canSkip && (
              <p className="text-xs text-text-muted/70 text-center">
                Sans vault, les mots de passe ne seront pas sauvegardés.
                Vous pourrez le configurer plus tard dans les paramètres.
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
                Créez un mot de passe principal pour protéger vos credentials.
                Vous en aurez besoin pour déverrouiller le vault.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-text-secondary">Mot de passe principal</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
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
                <span className="text-sm text-text-secondary">Confirmer le mot de passe</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmez votre mot de passe"
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
              Continuer
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
                    ? 'Entrez un code PIN (4-6 chiffres) pour un déverrouillage rapide.'
                    : 'Confirmez votre code PIN.'
                  : 'Configurez un code PIN pour déverrouiller rapidement le vault.'}
              </p>
            </div>

            {!enablePin ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setEnablePin(true)}
                  className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors"
                >
                  Configurer un code PIN
                </button>
                <button
                  onClick={handlePinSkip}
                  className="w-full py-3 bg-surface-0/50 text-text-secondary font-medium rounded-xl hover:bg-surface-0 transition-colors"
                >
                  Passer cette étape
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
                  Annuler
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
                Configurez le verrouillage automatique pour sécuriser vos credentials.
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">Verrouillage automatique après</span>
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
              <h4 className="text-sm font-medium text-text mb-2">Récapitulatif</h4>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>Mot de passe principal configuré</li>
                <li>{enablePin && pin ? 'Code PIN configuré' : 'Code PIN non configuré'}</li>
                <li>Verrouillage auto: {autoLockOptions.find(o => o.value === autoLockTimeout)?.label}</li>
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
                Retour
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Création...' : 'Créer le vault'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default VaultSetupModal;
