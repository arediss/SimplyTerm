import type { TFunction } from "i18next";

interface AutoLockOption {
  value: number;
  label: string;
}

export function getAutoLockOptions(t: TFunction): AutoLockOption[] {
  return [
    { value: 0, label: t("settings.security.autoLockNever") },
    { value: 60, label: t("settings.security.autoLock1min") },
    { value: 300, label: t("settings.security.autoLock5min") },
    { value: 600, label: t("settings.security.autoLock10min") },
    { value: 1800, label: t("settings.security.autoLock30min") },
    { value: 3600, label: t("settings.security.autoLock1hour") },
  ];
}
