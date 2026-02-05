# SimplyTerm Plugin Examples

> Ready-to-use plugin examples for API v1

Copy these examples to your plugins directory to test them.

| OS | Path |
|---|---|
| Windows | `%APPDATA%\com.simplyterm.app\plugins\<name>\` |
| macOS | `~/Library/Application Support/com.simplyterm.app/plugins/<name>/` |
| Linux | `~/.local/share/com.simplyterm.app/plugins/<name>/` |

---

## Table of Contents

1. [Hello World](#1-hello-world) - Minimal plugin
2. [Session Counter](#2-session-counter) - Count sessions
3. [Config Backup](#3-config-backup) - Backup sessions and settings
4. [Connection Logger](#4-connection-logger) - Log connection events
5. [Vault Secrets Manager](#5-vault-secrets-manager) - Store encrypted secrets
6. [Auto Organizer](#6-auto-organizer) - Organize sessions into folders
7. [Confirmation Dialog](#7-confirmation-dialog) - Modal dialogs with button variants

---

## 1. Hello World

The simplest possible plugin using API v1.

### manifest.json
```json
{
  "id": "com.example.hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "A minimal plugin to get started",
  "main": "index.js",
  "permissions": ["sessions_read"]
}
```

### index.js
```javascript
const { invoke } = window.__TAURI__.core;

async function init(pluginId) {
  console.log('[HelloWorld] Initializing with plugin ID:', pluginId);

  try {
    // Read sessions (requires sessions_read permission)
    const sessions = await invoke('plugin_api_list_sessions', { pluginId });
    console.log('[HelloWorld] Found', sessions.length, 'sessions');

    // Log each session
    for (const session of sessions) {
      console.log('[HelloWorld] Session:', session.name, '->', session.host);
    }

    console.log('[HelloWorld] Ready!');
  } catch (error) {
    console.error('[HelloWorld] Error:', error);
  }
}

// Export the init function
window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.hello-world'] = { init };
```

---

## 2. Session Counter

Counts total sessions and displays statistics.

### manifest.json
```json
{
  "id": "com.example.session-counter",
  "name": "Session Counter",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "Count and analyze your sessions",
  "main": "index.js",
  "permissions": ["sessions_read", "folders_read", "fs_read", "fs_write"]
}
```

### index.js
```javascript
const { invoke } = window.__TAURI__.core;

async function init(pluginId) {
  console.log('[SessionCounter] Starting...');

  try {
    // Get all sessions
    const sessions = await invoke('plugin_api_list_sessions', { pluginId });

    // Get all folders
    const folders = await invoke('plugin_api_list_folders', { pluginId });

    // Calculate statistics
    const stats = {
      totalSessions: sessions.length,
      totalFolders: folders.length,
      byAuthType: {
        password: sessions.filter(s => s.authType === 'password').length,
        key: sessions.filter(s => s.authType === 'key').length
      },
      uniqueHosts: [...new Set(sessions.map(s => s.host))].length,
      timestamp: new Date().toISOString()
    };

    console.log('[SessionCounter] Statistics:', stats);

    // Save stats to plugin storage
    await invoke('plugin_storage_write', {
      pluginId,
      path: 'stats.json',
      content: JSON.stringify(stats, null, 2)
    });

    console.log('[SessionCounter] Stats saved to storage');

  } catch (error) {
    console.error('[SessionCounter] Error:', error);
  }
}

