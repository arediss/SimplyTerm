# SimplyTerm Plugin API v1 Reference

> Complete technical reference for Plugin API v1

---

## Table of Contents

- [Overview](#overview)
- [Manifest Schema](#manifest-schema)
- [Permissions](#permissions)
- [API Modules](#api-modules)
  - [Sessions API](#sessions-api)
  - [Folders API](#folders-api)
  - [Vault API](#vault-api)
  - [Settings API](#settings-api)
  - [Events API](#events-api)
  - [Storage API](#storage-api)
  - [Shell API](#shell-api)
- [TypeScript Types](#typescript-types)
- [Error Handling](#error-handling)

---

## Overview

SimplyTerm plugins are frontend-only (JavaScript/TypeScript) with access to backend APIs via Tauri commands. The API is versioned for stability and backward compatibility.

### Key Concepts

- **Permission-based access**: Plugins must declare required permissions in their manifest
- **Sandboxed storage**: Each plugin has its own isolated data directory
- **Versioned API**: Current version is `1.0.0`

### Plugin Location

Plugins are stored in the application data directory (removed when app is uninstalled):

| OS | Path |
|---|---|
| Windows | `%APPDATA%\com.simplyterm.app\plugins\` |
| macOS | `~/Library/Application Support/com.simplyterm.app/plugins/` |
| Linux | `~/.local/share/com.simplyterm.app/plugins/` |

---

## Manifest Schema

Every plugin requires a `manifest.json` file.

### Required Fields

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "api_version": "1.0.0",
  "description": "A short description",
  "author": "Developer Name",
  "permissions": ["sessions_read", "vault_status"],
  "main": "index.js"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (reverse domain recommended) |
| `name` | string | Display name |
| `version` | string | Plugin version (semver) |
| `api_version` | string | Required API version (must be `1.x.x`) |
| `description` | string | Short description |
| `author` | string | Author name or organization |
| `permissions` | string[] | Required permissions |
| `main` | string | Entry point file |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `homepage` | string | Plugin homepage or repository URL |
| `icon` | string | Relative path to plugin icon |

---

## Permissions

Permissions control what APIs a plugin can access. Users must approve permissions before a plugin can use them.

### Session Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `sessions_read` | Low | Read saved sessions and their configuration |
| `sessions_write` | Medium | Create, modify, and delete saved sessions |
| `sessions_connect` | High | Initiate connections to remote hosts |

### Folder Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `folders_read` | Low | Read folder organization structure |
| `folders_write` | Medium | Create, modify, and delete folders |

### Vault Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `vault_status` | Low | Check if the secure vault is locked or unlocked |
| `vault_read` | High | Read encrypted data from the secure vault |
| `vault_write` | High | Store encrypted data in the secure vault |

### Settings Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `settings_read` | Low | Read application settings and preferences |
| `settings_write` | Medium | Modify application settings and preferences |

### Recent Sessions Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `recent_read` | Low | Read recently used sessions history |
| `recent_write` | Medium | Modify recently used sessions history |

### Event Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `events_subscribe` | Low | Listen to application events |
| `events_emit` | Medium | Send custom events to other plugins |

### Shell Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `shell_execute` | High | Execute shell commands on the local system |

### Network Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `network_http` | Medium | Make HTTP/HTTPS requests to remote servers |
| `network_websocket` | Medium | Establish WebSocket connections |

### File System Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `fs_read` | Low | Read files from plugin data directory |
| `fs_write` | Medium | Write files to plugin data directory |

### UI Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `ui_menu` | Medium | Add items to application menus |
| `ui_notifications` | Medium | Display system notifications |
| `ui_settings` | Medium | Add a settings panel in preferences |
| `ui_panels` | Medium | Register custom panels in the interface |
| `ui_commands` | Medium | Register commands in the command palette |
| `ui_modals` | Medium | Display modal dialogs |

### Terminal Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `terminal_read` | Medium | Read terminal output |
| `terminal_write` | High | Write data to terminal sessions |
| `ui_settings` | Medium | Add a settings panel in preferences |

### Clipboard Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `clipboard_read` | Medium | Read content from system clipboard |
| `clipboard_write` | Medium | Write content to system clipboard |

### Bastion Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `bastions_read` | Low | Read bastion/jump host profiles |
| `bastions_write` | Medium | Create, modify, and delete bastion profiles |

### Known Hosts Permissions

| Permission | Risk | Description |
|------------|------|-------------|
| `known_hosts_read` | Low | Read SSH known hosts entries |
| `known_hosts_write` | Medium | Manage SSH known hosts entries |

---

## API Modules

### Sessions API

Requires: `sessions_read`, `sessions_write`

#### List Sessions

```typescript
invoke('plugin_api_list_sessions', { pluginId: string }): Promise<Session[]>
```

#### Get Session

```typescript
invoke('plugin_api_get_session', { pluginId: string, id: string }): Promise<Session | null>
```

#### Create Session

```typescript
invoke('plugin_api_create_session', {
  pluginId: string,
  name: string,
  host: string,
  port: number,
  username: string,
  authType: 'password' | 'key',
  keyPath?: string,
  folderId?: string,
  color?: string
}): Promise<Session>
```

#### Update Session

```typescript
invoke('plugin_api_update_session', {
  pluginId: string,
  id: string,
  name?: string,
  host?: string,
  port?: number,
  username?: string,
  authType?: string,
  keyPath?: string | null,
  folderId?: string | null,
  color?: string | null
}): Promise<Session>
```

#### Delete Session

```typescript
invoke('plugin_api_delete_session', { pluginId: string, id: string }): Promise<void>
```

---

### Folders API

Requires: `folders_read`, `folders_write`

#### List Folders

```typescript
invoke('plugin_api_list_folders', { pluginId: string }): Promise<Folder[]>
```

#### Create Folder

```typescript
invoke('plugin_api_create_folder', {
  pluginId: string,
  name: string,
  color?: string,
  parentId?: string
}): Promise<Folder>
```

#### Update Folder

```typescript
invoke('plugin_api_update_folder', {
  pluginId: string,
  id: string,
  name?: string,
  color?: string,
  parentId?: string | null,
  expanded?: boolean
}): Promise<Folder>
```

#### Delete Folder

```typescript
invoke('plugin_api_delete_folder', { pluginId: string, id: string }): Promise<void>
```

---

### Vault API

Requires: `vault_status`, `vault_read`, `vault_write`

#### Get Vault Status

```typescript
invoke('plugin_api_vault_status', { pluginId: string }): Promise<VaultStatus>

interface VaultStatus {
  exists: boolean;
  isUnlocked: boolean;
}
```

#### Store Blob

Store encrypted data in the vault (plugin-namespaced).

```typescript
invoke('plugin_api_vault_store', {
  pluginId: string,
  key: string,
  value: string
}): Promise<void>
```

#### Read Blob

```typescript
invoke('plugin_api_vault_read', {
  pluginId: string,
  key: string
}): Promise<string | null>
```

#### Delete Blob

```typescript
invoke('plugin_api_vault_delete', {
  pluginId: string,
  key: string
}): Promise<boolean>
```

---

### Settings API

Requires: `settings_read`, `settings_write`

#### Get Settings

```typescript
invoke('plugin_api_get_settings', { pluginId: string }): Promise<Settings>

interface Settings {
  terminal: TerminalSettings;
  appearance: AppearanceSettings;
  ui: UiSettings;
}
```

#### Update Terminal Settings

```typescript
invoke('plugin_api_update_terminal_settings', {
  pluginId: string,
  fontSize?: number,
  fontFamily?: string,
  cursorStyle?: string,
  cursorBlink?: boolean,
  scrollback?: number
}): Promise<TerminalSettings>
```

#### Update Appearance Settings

```typescript
invoke('plugin_api_update_appearance_settings', {
  pluginId: string,
  theme?: string,
  accentColor?: string
}): Promise<AppearanceSettings>
```

---

### Events API

Requires: `events_subscribe`, `events_emit`

#### Available Events

| Event | Description |
|-------|-------------|
| `session_connected` | Session connected |
| `session_disconnected` | Session disconnected |
| `vault_locked` | Vault locked |
| `vault_unlocked` | Vault unlocked |
| `settings_changed` | Settings changed |
| `theme_changed` | Theme changed |
| `session_created` | Session created |
| `session_updated` | Session updated |
| `session_deleted` | Session deleted |
| `folder_created` | Folder created |
| `folder_updated` | Folder updated |
| `folder_deleted` | Folder deleted |
| `tab_opened` | Tab opened |
| `tab_closed` | Tab closed |
| `tab_switched` | Tab switched |

#### Subscribe to Events

```typescript
invoke('plugin_api_subscribe_events', {
  pluginId: string,
  events: string[]
}): Promise<void>
```

#### Emit Custom Event

```typescript
invoke('plugin_api_emit_event', {
  pluginId: string,
  eventName: string,
  data: any
}): Promise<void>
```

#### Get Pending Events

```typescript
invoke('plugin_api_get_events', { pluginId: string }): Promise<EventPayload[]>

interface EventPayload {
  event: string;
  source: string;
  timestamp: number;
  data: any;
}
```

---

### Storage API

Requires: `fs_read`, `fs_write`

Sandboxed file storage for each plugin.

#### Read File

```typescript
invoke('plugin_storage_read', {
  pluginId: string,
  path: string
}): Promise<string>
```

#### Write File

```typescript
invoke('plugin_storage_write', {
  pluginId: string,
  path: string,
  content: string
}): Promise<void>
```

#### Delete File

```typescript
invoke('plugin_storage_delete', {
  pluginId: string,
  path: string
}): Promise<void>
```

#### List Directory

```typescript
invoke('plugin_storage_list', {
  pluginId: string,
  path: string
}): Promise<FileEntry[]>

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}
```

---

### Terminal API

Requires: `terminal_read`, `terminal_write`

Interact with terminal sessions.

#### Write to Terminal

```typescript
invoke('plugin_api_write_to_terminal', {
  pluginId: string,
  sessionId: string,
  data: string
}): Promise<void>
```

#### Listen to Terminal Output

Use Tauri events to listen to terminal output:

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen to output from a specific session
const unlisten = await listen(`pty-output-${sessionId}`, (event) => {
  console.log('Terminal output:', event.payload);
});

// Clean up when done
unlisten();
```

#### Listen to Terminal Input

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen to input sent to a specific session
const unlisten = await listen(`pty-input-${sessionId}`, (event) => {
  console.log('Terminal input:', event.payload);
});
```

---

### UI API

Requires: `ui_panels`, `ui_commands`, `ui_notifications`, `ui_modals`

Register UI components and interact with the interface.

#### Register a Panel

```typescript
// In your plugin's init function
api.registerPanel({
  id: 'my-panel',
  render: (container) => {
    container.innerHTML = '<div>My Panel Content</div>';
  }
});
```

#### Register a Command

```typescript
api.registerCommand({
  id: 'my-command',
  title: 'My Command',
  shortcut: 'Ctrl+Shift+M',
  handler: () => {
    console.log('Command executed!');
  }
});
```

#### Show Notification

```typescript
api.showNotification('Hello from my plugin!', 'success');
// Types: 'info' | 'success' | 'warning' | 'error'
```

#### Show Modal

```typescript
const result = await api.showModal({
  title: 'Confirm Action',
  content: 'Are you sure?',
  buttons: [
    { label: 'Cancel', variant: 'secondary' },
    { label: 'Confirm', variant: 'primary' }
  ]
});
```

---

### Shell API

Requires: `shell_execute`

Execute whitelisted shell commands.

#### Allowed Commands

- Network: `ping`, `curl`, `wget`, `nslookup`, `dig`, `host`, `traceroute`, `tracert`
- File utilities: `cat`, `head`, `tail`, `less`, `more`, `wc`
- System info: `date`, `uptime`, `whoami`, `hostname`, `uname`
- Git: `git` (read-only operations)
- SSH: `ssh-keygen`, `ssh-keyscan`

#### Execute Command

```typescript
invoke('plugin_api_shell_execute', {
  pluginId: string,
  command: string,
  args: string[],
  workingDir?: string
}): Promise<CommandResult>

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
  truncated: boolean;
}
```

---

## TypeScript Types

### Session

```typescript
interface Session {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  keyPath?: string;
  folderId?: string;
  color?: string;
}
```

### Folder

```typescript
interface Folder {
  id: string;
  name: string;
  color?: string;
  parentId?: string;
  order: number;
  expanded: boolean;
}
```

### Settings

```typescript
interface Settings {
  terminal: {
    fontSize: number;
    fontFamily: string;
    cursorStyle: string;
    cursorBlink: boolean;
    scrollback: number;
  };
  appearance: {
    theme: string;
    accentColor: string;
  };
  ui: {
    statusBarVisible: boolean;
  };
}
```

---

## Error Handling

All API calls return errors with a consistent structure:

```typescript
interface PluginError {
  code: 'permission_denied' | 'not_found' | 'invalid_input' | 'storage_error' | 'vault_locked' | 'internal_error';
  message: string;
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `permission_denied` | Plugin doesn't have required permission |
| `not_found` | Requested resource doesn't exist |
| `invalid_input` | Invalid parameters provided |
| `storage_error` | File system or storage error |
| `vault_locked` | Vault must be unlocked for this operation |
| `internal_error` | Unexpected internal error |

### Example Error Handling

```typescript
try {
  const sessions = await invoke('plugin_api_list_sessions', { pluginId: 'my-plugin' });
} catch (error) {
  if (error.code === 'permission_denied') {
    console.error('Missing sessions_read permission');
  } else {
    console.error('Error:', error.message);
  }
}
```

---

**SimplyTerm Plugin API v1.0.0**
