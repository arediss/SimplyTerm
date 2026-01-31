/**
 * Status Bar Types
 */

export type StatusBarItemPosition = "left" | "center" | "right";

export interface StatusBarItem {
  id: string;
  content: React.ReactNode;
  position: StatusBarItemPosition;
  priority?: number; // Higher = more to the edge
  onClick?: () => void;
  tooltip?: string;
}

export interface StatusBarProps {
  visible: boolean;
  items?: StatusBarItem[];
  // Vault status
  vaultConfigured: boolean;
  vaultLocked: boolean;
  onVaultClick: () => void;
}
