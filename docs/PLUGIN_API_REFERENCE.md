# SimplyTerm Plugin API Reference

> Complete technical reference for the Plugin API

---

## Table of Contents

- [TypeScript Types](#typescript-types)
- [API Methods](#api-methods)
- [Events](#events)
- [Manifest Schema](#manifest-schema)

---

## TypeScript Types

### SessionInfo

```typescript
interface SessionInfo {
  id: string;                                    // Unique session identifier
  type: 'local' | 'ssh' | 'sftp';               // Connection type
  host?: string;                                 // Host (SSH only)
  port?: number;                                 // Port (SSH only)
  username?: string;                             // User (SSH only)
  status: 'connected' | 'disconnected' | 'connecting';
}
```

### PanelRegistration

```typescript
interface PanelRegistration {
  id: string;                                    // Unique panel ID
  render: (container: HTMLElement) => void | (() => void);
  // render receives a DOM element and can return a cleanup function
}
```

### CommandRegistration

```typescript
interface CommandRegistration {
  id: string;                                    // Unique command ID
  handler: () => void | Promise<void>;          // Function to execute
}
```

### NotificationType

```typescript
type NotificationType = 'info' | 'success' | 'error' | 'warning';
```

### ModalConfig

```typescript
interface ModalConfig {
  title: string;
  content: string | HTMLElement;
  buttons?: ModalButton[];
}

interface ModalButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void | Promise<void>;
}
```

---

## API Methods

### Lifecycle

#### `onLoad(callback)`

Registers a function called when the plugin is activated.

```typescript
onLoad(callback: () => void): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `() => void` | Function called on load |

**Example:**
```javascript
api.onLoad(() => {
  console.log('Plugin ready!');
});
```

---

#### `onUnload(callback)`

Registers a function called when the plugin is deactivated.

```typescript
onUnload(callback: () => void): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `callback` | `() => void` | Cleanup function |

**Example:**
```javascript
api.onUnload(() => {
  clearInterval(myInterval);
});
```

---

### Panels

#### `registerPanel(config)`

Registers a new panel in the interface.

```typescript
registerPanel(config: PanelRegistration): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.id` | `string` | Unique panel identifier |
| `config.render` | `(container: HTMLElement) => void \| (() => void)` | Render function |

**Required permission:** `panel:register`

**Example:**
```javascript
api.registerPanel({
  id: 'my-panel',
  render: (container) => {
    container.innerHTML = '<h1>Hello</h1>';

    // Optional: return a cleanup function
    return () => {
      console.log('Panel closed');
    };
  }
});
```

---

#### `showPanel(panelId)`

Shows a panel.

```typescript
showPanel(panelId: string): void
```

---

#### `hidePanel(panelId)`

Hides a panel.

```typescript
hidePanel(panelId: string): void
```

---

### Commands

#### `registerCommand(config)`

Registers a custom command.

```typescript
registerCommand(config: CommandRegistration): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.id` | `string` | Unique identifier |
| `config.handler` | `() => void \| Promise<void>` | Function to execute |

**Required permission:** `command:register`

---

#### `executeCommand(commandId)`

Executes a registered command.

```typescript
executeCommand(commandId: string): void
```

---

### Terminal

#### `onTerminalOutput(sessionId, callback)`

Listens to terminal output.

```typescript
onTerminalOutput(
  sessionId: string,
  callback: (data: string) => void
): Unsubscribe
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | Session ID to listen to |
| `callback` | `(data: string) => void` | Called on each output |

**Returns:** `() => void` - Function to stop listening

**Required permission:** `terminal:read`

**Example:**
```javascript
const unsubscribe = api.onTerminalOutput(session.id, (data) => {
  if (data.includes('error')) {
    api.showNotification('Error detected', 'error');
  }
});

// Later...
unsubscribe();
```

---

#### `onTerminalInput(sessionId, callback)`

Listens to user input in the terminal.

```typescript
onTerminalInput(
  sessionId: string,
  callback: (data: string) => void
): Unsubscribe
```

**Required permission:** `terminal:read`

---

#### `writeToTerminal(sessionId, data)`

Writes to the terminal.

```typescript
writeToTerminal(sessionId: string, data: string): Promise<void>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | Target session ID |
| `data` | `string` | Text to send (include `\n` to execute) |

**Required permission:** `terminal:write`

**Example:**
```javascript
// Execute a command
await api.writeToTerminal(session.id, 'ls -la\n');

// Send text without executing
await api.writeToTerminal(session.id, 'echo "hello"');
```

---

#### `execCommand(sessionId, command)`

Executes a command in the background without displaying it in the terminal. Returns the command output.

```typescript
execCommand(sessionId: string, command: string): Promise<string>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | Target session ID |
| `command` | `string` | Command to execute |

**Returns:** `Promise<string>` - The command output

**Required permission:** `backend:exec`

**Example:**
```javascript
// Execute silently and get result
const output = await api.execCommand(session.id, 'hostname');
console.log('Server:', output.trim());
```

---

### Sessions

#### `getActiveSession()`

Returns the currently active session.

```typescript
getActiveSession(): SessionInfo | null
```

**Required permission:** `session:info`

**Example:**
```javascript
const session = api.getActiveSession();
if (session && session.type === 'ssh') {
  console.log(`Connected to ${session.username}@${session.host}`);
}
```

---

#### `getAllSessions()`

Returns all open sessions.

```typescript
getAllSessions(): SessionInfo[]
```

**Required permission:** `session:info`

---

#### `onSessionConnect(callback)`

Listens for new connections.

```typescript
onSessionConnect(callback: (session: SessionInfo) => void): Unsubscribe
```

**Required permission:** `session:info`

---

#### `onSessionDisconnect(callback)`

Listens for disconnections.

```typescript
onSessionDisconnect(callback: (sessionId: string) => void): Unsubscribe
```

**Required permission:** `session:info`

---

### Storage

The storage API allows you to persist JSON data. Data is isolated per plugin.

#### `storage.get(key)`

Retrieves a value.

```typescript
storage.get<T>(key: string): Promise<T | null>
```

**Required permission:** `storage:read`

---

#### `storage.set(key, value)`

Saves a value.

```typescript
storage.set<T>(key: string, value: T): Promise<void>
```

**Required permission:** `storage:write`

---

#### `storage.delete(key)`

Deletes a value.

```typescript
storage.delete(key: string): Promise<void>
```

**Required permission:** `storage:write`

**Examples:**
```javascript
// Store data
await api.storage.set('settings', { theme: 'dark' });
await api.storage.set('counter', 42);
await api.storage.set('items', ['a', 'b', 'c']);

// Retrieve
const settings = await api.storage.get('settings'); // { theme: 'dark' }
const counter = await api.storage.get('counter');   // 42
const missing = await api.storage.get('unknown');   // null

// Delete
await api.storage.delete('counter');
```

---

### UI

#### `showNotification(message, type?)`

Displays a toast notification.

```typescript
showNotification(message: string, type?: NotificationType): void
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `message` | `string` | - | Text to display |
| `type` | `NotificationType` | `'info'` | Notification style |

**No permission required**

**Example:**
```javascript
api.showNotification('Operation successful', 'success');
api.showNotification('Warning!', 'warning');
api.showNotification('Critical error', 'error');
api.showNotification('Information', 'info');
```

---

#### `showModal(config)`

Displays a custom modal dialog.

```typescript
showModal(config: ModalConfig): Promise<unknown>
```

---

### Backend

#### `invokeBackend(command, args?)`

Calls a Rust backend function.

```typescript
invokeBackend<T>(command: string, args?: Record<string, unknown>): Promise<T>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | `string` | Backend command name |
| `args` | `object` | Optional arguments |

**Required permission:** `backend:exec`

**Available commands:**

| Command | Arguments | Description |
|---------|-----------|-------------|
| `get_session_info` | `{ session_id: string }` | Session info |

---

## Events

### Event List

| Event | Payload | Description |
|-------|---------|-------------|
| `session-connect` | `SessionInfo` | New session connected |
| `session-disconnect` | `string` (sessionId) | Session closed |
| `pty-output-{sessionId}` | `string` | Terminal output |
| `pty-input-{sessionId}` | `string` | User input |
| `pty-exit-{sessionId}` | `void` | Terminal closed |

---

## Manifest Schema

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "version"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique plugin identifier (kebab-case)"
    },
    "name": {
      "type": "string",
      "description": "Display name"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version"
    },
    "author": {
      "type": "string",
      "description": "Author name"
    },
    "description": {
      "type": "string",
      "description": "Short description"
    },
    "main": {
      "type": "string",
      "default": "index.js",
      "description": "Entry point file"
    },
    "permissions": {
      "type": "array",
      "items": {
        "enum": [
          "terminal:read",
          "terminal:write",
          "panel:register",
          "command:register",
          "backend:exec",
          "storage:read",
          "storage:write",
          "session:info"
        ]
      }
    },
    "panels": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "icon": { "type": "string" },
          "position": { "enum": ["left", "right", "bottom"], "default": "right" }
        }
      }
    },
    "commands": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "shortcut": { "type": "string" }
        }
      }
    }
  }
}
```

### Complete Example

```json
{
  "id": "server-monitor",
  "name": "Server Monitor",
  "version": "2.1.0",
  "author": "Dev Team",
  "description": "Real-time server monitoring for SSH sessions",
  "main": "index.js",
  "permissions": [
    "terminal:read",
    "terminal:write",
    "panel:register",
    "command:register",
    "session:info",
    "storage:read",
    "storage:write"
  ],
  "panels": [
    {
      "id": "monitor-panel",
      "title": "Monitor",
      "icon": "chart.svg",
      "position": "right"
    }
  ],
  "commands": [
    {
      "id": "refresh-stats",
      "title": "Refresh Statistics",
      "shortcut": "Ctrl+Shift+R"
    },
    {
      "id": "export-report",
      "title": "Export Report"
    }
  ]
}
```

---

## File Paths

| Path | Description |
|------|-------------|
| `~/.simplyterm/plugins/` | Plugins directory |
| `~/.simplyterm/plugins/<id>/manifest.json` | Plugin manifest |
| `~/.simplyterm/plugins/<id>/index.js` | Plugin code |
| `~/.simplyterm/plugin-data/<id>/` | Plugin persistent data |
| `~/.simplyterm/plugin-settings.json` | Enabled/disabled plugins |

---

**SimplyTerm Plugin API v1.0**
