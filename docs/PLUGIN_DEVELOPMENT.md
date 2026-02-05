# SimplyTerm Plugin Development Guide

> Create powerful plugins for SimplyTerm with the API v1

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Plugin Structure](#plugin-structure)
3. [The manifest.json File](#the-manifestjson-file)
4. [Permissions System](#permissions-system)
5. [Using the API](#using-the-api)
6. [Practical Examples](#practical-examples)
7. [Best Practices](#best-practices)
8. [Debugging](#debugging)
9. [FAQ](#faq)

---

## Quick Start

### 1. Find your plugin directory

Plugins are stored in the application data directory:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\com.simplyterm.app\plugins\` |
| macOS | `~/Library/Application Support/com.simplyterm.app/plugins/` |
| Linux | `~/.local/share/com.simplyterm.app/plugins/` |

### 2. Create your plugin folder

```bash
# Windows (PowerShell)
mkdir "$env:APPDATA\com.simplyterm.app\plugins\my-plugin"

# macOS/Linux
mkdir -p ~/.local/share/com.simplyterm.app/plugins/my-plugin
```

### 3. Create manifest.json

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Your Name",
  "description": "A short description of your plugin",
  "main": "index.js",
  "permissions": ["sessions_read", "fs_read", "fs_write"]
}
```

### 4. Create index.js

```javascript
// Plugin entry point
const { invoke } = window.__TAURI__.core;

async function init(pluginId) {
  console.log('[MyPlugin] Initializing...');

  // Read sessions (requires sessions_read permission)
  try {
    const sessions = await invoke('plugin_api_list_sessions', { pluginId });
    console.log('[MyPlugin] Found sessions:', sessions.length);
  } catch (error) {
    console.error('[MyPlugin] Error:', error);
  }

  // Store some data (requires fs_write permission)
  await invoke('plugin_storage_write', {
    pluginId,
    path: 'config.json',
    content: JSON.stringify({ initialized: true, timestamp: Date.now() })
  });

  console.log('[MyPlugin] Ready!');
}

// Export the init function
window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.my-plugin'] = { init };
```

### 5. Enable the plugin

1. Open SimplyTerm
2. Go to **Settings** → **Plugins**
3. Click **Refresh**
4. Grant permissions when prompted
5. Enable your plugin

---

## Plugin Structure

```
plugins/
└── com.example.my-plugin/
    ├── manifest.json      # REQUIRED - Plugin metadata
    ├── index.js           # REQUIRED - Entry point
    ├── styles.css         # Optional - Custom styles
    ├── icon.svg           # Optional - Plugin icon
    └── assets/            # Optional - Additional resources
```

### Data Directory

Each plugin has an isolated data directory for storing files:

```
plugins/data/
└── com.example.my-plugin/
    ├── config.json
    ├── cache/
    └── ...
```

---

## The manifest.json File

### Complete Example

```json
{
  "id": "com.example.sync-plugin",
  "name": "Config Sync",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "author": "Developer",
  "description": "Sync your sessions and settings across devices",
  "homepage": "https://github.com/example/sync-plugin",
  "main": "index.js",
  "icon": "icon.svg",
  "permissions": [
    "sessions_read",
    "sessions_write",
    "folders_read",
    "folders_write",
    "settings_read",
    "vault_status",
    "vault_read",
    "vault_write",
    "network_http",
    "fs_read",
    "fs_write"
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (reverse domain notation recommended) |
| `name` | string | Display name in UI |
| `version` | string | Semver version (e.g., "1.0.0") |
| `api_version` | string | Required API version (currently "1.0.0") |
| `author` | string | Author name or organization |
| `description` | string | Short description |
| `main` | string | Entry file (e.g., "index.js") |
| `permissions` | string[] | Required permissions |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `homepage` | string | Plugin homepage or repository URL |
| `icon` | string | Relative path to plugin icon |

---

## Permissions System

Plugins must declare all required permissions in their manifest. Users will be prompted to approve these permissions before the plugin can be enabled.

### Permission Categories

| Category | Permissions | Description |
|----------|------------|-------------|
| Sessions | `sessions_read`, `sessions_write`, `sessions_connect` | Access to saved sessions |
| Folders | `folders_read`, `folders_write` | Access to folder structure |
| Vault | `vault_status`, `vault_read`, `vault_write` | Access to encrypted storage |
| Settings | `settings_read`, `settings_write` | Access to app settings |
| Events | `events_subscribe`, `events_emit` | Event system access |
| Storage | `fs_read`, `fs_write` | Sandboxed file storage |
| Shell | `shell_execute` | Execute whitelisted commands |
| Network | `network_http`, `network_websocket` | Network access |
| UI | `ui_menu`, `ui_notifications`, `ui_settings`, `ui_panels`, `ui_commands`, `ui_modals` | UI integration |
| Terminal | `terminal_read`, `terminal_write` | Terminal I/O access |
| Clipboard | `clipboard_read`, `clipboard_write` | Clipboard access |
| Bastions | `bastions_read`, `bastions_write` | Jump host profiles |
| Known Hosts | `known_hosts_read`, `known_hosts_write` | SSH known hosts |

### Risk Levels

| Level | Color | Description |
|-------|-------|-------------|
| Low | Green | Read-only, non-sensitive data |
| Medium | Yellow | Write access or network |
| High | Red | Sensitive data or system access |

### Principle of Least Privilege

Only request permissions you actually need:

```json
// Good - minimal permissions
"permissions": ["sessions_read", "fs_read", "fs_write"]

// Bad - too many permissions
"permissions": ["sessions_read", "sessions_write", "sessions_connect", "vault_read", "vault_write", "shell_execute"]
```

---

## Using the API

### Basic Pattern

All API calls use Tauri's `invoke` function:

```javascript
const { invoke } = window.__TAURI__.core;

async function example(pluginId) {
  try {
    const result = await invoke('command_name', { pluginId, ...params });
    return result;
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### Sessions API

```javascript
// List all sessions
const sessions = await invoke('plugin_api_list_sessions', { pluginId });

// Create a session
const newSession = await invoke('plugin_api_create_session', {
  pluginId,
  name: 'My Server',
  host: 'example.com',
  port: 22,
  username: 'admin',
  authType: 'key',
  keyPath: '~/.ssh/id_rsa'
});

// Update a session
await invoke('plugin_api_update_session', {
  pluginId,
  id: session.id,
  name: 'New Name'
});

// Delete a session
await invoke('plugin_api_delete_session', { pluginId, id: session.id });
```

### Storage API (Sandboxed)

```javascript
// Write a file
await invoke('plugin_storage_write', {
  pluginId,
  path: 'data/config.json',
  content: JSON.stringify({ key: 'value' })
});

// Read a file
const content = await invoke('plugin_storage_read', {
  pluginId,
  path: 'data/config.json'
});
const config = JSON.parse(content);

// List directory
const files = await invoke('plugin_storage_list', {
  pluginId,
  path: 'data'
});

// Delete a file
await invoke('plugin_storage_delete', {
  pluginId,
  path: 'data/old-config.json'
});
```

### Vault API (Encrypted Storage)

```javascript
// Check vault status
const status = await invoke('plugin_api_vault_status', { pluginId });
if (!status.isUnlocked) {
  console.log('Vault is locked, cannot access encrypted data');
  return;
}

// Store encrypted data
await invoke('plugin_api_vault_store', {
  pluginId,
  key: 'api-token',
  value: 'secret-token-value'
});

// Read encrypted data
const token = await invoke('plugin_api_vault_read', {
  pluginId,
  key: 'api-token'
});

// Delete encrypted data
await invoke('plugin_api_vault_delete', {
  pluginId,
  key: 'api-token'
});
```

### Settings API

```javascript
// Read settings
const settings = await invoke('plugin_api_get_settings', { pluginId });
console.log('Theme:', settings.appearance.theme);
console.log('Font size:', settings.terminal.fontSize);

// Update appearance
await invoke('plugin_api_update_appearance_settings', {
  pluginId,
  theme: 'dark',
  accentColor: '#7DA6E8'
});
```

### Events API

```javascript
// Subscribe to events
await invoke('plugin_api_subscribe_events', {
  pluginId,
  events: ['session_connected', 'session_disconnected', 'vault_unlocked']
});

// Poll for events (call periodically)
const events = await invoke('plugin_api_get_events', { pluginId });
for (const event of events) {
  console.log(`Event: ${event.event} from ${event.source}`);
  console.log('Data:', event.data);
}

// Emit custom event (for inter-plugin communication)
await invoke('plugin_api_emit_event', {
  pluginId,
  eventName: 'my-custom-event',
  data: { message: 'Hello from my plugin!' }
});
```

---

## Practical Examples

### Config Backup Plugin

```javascript
const { invoke } = window.__TAURI__.core;

async function init(pluginId) {
  console.log('[Backup] Initializing...');

  // Create backup on load
  await createBackup(pluginId);
}

async function createBackup(pluginId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Get all sessions
  const sessions = await invoke('plugin_api_list_sessions', { pluginId });

  // Get all folders
  const folders = await invoke('plugin_api_list_folders', { pluginId });

  // Get settings
  const settings = await invoke('plugin_api_get_settings', { pluginId });

  // Create backup object
  const backup = {
    version: '1.0',
    timestamp,
    sessions,
    folders,
    settings
  };

  // Save backup
  await invoke('plugin_storage_write', {
    pluginId,
    path: `backups/backup-${timestamp}.json`,
    content: JSON.stringify(backup, null, 2)
  });

  console.log('[Backup] Created backup:', timestamp);
}

async function restoreBackup(pluginId, backupPath) {
  // Read backup file
  const content = await invoke('plugin_storage_read', {
    pluginId,
    path: backupPath
  });

  const backup = JSON.parse(content);

  // Restore sessions
  for (const session of backup.sessions) {
    await invoke('plugin_api_create_session', {
      pluginId,
      ...session
    });
  }

  console.log('[Backup] Restored', backup.sessions.length, 'sessions');
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.backup'] = { init, createBackup, restoreBackup };
```

### Session Statistics Plugin

```javascript
const { invoke } = window.__TAURI__.core;

async function init(pluginId) {
  // Subscribe to session events
  await invoke('plugin_api_subscribe_events', {
    pluginId,
    events: ['session_connected', 'session_disconnected']
  });

  // Load stats
  let stats = await loadStats(pluginId);

  // Poll for events
  setInterval(async () => {
    const events = await invoke('plugin_api_get_events', { pluginId });

    for (const event of events) {
      if (event.event === 'session_connected') {
        stats.totalConnections++;
        stats.lastConnection = Date.now();
        await saveStats(pluginId, stats);
      }
    }
  }, 1000);
}

async function loadStats(pluginId) {
  try {
    const content = await invoke('plugin_storage_read', {
      pluginId,
      path: 'stats.json'
    });
    return JSON.parse(content);
  } catch {
    return { totalConnections: 0, lastConnection: null };
  }
}

async function saveStats(pluginId, stats) {
  await invoke('plugin_storage_write', {
    pluginId,
    path: 'stats.json',
    content: JSON.stringify(stats)
  });
}

window.SimplyTermPlugins = window.SimplyTermPlugins || {};
window.SimplyTermPlugins['com.example.stats'] = { init };
```

---

## Best Practices

### 1. Handle Errors Gracefully

```javascript
async function safeInvoke(command, params) {
  try {
    return await invoke(command, params);
  } catch (error) {
    if (error.code === 'permission_denied') {
      console.error('[MyPlugin] Missing permission for:', command);
    } else if (error.code === 'vault_locked') {
      console.log('[MyPlugin] Vault is locked, skipping...');
    } else {
      console.error('[MyPlugin] Error:', error.message);
    }
    return null;
  }
}
```

### 2. Check Vault Status Before Access

```javascript
async function getSecureData(pluginId, key) {
  const status = await invoke('plugin_api_vault_status', { pluginId });

  if (!status.exists) {
    console.log('No vault configured');
    return null;
  }

  if (!status.isUnlocked) {
    console.log('Vault is locked');
    return null;
  }

  return await invoke('plugin_api_vault_read', { pluginId, key });
}
```

### 3. Use Namespaced Storage Keys

```javascript
const STORAGE_PREFIX = 'v1/';

async function saveConfig(pluginId, config) {
  await invoke('plugin_storage_write', {
    pluginId,
    path: `${STORAGE_PREFIX}config.json`,
    content: JSON.stringify(config)
  });
}
```

### 4. Prefix Your Console Logs

```javascript
const LOG_PREFIX = '[MyPlugin]';

console.log(LOG_PREFIX, 'Initializing...');
console.error(LOG_PREFIX, 'Error:', error);
```

### 5. Clean Up Resources

```javascript
let eventPollInterval = null;

function init(pluginId) {
  eventPollInterval = setInterval(() => pollEvents(pluginId), 1000);
}

function cleanup() {
  if (eventPollInterval) {
    clearInterval(eventPollInterval);
    eventPollInterval = null;
  }
}
```

---

## Debugging

### Developer Console

1. Launch SimplyTerm
2. Open DevTools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Go to the **Console** tab

### Debug Logging

```javascript
async function init(pluginId) {
  console.log('[MyPlugin] Starting with ID:', pluginId);

  const sessions = await invoke('plugin_api_list_sessions', { pluginId });
  console.log('[MyPlugin] Found sessions:', sessions);

  const status = await invoke('plugin_api_vault_status', { pluginId });
  console.log('[MyPlugin] Vault status:', status);
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `permission_denied` | Missing permission | Add permission to manifest |
| `vault_locked` | Vault not unlocked | Check vault status first |
| `not_found` | Resource doesn't exist | Check IDs and paths |
| `storage_error` | File system issue | Check file permissions |

---

## FAQ

### Where is my plugin data stored?

In the application data directory under `plugins/data/<plugin-id>/`.

### Can I use npm packages?

Not directly. You need to bundle dependencies with your plugin using a bundler like esbuild or webpack.

### How do I update my plugin?

1. Update your code
2. Increment the version in manifest.json
3. Users will see the new version in Settings → Plugins

### Can plugins communicate with each other?

Yes, via the Events API. Use `events_emit` to send events and `events_subscribe` to receive them.

### How do I distribute my plugin?

Create a zip of your plugin folder. Users extract it to their plugins directory and refresh in settings.

### What happens to plugin data when the app is uninstalled?

Plugin data is stored in the app data directory and is removed when the app is uninstalled.

---

## Resources

- [Plugin API Reference](./PLUGIN_API_REFERENCE.md)
- [Plugin Examples](./PLUGIN_EXAMPLES.md)
- [Report Issues](https://github.com/arediss/SimplyTerm/issues)

---

**SimplyTerm Plugin API v1.0.0**
