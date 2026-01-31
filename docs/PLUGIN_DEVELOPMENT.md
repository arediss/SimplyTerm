# SimplyTerm Plugin Development Guide

> Create powerful plugins for SimplyTerm in minutes.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Plugin Structure](#plugin-structure)
3. [The manifest.json File](#the-manifestjson-file)
4. [The Plugin API](#the-plugin-api)
5. [Permissions](#permissions)
6. [Practical Examples](#practical-examples)
7. [Best Practices](#best-practices)
8. [Debugging](#debugging)
9. [FAQ](#faq)

---

## Quick Start

### 1. Create your plugin folder

```bash
mkdir -p ~/.simplyterm/plugins/my-plugin
cd ~/.simplyterm/plugins/my-plugin
```

### 2. Create manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A short description of your plugin",
  "main": "index.js",
  "permissions": ["panel:register"]
}
```

### 3. Create index.js

```javascript
function init(api) {
  api.onLoad(() => {
    console.log('Plugin loaded!');
    api.showNotification('My plugin is active!', 'success');
  });

  api.registerPanel({
    id: 'my-panel',
    render: (container) => {
      container.innerHTML = '<h2>Hello World!</h2>';
    }
  });
}

module.exports.default = init;
```

### 4. Activate the plugin

1. Open SimplyTerm
2. Go to **Settings** → **Plugins**
3. Click **Refresh**
4. Enable your plugin

Done! Your plugin is now active.

---

## Plugin Structure

```
~/.simplyterm/plugins/
└── my-plugin/
    ├── manifest.json      # REQUIRED - Plugin metadata
    ├── index.js           # REQUIRED - Entry point
    ├── styles.css         # Optional - Custom styles
    ├── icon.svg           # Optional - Plugin icon
    └── assets/            # Optional - Additional resources
```

---

## The manifest.json File

The manifest defines your plugin's metadata and permissions.

### Complete structure

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Developer",
  "description": "A clear and concise description",
  "main": "index.js",
  "permissions": [
    "panel:register",
    "terminal:read",
    "terminal:write",
    "session:info",
    "storage:read",
    "storage:write",
    "command:register",
    "backend:exec"
  ],
  "panels": [
    {
      "id": "stats-panel",
      "title": "Statistics",
      "icon": "icon.svg",
      "position": "right"
    }
  ],
  "commands": [
    {
      "id": "refresh-data",
      "title": "Refresh Data",
      "shortcut": "Ctrl+Shift+R"
    }
  ]
}
```

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (kebab-case recommended) |
| `name` | string | Display name in UI |
| `version` | string | Semver version (e.g., "1.0.0") |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | Author name |
| `description` | string | Short description |
| `main` | string | Entry file (default: "index.js") |
| `permissions` | string[] | Required permissions |
| `panels` | PanelConfig[] | Panel configuration |
| `commands` | CommandConfig[] | Custom commands |

---

## The Plugin API

Your `init` function receives the `api` object which provides access to all features.

### Lifecycle

```javascript
function init(api) {
  // Called when the plugin is loaded
  api.onLoad(() => {
    console.log('Plugin activated!');
  });

  // Called when the plugin is deactivated
  api.onUnload(() => {
    console.log('Plugin deactivated!');
    // Clean up your resources here
  });
}
```

---

### Panels

Create user interfaces in side panels.

```javascript
api.registerPanel({
  id: 'my-panel',
  render: (container) => {
    // container is a DOM element
    container.innerHTML = `
      <div style="padding: 16px;">
        <h2>My Panel</h2>
        <button id="my-btn">Click me</button>
      </div>
    `;

    // Add event listeners
    container.querySelector('#my-btn').addEventListener('click', () => {
      api.showNotification('Button clicked!', 'success');
    });

    // Return a cleanup function (optional)
    return () => {
      console.log('Panel closed');
    };
  }
});

// Show/hide a panel
api.showPanel('my-panel');
api.hidePanel('my-panel');
```

**Required permission:** `panel:register`

---

### Commands

Register commands accessible via keyboard shortcuts.

```javascript
api.registerCommand({
  id: 'my-command',
  handler: () => {
    console.log('Command executed!');
    api.showNotification('Action performed', 'info');
  }
});

// Execute a command programmatically
api.executeCommand('my-command');
```

**Required permission:** `command:register`

---

### Terminal

Interact with the active terminal.

#### Read terminal output

```javascript
// Listen to everything displayed in the terminal
const unsubscribe = api.onTerminalOutput(sessionId, (data) => {
  console.log('Output:', data);

  // Example: detect an error
  if (data.includes('error')) {
    api.showNotification('Error detected!', 'error');
  }
});

// Stop listening
unsubscribe();
```

**Required permission:** `terminal:read`

#### Write to terminal

```javascript
// Send a command
await api.writeToTerminal(sessionId, 'ls -la\n');

// Send text without executing
await api.writeToTerminal(sessionId, 'echo "Hello"');
```

**Required permission:** `terminal:write`

#### Execute command silently

```javascript
// Run a command without showing it in terminal
const output = await api.execCommand(sessionId, 'hostname');
console.log('Server:', output.trim());
```

**Required permission:** `backend:exec`

---

### Sessions

Access information about active sessions.

```javascript
// Active session
const session = api.getActiveSession();
// Returns: { id, type, host, port, username, status }

if (session) {
  console.log(`Connected to ${session.username}@${session.host}`);
}

// All sessions
const sessions = api.getAllSessions();
sessions.forEach(s => console.log(s.id, s.type));
```

#### Session events

```javascript
// When a new session connects
api.onSessionConnect((session) => {
  console.log('New session:', session.type);
  if (session.type === 'ssh') {
    console.log(`SSH to ${session.host}`);
  }
});

// When a session disconnects
api.onSessionDisconnect((sessionId) => {
  console.log('Session closed:', sessionId);
});
```

**Required permission:** `session:info`

---

### Storage

Store persistent data (scoped per plugin).

```javascript
// Save
await api.storage.set('config', { theme: 'dark', interval: 5000 });
await api.storage.set('counter', 42);

// Retrieve
const config = await api.storage.get('config');
// { theme: 'dark', interval: 5000 }

const counter = await api.storage.get('counter');
// 42

// Delete
await api.storage.delete('counter');
```

**Required permissions:** `storage:read`, `storage:write`

---

### Notifications

Display toast notifications.

```javascript
api.showNotification('Operation successful!', 'success');
api.showNotification('Warning...', 'warning');
api.showNotification('Error!', 'error');
api.showNotification('Information', 'info');
```

**No permission required**

---

### Backend (Advanced)

Call Rust backend functions.

```javascript
try {
  const result = await api.invokeBackend('get_session_info', {
    session_id: 'ssh-123'
  });
  console.log(result);
} catch (error) {
  console.error('Backend error:', error);
}
```

**Required permission:** `backend:exec`

---

## Permissions

Permissions control what your plugin can do.

| Permission | Description |
|------------|-------------|
| `terminal:read` | Read terminal output |
| `terminal:write` | Write to terminal |
| `panel:register` | Create UI panels |
| `command:register` | Create commands |
| `session:info` | Access session info |
| `storage:read` | Read plugin storage |
| `storage:write` | Write to plugin storage |
| `backend:exec` | Call Rust functions |

### Principle of least privilege

Only add permissions you actually need.

```json
// Bad - too many permissions
"permissions": ["terminal:read", "terminal:write", "backend:exec", "storage:read", "storage:write"]

// Good - just what's needed
"permissions": ["panel:register", "session:info"]
```

---

## Practical Examples

### Connection counter plugin

```javascript
function init(api) {
  let connectionCount = 0;

  api.onLoad(async () => {
    // Load saved counter
    const saved = await api.storage.get('count');
    if (saved !== null) connectionCount = saved;
  });

  api.onSessionConnect(async (session) => {
    if (session.type === 'ssh') {
      connectionCount++;
      await api.storage.set('count', connectionCount);
      api.showNotification(`Connection #${connectionCount}`, 'info');
    }
  });

  api.registerPanel({
    id: 'counter-panel',
    render: (container) => {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h2 style="font-size: 48px; color: #7da6e8;">${connectionCount}</h2>
          <p>SSH connections</p>
        </div>
      `;
    }
  });
}

module.exports.default = init;
```

### Quick Commands plugin

```javascript
function init(api) {
  const quickCommands = [
    { name: 'Disk Usage', cmd: 'df -h\n' },
    { name: 'Memory', cmd: 'free -m\n' },
    { name: 'Processes', cmd: 'ps aux | head -20\n' },
  ];

  api.registerPanel({
    id: 'quick-commands',
    render: (container) => {
      container.innerHTML = `
        <div style="padding: 12px;">
          <h3 style="margin: 0 0 12px 0;">Quick Commands</h3>
          ${quickCommands.map((c, i) => `
            <button
              data-index="${i}"
              style="
                display: block;
                width: 100%;
                padding: 8px 12px;
                margin-bottom: 8px;
                background: rgba(255,255,255,0.1);
                border: none;
                border-radius: 6px;
                color: #fff;
                cursor: pointer;
                text-align: left;
              "
            >${c.name}</button>
          `).join('')}
        </div>
      `;

      container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
          const session = api.getActiveSession();
          if (session) {
            const cmd = quickCommands[btn.dataset.index].cmd;
            await api.writeToTerminal(session.id, cmd);
          } else {
            api.showNotification('No active session', 'warning');
          }
        });
      });
    }
  });
}

module.exports.default = init;
```

---

## Best Practices

### 1. Clean up your resources

```javascript
api.onUnload(() => {
  // Stop intervals
  if (myInterval) clearInterval(myInterval);

  // Subscriptions are automatically cleaned up
  // but you can also do it manually
});
```

### 2. Handle errors

```javascript
try {
  await api.writeToTerminal(sessionId, 'command\n');
} catch (error) {
  api.showNotification('Error: ' + error.message, 'error');
  console.error('[MyPlugin]', error);
}
```

### 3. Check session before acting

```javascript
const session = api.getActiveSession();
if (!session) {
  api.showNotification('Connect first', 'warning');
  return;
}

if (session.type !== 'ssh') {
  api.showNotification('SSH only', 'info');
  return;
}
```

### 4. Prefix your logs

```javascript
console.log('[MyPlugin] Message...');
console.error('[MyPlugin] Error:', error);
```

### 5. Use inline styles

Panels don't have access to the app's global styles.

```javascript
container.innerHTML = `
  <div style="
    font-family: system-ui, sans-serif;
    padding: 16px;
    color: #fff;
  ">
    Styled content
  </div>
`;
```

---

## Debugging

### Developer console

1. Launch SimplyTerm
2. Open DevTools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Go to the **Console** tab

### Useful logs

```javascript
// Verify plugin loads
api.onLoad(() => {
  console.log('[MyPlugin] Loaded successfully');
  console.log('[MyPlugin] Active session:', api.getActiveSession());
});

// Log events
api.onSessionConnect((s) => {
  console.log('[MyPlugin] Session connected:', s);
});
```

### Common errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Plugin not found" | Invalid ID in manifest | Check ID matches folder name |
| "Permission denied" | Missing permission | Add permission to manifest |
| "Missing session_id" | Session not checked | Check `getActiveSession()` before acting |

---

## FAQ

### How do I reload my plugin after changes?

1. Disable the plugin in Settings → Plugins
2. Click "Refresh"
3. Re-enable the plugin

### Can I use frameworks (React, Vue)?

No, plugins run in a simple context. Use vanilla JavaScript and template strings.

### Where is my data stored?

```
~/.simplyterm/plugin-data/<plugin-id>/
```

### How do I distribute my plugin?

Create a zip of your plugin folder. Users extract it to `~/.simplyterm/plugins/`.

### Can plugins communicate with each other?

No, each plugin is isolated for security reasons.

---

## Starter Template

Copy this template to get started quickly:

```javascript
/**
 * My Plugin for SimplyTerm
 * @version 1.0.0
 */

function init(api) {
  // === Plugin state ===
  let isActive = false;

  // === Lifecycle ===
  api.onLoad(async () => {
    console.log('[MyPlugin] Loaded');
    isActive = true;

    // Load saved data
    const savedData = await api.storage.get('data');
    if (savedData) {
      console.log('[MyPlugin] Data restored:', savedData);
    }
  });

  api.onUnload(() => {
    console.log('[MyPlugin] Unloaded');
    isActive = false;
  });

  // === Panel ===
  api.registerPanel({
    id: 'my-panel',
    render: (container) => {
      updateUI(container);
      return () => {
        // Cleanup if needed
      };
    }
  });

  // === Events ===
  api.onSessionConnect((session) => {
    console.log('[MyPlugin] New session:', session.type);
  });

  // === Functions ===
  function updateUI(container) {
    const session = api.getActiveSession();
    container.innerHTML = `
      <div style="padding: 16px; font-family: system-ui;">
        <h2 style="color: #fff; margin: 0 0 16px 0;">My Plugin</h2>
        <p style="color: #888;">
          ${session ? `Connected to ${session.host}` : 'Not connected'}
        </p>
        <button id="action-btn" style="
          padding: 8px 16px;
          background: #7da6e8;
          border: none;
          border-radius: 6px;
          color: #1a1a1a;
          cursor: pointer;
        ">Action</button>
      </div>
    `;

    container.querySelector('#action-btn')?.addEventListener('click', handleAction);
  }

  async function handleAction() {
    api.showNotification('Action executed!', 'success');
  }
}

// CommonJS export
module.exports.default = init;
```

---

## Resources

- [SimplyTerm Source Code](https://github.com/arediss/SimplyTerm)
- [Plugin Examples](./PLUGIN_EXAMPLES.md)
- [Report a Bug](https://github.com/arediss/SimplyTerm/issues)
