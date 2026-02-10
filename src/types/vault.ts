/**
 * Types for the vault system
 */

/** Available unlock methods for the vault */
export type UnlockMethod = 'master_password' | 'pin' | 'biometric' | 'security_key';

/** Vault status returned by the backend */
export interface VaultStatus {
  /** Whether the vault exists on disk */
  exists: boolean;
  /** Whether the vault is currently unlocked */
  isUnlocked: boolean;
  /** Configured unlock methods */
  unlockMethods: UnlockMethod[];
  /** Auto-lock timeout in seconds (0 = never) */
  autoLockTimeout: number;
  /** Remaining PIN attempts (if PIN is configured and vault is locked) */
  pinAttemptsRemaining?: number;
  /** PIN length (if PIN is configured) */
  pinLength?: number;
  /** Require vault unlock on each SSH connection (maximum security mode) */
  requireUnlockOnConnect: boolean;
  /** Whether biometric auth is available on this platform */
  biometricAvailable: boolean;
  /** Type of biometric available (windows_hello, touch_id, none) */
  biometricType?: string;
}

/** Vault creation options */
export interface VaultCreateOptions {
  masterPassword: string;
  autoLockTimeout: number;
  pin?: string;
}

/** Information about a detected FIDO2 security key */
export interface SecurityKeyInfo {
  /** Product name */
  productName: string;
  /** Manufacturer identifier */
  manufacturer: string;
  /** Device path/identifier */
  devicePath: string;
  /** Whether the key has a PIN configured */
  hasPin: boolean;
}
