import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Key, KeyRound } from "lucide-react";
import { useVault } from "../../hooks/useVault";
import SshKeyManager from "../SshKeyManager";
import { SubTabs } from "./SettingsUIComponents";
import InlineVaultSetup from "./InlineVaultSetup";
import VaultStatusSection from "./VaultStatusSection";
import AuthenticationSection from "./AuthenticationSection";
import PasswordChangeSection from "./PasswordChangeSection";

export default function SecuritySettings() {
  const { t } = useTranslation();
  const vault = useVault();
  const [securityTab, setSecurityTab] = useState<"vault" | "sshKeys" | "auth">("vault");

  // Skeleton loader while vault status is being fetched
  if (vault.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex gap-1 p-1 bg-crust rounded-xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-9 bg-surface-0/20 rounded-lg" />
          ))}
        </div>
        <div className="space-y-4">
          <div>
            <div className="h-4 w-32 bg-surface-0/20 rounded" />
            <div className="h-3 w-56 bg-surface-0/10 rounded mt-1.5" />
          </div>
          <div className="h-20 bg-surface-0/15 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="h-4 w-24 bg-surface-0/20 rounded" />
            <div className="h-3 w-44 bg-surface-0/10 rounded mt-1.5" />
          </div>
          <div className="h-12 bg-surface-0/15 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!vault.status?.exists) {
    return <InlineVaultSetup vault={vault} />;
  }

  return (
    <div className="space-y-6">
      <SubTabs
        tabs={[
          { id: "vault" as const, label: t("settings.security.tabVault"), icon: <Shield size={14} /> },
          { id: "sshKeys" as const, label: t("settings.security.tabSshKeys"), icon: <Key size={14} /> },
          { id: "auth" as const, label: t("settings.security.tabAuthentication"), icon: <KeyRound size={14} /> },
        ]}
        activeTab={securityTab}
        onChange={setSecurityTab}
      />

      {securityTab === "vault" && <VaultStatusSection vault={vault} />}

      {securityTab === "sshKeys" && (
        <SshKeyManager isVaultUnlocked={vault.status?.isUnlocked || false} />
      )}

      {securityTab === "auth" && (
        <>
          <AuthenticationSection vault={vault} />
          <PasswordChangeSection vault={vault} />
        </>
      )}
    </div>
  );
}
