/**
 * Static permission metadata map (mirrors Rust Permission::description() and Permission::risk_level())
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PermissionInfo {
  label: string;
  description: string;
  risk: RiskLevel;
}

export const permissionInfoMap: Record<string, PermissionInfo> = {
  // Sessions
  sessions_read: {
    label: 'Sessions Read',
    description: 'Read saved sessions and their configuration',
    risk: 'low',
  },
  sessions_write: {
    label: 'Sessions Write',
    description: 'Create, modify, and delete saved sessions',
    risk: 'medium',
  },
  sessions_connect: {
    label: 'Sessions Connect',
    description: 'Initiate connections to remote hosts',
    risk: 'high',
  },
  sessions_metadata_read: {
    label: 'Session Metadata Read',
    description: 'Read plugin-specific session metadata',
    risk: 'low',
  },
  sessions_metadata_write: {
    label: 'Session Metadata Write',
    description: 'Write plugin-specific session metadata',
    risk: 'medium',
  },

  // Folders
  folders_read: {
    label: 'Folders Read',
    description: 'Read folder organization structure',
    risk: 'low',
  },
  folders_write: {
    label: 'Folders Write',
    description: 'Create, modify, and delete folders',
    risk: 'medium',
  },

  // Vault
  vault_status: {
    label: 'Vault Status',
    description: 'Check if the secure vault is locked or unlocked',
    risk: 'low',
  },
  vault_read: {
    label: 'Vault Read',
    description: 'Read encrypted data from the secure vault',
    risk: 'high',
  },
  vault_write: {
    label: 'Vault Write',
    description: 'Store encrypted data in the secure vault',
    risk: 'high',
  },

  // Settings
  settings_read: {
    label: 'Settings Read',
    description: 'Read application settings and preferences',
    risk: 'low',
  },
  settings_write: {
    label: 'Settings Write',
    description: 'Modify application settings and preferences',
    risk: 'medium',
  },

  // Recent
  recent_read: {
    label: 'Recent Read',
    description: 'Read recently used sessions history',
    risk: 'low',
  },
  recent_write: {
    label: 'Recent Write',
    description: 'Modify recently used sessions history',
    risk: 'medium',
  },

  // Events
  events_subscribe: {
    label: 'Events Subscribe',
    description: 'Listen to application events',
    risk: 'low',
  },
  events_emit: {
    label: 'Events Emit',
    description: 'Send custom events to other plugins',
    risk: 'medium',
  },

  // Shell
  shell_execute: {
    label: 'Shell Execute',
    description: 'Execute shell commands on the local system',
    risk: 'high',
  },

  // Network
  network_http: {
    label: 'Network HTTP',
    description: 'Make HTTP/HTTPS requests to remote servers',
    risk: 'medium',
  },
  network_websocket: {
    label: 'Network WebSocket',
    description: 'Establish WebSocket connections',
    risk: 'medium',
  },

  // File System
  fs_read: {
    label: 'File System Read',
    description: 'Read files from plugin data directory',
    risk: 'low',
  },
  fs_write: {
    label: 'File System Write',
    description: 'Write files to plugin data directory',
    risk: 'medium',
  },

  // UI
  ui_menu: {
    label: 'UI Menu',
    description: 'Add items to application menus',
    risk: 'medium',
  },
  ui_notifications: {
    label: 'UI Notifications',
    description: 'Display system notifications',
    risk: 'medium',
  },
  ui_settings: {
    label: 'UI Settings',
    description: 'Add a settings panel in preferences',
    risk: 'medium',
  },
  ui_panels: {
    label: 'UI Panels',
    description: 'Register custom panels in the interface',
    risk: 'medium',
  },
  ui_commands: {
    label: 'UI Commands',
    description: 'Register commands in the command palette',
    risk: 'medium',
  },
  ui_modals: {
    label: 'UI Modals',
    description: 'Display modal dialogs',
    risk: 'medium',
  },
  ui_sidebar: {
    label: 'UI Sidebar',
    description: 'Register sections in the sidebar',
    risk: 'medium',
  },
  ui_context_menu: {
    label: 'UI Context Menu',
    description: 'Add items to context menus',
    risk: 'medium',
  },

  // Terminal
  terminal_read: {
    label: 'Terminal Read',
    description: 'Read terminal output',
    risk: 'medium',
  },
  terminal_write: {
    label: 'Terminal Write',
    description: 'Write data to terminal sessions',
    risk: 'high',
  },

  // Clipboard
  clipboard_read: {
    label: 'Clipboard Read',
    description: 'Read content from system clipboard',
    risk: 'medium',
  },
  clipboard_write: {
    label: 'Clipboard Write',
    description: 'Write content to system clipboard',
    risk: 'medium',
  },

  // Bastions
  bastions_read: {
    label: 'Bastions Read',
    description: 'Read bastion/jump host profiles',
    risk: 'low',
  },
  bastions_write: {
    label: 'Bastions Write',
    description: 'Create, modify, and delete bastion profiles',
    risk: 'medium',
  },

  // Known Hosts
  known_hosts_read: {
    label: 'Known Hosts Read',
    description: 'Read SSH known hosts entries',
    risk: 'low',
  },
  known_hosts_write: {
    label: 'Known Hosts Write',
    description: 'Manage SSH known hosts entries',
    risk: 'medium',
  },

  // Vault Sync
  vault_export_encrypted: {
    label: 'Vault Export',
    description: 'Export the encrypted vault bundle for sync or backup',
    risk: 'medium',
  },
  vault_import_encrypted: {
    label: 'Vault Import',
    description: 'Import and overwrite the encrypted vault bundle',
    risk: 'medium',
  },
};

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

export function getPermissionInfo(permission: string): PermissionInfo {
  return permissionInfoMap[permission] ?? {
    label: permission,
    description: `Permission: ${permission}`,
    risk: 'medium' as RiskLevel,
  };
}

export function sortPermissionsByRisk(permissions: string[]): string[] {
  return [...permissions].sort((a, b) => {
    const riskA = RISK_ORDER[getPermissionInfo(a).risk];
    const riskB = RISK_ORDER[getPermissionInfo(b).risk];
    return riskA - riskB;
  });
}