async function getStats(pluginId) {
  try {
    const content = await invoke('plugin_storage_read', {
      pluginId,
      path: 'stats.json'
    });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.session-counter'] = { init, getStats };
```

---

## 3. Config Backup

Backup and restore sessions, folders, and settings.

### manifest.json
```json
{
  "id": "com.example.config-backup",
  "name": "Config Backup",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "Backup and restore your configuration",
  "main": "index.js",
  "permissions": [
    "sessions_read",
    "sessions_write",
    "folders_read",
    "folders_write",
    "settings_read",
    "fs_read",
    "fs_write"
  ]
}
```

### index.js
```javascript
const { invoke } = window.__TAURI__.core;

async function init(pluginId) {
  console.log('[Backup] Plugin initialized');

  // Create initial backup on load
  await createBackup(pluginId);
}

async function createBackup(pluginId) {
  console.log('[Backup] Creating backup...');

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Collect all data
    const sessions = await invoke('plugin_api_list_sessions', { pluginId });
    const folders = await invoke('plugin_api_list_folders', { pluginId });
    const settings = await invoke('plugin_api_get_settings', { pluginId });

    const backup = {
      version: '1.0',
      timestamp,
      data: {
        sessions,
        folders,
        settings
      }
    };

    // Save backup file
    const filename = `backup-${timestamp}.json`;
    await invoke('plugin_storage_write', {
      pluginId,
      path: `backups/${filename}`,
      content: JSON.stringify(backup, null, 2)
    });

    console.log('[Backup] Created:', filename);
    console.log('[Backup] Sessions:', sessions.length);
    console.log('[Backup] Folders:', folders.length);

    return filename;

  } catch (error) {
    console.error('[Backup] Error:', error);
    throw error;
  }
}

async function listBackups(pluginId) {
  try {
    const files = await invoke('plugin_storage_list', {
      pluginId,
      path: 'backups'
    });

    return files
      .filter(f => f.name.endsWith('.json'))
      .sort((a, b) => b.modified - a.modified);

  } catch {
    return [];
  }
}

async function restoreBackup(pluginId, filename) {
  console.log('[Backup] Restoring from:', filename);

  try {
    // Read backup file
    const content = await invoke('plugin_storage_read', {
      pluginId,
      path: `backups/${filename}`
    });

    const backup = JSON.parse(content);
    let restored = { sessions: 0, folders: 0 };

    // Restore folders first (sessions may reference them)
    for (const folder of backup.data.folders) {
      try {
        await invoke('plugin_api_create_folder', {
          pluginId,
          name: folder.name,
          color: folder.color,
          parentId: folder.parentId
        });
        restored.folders++;
      } catch (e) {
        console.log('[Backup] Folder exists:', folder.name);
      }
    }

    // Restore sessions
    for (const session of backup.data.sessions) {
      try {
        await invoke('plugin_api_create_session', {
          pluginId,
          name: session.name,
          host: session.host,
          port: session.port,
          username: session.username,
          authType: session.authType,
          keyPath: session.keyPath,
          folderId: session.folderId,
          color: session.color
        });
        restored.sessions++;
      } catch (e) {
        console.log('[Backup] Session exists:', session.name);
      }
    }

    console.log('[Backup] Restored:', restored);
    return restored;

  } catch (error) {
    console.error('[Backup] Restore error:', error);
    throw error;
  }
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.config-backup'] = {
  init,
  createBackup,
  listBackups,
  restoreBackup
};
```

---

## 4. Connection Logger

Log session connection and disconnection events.

### manifest.json
```json
{
  "id": "com.example.connection-logger",
  "name": "Connection Logger",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "Log all connection events",
  "main": "index.js",
  "permissions": [
    "events_subscribe",
    "sessions_read",
    "fs_read",
    "fs_write"
  ]
}
```

### index.js
```javascript
const { invoke } = window.__TAURI__.core;

let pollInterval = null;

async function init(pluginId) {
  console.log('[Logger] Initializing...');

  try {
    // Subscribe to connection events
    await invoke('plugin_api_subscribe_events', {
      pluginId,
      events: ['session_connected', 'session_disconnected', 'tab_opened', 'tab_closed']
    });

    console.log('[Logger] Subscribed to events');

    // Start polling for events
    pollInterval = setInterval(() => pollEvents(pluginId), 1000);

  } catch (error) {
    console.error('[Logger] Init error:', error);
  }
}

async function pollEvents(pluginId) {
  try {
    const events = await invoke('plugin_api_get_events', { pluginId });

    for (const event of events) {
      await logEvent(pluginId, event);
    }

  } catch (error) {
    console.error('[Logger] Poll error:', error);
  }
}

async function logEvent(pluginId, event) {
  const logEntry = {
    timestamp: new Date(event.timestamp).toISOString(),
    event: event.event,
    source: event.source,
    data: event.data
  };

  console.log('[Logger]', logEntry);

  // Append to log file
  try {
    let logs = [];
    try {
      const content = await invoke('plugin_storage_read', {
        pluginId,
        path: 'connection-log.json'
      });
      logs = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    logs.unshift(logEntry);
    logs = logs.slice(0, 500); // Keep last 500 entries

    await invoke('plugin_storage_write', {
      pluginId,
      path: 'connection-log.json',
      content: JSON.stringify(logs, null, 2)
    });

  } catch (error) {
    console.error('[Logger] Save error:', error);
  }
}

async function getLogs(pluginId, limit = 50) {
  try {
    const content = await invoke('plugin_storage_read', {
      pluginId,
      path: 'connection-log.json'
    });
    const logs = JSON.parse(content);
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

async function clearLogs(pluginId) {
  await invoke('plugin_storage_write', {
    pluginId,
    path: 'connection-log.json',
    content: '[]'
  });
  console.log('[Logger] Logs cleared');
}

function cleanup() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[Logger] Stopped polling');
  }
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.connection-logger'] = {
  init,
  getLogs,
  clearLogs,
  cleanup
};
```

---

## 5. Vault Secrets Manager

Store and retrieve encrypted secrets from the vault.

### manifest.json
```json
{
  "id": "com.example.secrets-manager",
  "name": "Secrets Manager",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "Securely store API keys and secrets",
  "main": "index.js",
  "permissions": [
    "vault_status",
    "vault_read",
    "vault_write",
    "fs_read",
    "fs_write"
  ]
}
```

### index.js
```javascript
const { invoke } = window.__TAURI__.core;

async function init(pluginId) {
  console.log('[Secrets] Initializing...');

  const status = await checkVaultStatus(pluginId);
  console.log('[Secrets] Vault status:', status);

  if (!status.isUnlocked) {
    console.log('[Secrets] Vault is locked - waiting for unlock...');
  }
}

async function checkVaultStatus(pluginId) {
  try {
    return await invoke('plugin_api_vault_status', { pluginId });
  } catch (error) {
    console.error('[Secrets] Status error:', error);
    return { exists: false, isUnlocked: false };
  }
}

async function storeSecret(pluginId, key, value) {
  const status = await checkVaultStatus(pluginId);

  if (!status.isUnlocked) {
    throw new Error('Vault is locked');
  }

  try {
    await invoke('plugin_api_vault_store', {
      pluginId,
      key,
      value
    });
    console.log('[Secrets] Stored:', key);

    // Update key registry
    await updateKeyRegistry(pluginId, key, 'add');

    return true;
  } catch (error) {
    console.error('[Secrets] Store error:', error);
    throw error;
  }
}

async function getSecret(pluginId, key) {
  const status = await checkVaultStatus(pluginId);

  if (!status.isUnlocked) {
    throw new Error('Vault is locked');
  }

  try {
    const value = await invoke('plugin_api_vault_read', {
      pluginId,
      key
    });
    return value;
  } catch (error) {
    console.error('[Secrets] Read error:', error);
    return null;
  }
}

async function deleteSecret(pluginId, key) {
  try {
    const deleted = await invoke('plugin_api_vault_delete', {
      pluginId,
      key
    });

    if (deleted) {
      await updateKeyRegistry(pluginId, key, 'remove');
      console.log('[Secrets] Deleted:', key);
    }

    return deleted;
  } catch (error) {
    console.error('[Secrets] Delete error:', error);
    return false;
  }
}

async function listSecretKeys(pluginId) {
  try {
    const content = await invoke('plugin_storage_read', {
      pluginId,
      path: 'key-registry.json'
    });
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function updateKeyRegistry(pluginId, key, action) {
  let keys = await listSecretKeys(pluginId);

  if (action === 'add' && !keys.includes(key)) {
    keys.push(key);
  } else if (action === 'remove') {
    keys = keys.filter(k => k !== key);
  }

  await invoke('plugin_storage_write', {
    pluginId,
    path: 'key-registry.json',
    content: JSON.stringify(keys)
  });
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.secrets-manager'] = {
  init,
  checkVaultStatus,
  storeSecret,
  getSecret,
  deleteSecret,
  listSecretKeys
};
```

---

## 6. Auto Organizer

Automatically organize sessions into folders by hostname pattern.

### manifest.json
```json
{
  "id": "com.example.auto-organizer",
  "name": "Auto Organizer",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "Organize sessions into folders by pattern",
  "main": "index.js",
  "permissions": [
    "sessions_read",
    "sessions_write",
    "folders_read",
    "folders_write",
    "fs_read",
    "fs_write"
  ]
}
```

### index.js
```javascript
const { invoke } = window.__TAURI__.core;

// Default organization rules
const DEFAULT_RULES = [
  { pattern: 'prod', folder: 'Production', color: '#e88b8b' },
  { pattern: 'staging', folder: 'Staging', color: '#e8c878' },
  { pattern: 'dev', folder: 'Development', color: '#9cd68d' },
  { pattern: 'db', folder: 'Databases', color: '#7da6e8' },
  { pattern: 'web', folder: 'Web Servers', color: '#c49de8' }
];

async function init(pluginId) {
  console.log('[Organizer] Initializing...');

  // Load or create rules
  let rules = await loadRules(pluginId);
  if (rules.length === 0) {
    rules = DEFAULT_RULES;
    await saveRules(pluginId, rules);
  }

  console.log('[Organizer] Loaded', rules.length, 'rules');
}

async function loadRules(pluginId) {
  try {
    const content = await invoke('plugin_storage_read', {
      pluginId,
      path: 'rules.json'
    });
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveRules(pluginId, rules) {
  await invoke('plugin_storage_write', {
    pluginId,
    path: 'rules.json',
    content: JSON.stringify(rules, null, 2)
  });
}

async function organize(pluginId) {
  console.log('[Organizer] Starting organization...');

  const rules = await loadRules(pluginId);
  const sessions = await invoke('plugin_api_list_sessions', { pluginId });
  const folders = await invoke('plugin_api_list_folders', { pluginId });

  // Create folder map
  const folderMap = {};
  for (const folder of folders) {
    folderMap[folder.name] = folder.id;
  }

  let organized = 0;

  for (const session of sessions) {
    // Skip already organized sessions
    if (session.folderId) continue;

    // Find matching rule
    const hostLower = session.host.toLowerCase();
    const nameLower = session.name.toLowerCase();

    for (const rule of rules) {
      const pattern = rule.pattern.toLowerCase();

      if (hostLower.includes(pattern) || nameLower.includes(pattern)) {
        // Get or create folder
        let folderId = folderMap[rule.folder];

        if (!folderId) {
          console.log('[Organizer] Creating folder:', rule.folder);
          const newFolder = await invoke('plugin_api_create_folder', {
            pluginId,
            name: rule.folder,
            color: rule.color
          });
          folderId = newFolder.id;
          folderMap[rule.folder] = folderId;
        }

        // Move session to folder
        await invoke('plugin_api_update_session', {
          pluginId,
          id: session.id,
          folderId
        });

        console.log('[Organizer] Moved', session.name, 'to', rule.folder);
        organized++;
        break;
      }
    }
  }

  console.log('[Organizer] Organized', organized, 'sessions');
  return { organized, total: sessions.length };
}

async function addRule(pluginId, pattern, folder, color) {
  const rules = await loadRules(pluginId);
  rules.push({ pattern, folder, color });
  await saveRules(pluginId, rules);
  console.log('[Organizer] Added rule:', pattern, '->', folder);
}

async function removeRule(pluginId, pattern) {
  let rules = await loadRules(pluginId);
  rules = rules.filter(r => r.pattern !== pattern);
  await saveRules(pluginId, rules);
  console.log('[Organizer] Removed rule:', pattern);
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.auto-organizer'] = {
  init,
  loadRules,
  saveRules,
  organize,
  addRule,
  removeRule
};
```

---

## 7. Confirmation Dialog

Use `showModal()` to ask the user for confirmation before performing actions.

### manifest.json
```json
{
  "id": "com.example.confirm-dialog",
  "name": "Confirm Dialog Demo",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "Demonstrates modal dialogs with button variants",
  "main": "index.js",
  "permissions": ["sessions_read", "ui_modals"]
}
```

### index.js
```javascript
async function init(pluginId, api) {
  console.log('[ConfirmDialog] Ready');
}

async function deleteAllSessions(pluginId, api) {
  // Ask for confirmation with a danger modal
  const result = await api.showModal({
    title: 'Delete All Sessions',
    content: 'This will permanently delete all your saved sessions. This action cannot be undone.',
    buttons: [
      { label: 'Cancel', variant: 'secondary' },
      { label: 'Delete All', variant: 'danger' }
    ]
  });

  if (result === 'Delete All') {
    console.log('[ConfirmDialog] User confirmed deletion');
    // Perform the deletion...
  } else {
    console.log('[ConfirmDialog] User cancelled (result:', result, ')');
  }
}

async function showInfo(pluginId, api) {
  // Simple informational modal (no buttons = default "Close" button)
  await api.showModal({
    title: 'About This Plugin',
    content: 'Confirm Dialog Demo v1.0.0\nA simple example of using modal dialogs.'
  });
}

async function showChoices(pluginId, api) {
  // Modal with multiple actions
  const result = await api.showModal({
    title: 'Export Format',
    content: 'Choose the format for exporting your sessions.',
    buttons: [
      { label: 'Cancel', variant: 'secondary' },
      { label: 'CSV', variant: 'secondary' },
      { label: 'JSON', variant: 'primary' }
    ]
  });

  if (result && result !== 'Cancel') {
    console.log('[ConfirmDialog] Exporting as:', result);
  }
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.confirm-dialog'] = {
  init,
  deleteAllSessions,
  showInfo,
  showChoices
};
```

---

## Tips for Your Own Plugins

### 1. Always Handle Errors

```javascript
async function safeInvoke(command, params) {
  try {
    return await invoke(command, params);
  } catch (error) {
    if (error.code === 'permission_denied') {
      console.error('[MyPlugin] Missing permission for:', command);
    } else if (error.code === 'vault_locked') {
      console.log('[MyPlugin] Vault is locked');
    } else {
      console.error('[MyPlugin] Error:', error.message);
    }
    return null;
  }
}
```

### 2. Check Vault Before Access

```javascript
async function useVault(pluginId) {
  const status = await invoke('plugin_api_vault_status', { pluginId });

  if (!status.exists) {
    console.log('Vault not configured');
    return null;
  }

  if (!status.isUnlocked) {
    console.log('Vault is locked');
    return null;
  }

  // Safe to use vault
  return await invoke('plugin_api_vault_read', { pluginId, key: 'my-key' });
}
```

### 3. Clean Up Resources

```javascript
let pollInterval = null;

async function init(pluginId) {
  pollInterval = setInterval(() => pollEvents(pluginId), 1000);
}

function cleanup() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

window.SimplyTermPlugins['my-plugin'] = { init, cleanup };
```

### 4. Use Namespaced Storage

```javascript
const STORAGE_VERSION = 'v1';

async function saveData(pluginId, key, data) {
  await invoke('plugin_storage_write', {
    pluginId,
    path: `${STORAGE_VERSION}/${key}.json`,
    content: JSON.stringify(data)
  });
}
```

### 5. Prefix Your Logs

```javascript
const LOG_PREFIX = '[MyPlugin]';

console.log(LOG_PREFIX, 'Starting...');
console.error(LOG_PREFIX, 'Error:', error);
```

---

## Testing Your Plugin

1. Copy your plugin folder to the plugins directory
2. Open SimplyTerm
3. Go to **Settings** > **Plugins**
4. Click **Refresh**
5. Grant the requested permissions
6. Enable your plugin
7. Open DevTools (`Ctrl+Shift+I` / `Cmd+Option+I`) to see console output

---

**SimplyTerm Plugin API v1.0.0**
