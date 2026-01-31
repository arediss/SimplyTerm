# SimplyTerm Plugin Examples

> Ready-to-use plugin examples

Copy these examples to `~/.simplyterm/plugins/<name>/` to test them.

---

## Table of Contents

1. [Hello World](#1-hello-world) - Minimal plugin
2. [Session Logger](#2-session-logger) - Connection logging
3. [Quick Commands](#3-quick-commands) - Quick command buttons
4. [Server Monitor](#4-server-monitor) - CPU/RAM monitoring
5. [Command History](#5-command-history) - Command history
6. [SSH Bookmarks](#6-ssh-bookmarks) - Commands per server
7. [Color Theme](#7-color-theme) - Visual customization

---

## 1. Hello World

The simplest possible plugin.

### manifest.json
```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "A minimal plugin to get started",
  "permissions": ["panel:register"]
}
```

### index.js
```javascript
function init(api) {
  api.onLoad(() => {
    api.showNotification('Hello World plugin loaded!', 'success');
  });

  api.registerPanel({
    id: 'hello-panel',
    render: (container) => {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h1 style="font-size: 24px; color: #7da6e8;">Hello!</h1>
          <p style="color: #888; margin-top: 8px;">
            Welcome to SimplyTerm plugins
          </p>
        </div>
      `;
    }
  });
}

module.exports.default = init;
```

---

## 2. Session Logger

Logs all connections with timestamps.

### manifest.json
```json
{
  "id": "session-logger",
  "name": "Session Logger",
  "version": "1.0.0",
  "description": "Log all SSH connections",
  "permissions": ["panel:register", "session:info", "storage:read", "storage:write"]
}
```

### index.js
```javascript
function init(api) {
  let logs = [];

  api.onLoad(async () => {
    const saved = await api.storage.get('logs');
    if (saved) logs = saved;
  });

  api.onSessionConnect(async (session) => {
    if (session.type === 'ssh') {
      const entry = {
        host: session.host,
        user: session.username,
        time: new Date().toISOString(),
        type: 'connect'
      };
      logs.unshift(entry);
      logs = logs.slice(0, 50); // Keep last 50
      await api.storage.set('logs', logs);
      updatePanel();
    }
  });

  api.onSessionDisconnect(async (sessionId) => {
    const entry = {
      sessionId,
      time: new Date().toISOString(),
      type: 'disconnect'
    };
    logs.unshift(entry);
    logs = logs.slice(0, 50);
    await api.storage.set('logs', logs);
    updatePanel();
  });

  api.registerPanel({
    id: 'logger-panel',
    render: (container) => {
      window._loggerContainer = container;
      updatePanel();
    }
  });

  function updatePanel() {
    const container = window._loggerContainer;
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 12px; font-family: system-ui;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; color: #fff; font-size: 14px;">Session Logs</h3>
          <button id="clear-logs" style="
            padding: 4px 8px;
            background: rgba(255,255,255,0.1);
            border: none;
            border-radius: 4px;
            color: #888;
            cursor: pointer;
            font-size: 11px;
          ">Clear</button>
        </div>
        <div style="max-height: 300px; overflow-y: auto;">
          ${logs.length === 0
            ? '<p style="color: #666; text-align: center; padding: 20px;">No logs yet</p>'
            : logs.map(log => `
              <div style="
                padding: 8px;
                margin-bottom: 4px;
                background: rgba(255,255,255,0.05);
                border-radius: 4px;
                font-size: 11px;
              ">
                <span style="color: ${log.type === 'connect' ? '#9cd68d' : '#e88b8b'};">
                  ${log.type === 'connect' ? '→' : '←'}
                </span>
                <span style="color: #aaa; margin-left: 8px;">
                  ${log.host ? `${log.user}@${log.host}` : log.sessionId?.slice(0, 20)}
                </span>
                <span style="color: #666; float: right;">
                  ${new Date(log.time).toLocaleTimeString()}
                </span>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    container.querySelector('#clear-logs')?.addEventListener('click', async () => {
      logs = [];
      await api.storage.set('logs', logs);
      updatePanel();
    });
  }
}

module.exports.default = init;
```

---

## 3. Quick Commands

Buttons to execute frequent commands.

### manifest.json
```json
{
  "id": "quick-commands",
  "name": "Quick Commands",
  "version": "1.0.0",
  "description": "Execute commands with one click",
  "permissions": ["panel:register", "terminal:write", "session:info", "storage:read", "storage:write"]
}
```

### index.js
```javascript
function init(api) {
  let commands = [
    { name: 'Disk Usage', cmd: 'df -h', icon: 'disk' },
    { name: 'Memory', cmd: 'free -m', icon: 'mem' },
    { name: 'Top Processes', cmd: 'ps aux --sort=-%mem | head -10', icon: 'proc' },
    { name: 'Network', cmd: 'netstat -tuln | head -20', icon: 'net' },
    { name: 'Uptime', cmd: 'uptime', icon: 'time' },
  ];

  api.onLoad(async () => {
    const saved = await api.storage.get('commands');
    if (saved) commands = saved;
  });

  api.registerPanel({
    id: 'quick-panel',
    render: (container) => {
      container.innerHTML = `
        <div style="padding: 12px; font-family: system-ui;">
          <h3 style="margin: 0 0 12px 0; color: #fff; font-size: 14px;">
            Quick Commands
          </h3>
          <div id="cmd-list">
            ${commands.map((c, i) => `
              <button data-index="${i}" class="cmd-btn" style="
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 10px 12px;
                margin-bottom: 6px;
                background: linear-gradient(135deg, rgba(125,166,232,0.15), rgba(125,166,232,0.05));
                border: 1px solid rgba(125,166,232,0.2);
                border-radius: 8px;
                color: #ddd;
                cursor: pointer;
                font-size: 13px;
                text-align: left;
                transition: all 0.2s;
              ">
                <span>${c.name}</span>
              </button>
            `).join('')}
          </div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
            <input id="new-cmd-name" placeholder="Name" style="
              width: 45%;
              padding: 6px 8px;
              background: rgba(255,255,255,0.1);
              border: none;
              border-radius: 4px;
              color: #fff;
              font-size: 11px;
              margin-right: 4%;
            "/>
            <input id="new-cmd" placeholder="Command" style="
              width: 45%;
              padding: 6px 8px;
              background: rgba(255,255,255,0.1);
              border: none;
              border-radius: 4px;
              color: #fff;
              font-size: 11px;
            "/>
            <button id="add-cmd" style="
              width: 100%;
              margin-top: 8px;
              padding: 8px;
              background: rgba(125,166,232,0.3);
              border: none;
              border-radius: 6px;
              color: #7da6e8;
              cursor: pointer;
              font-size: 12px;
            ">+ Add Command</button>
          </div>
        </div>
      `;

      // Hover effect
      container.querySelectorAll('.cmd-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'linear-gradient(135deg, rgba(125,166,232,0.25), rgba(125,166,232,0.1))';
          btn.style.borderColor = 'rgba(125,166,232,0.4)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'linear-gradient(135deg, rgba(125,166,232,0.15), rgba(125,166,232,0.05))';
          btn.style.borderColor = 'rgba(125,166,232,0.2)';
        });
      });

      // Execute command
      container.querySelectorAll('.cmd-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const session = api.getActiveSession();
          if (!session) {
            api.showNotification('No active session', 'warning');
            return;
          }
          const cmd = commands[btn.dataset.index].cmd;
          await api.writeToTerminal(session.id, cmd + '\n');
        });
      });

      // Add new command
      container.querySelector('#add-cmd').addEventListener('click', async () => {
        const name = container.querySelector('#new-cmd-name').value.trim();
        const cmd = container.querySelector('#new-cmd').value.trim();
        if (name && cmd) {
          commands.push({ name, cmd, icon: 'custom' });
          await api.storage.set('commands', commands);
          api.showNotification('Command added!', 'success');
          // Re-render
          api.hidePanel('quick-panel');
          api.showPanel('quick-panel');
        }
      });
    }
  });
}

module.exports.default = init;
```

---

## 4. Server Monitor

Displays CPU, RAM, Disk in real-time.

### manifest.json
```json
{
  "id": "server-monitor",
  "name": "Server Monitor",
  "version": "1.0.0",
  "description": "Real-time system monitoring",
  "permissions": ["panel:register", "terminal:read", "terminal:write", "session:info"]
}
```

### index.js
```javascript
function init(api) {
  let stats = { cpu: 0, mem: 0, disk: 0 };
  let interval = null;
  let unsubscribe = null;

  api.onLoad(() => {
    const session = api.getActiveSession();
    if (session?.type === 'ssh') {
      startMonitoring(session.id);
    }
  });

  api.onUnload(() => {
    if (interval) clearInterval(interval);
    if (unsubscribe) unsubscribe();
  });

  api.onSessionConnect((session) => {
    if (session.type === 'ssh') {
      startMonitoring(session.id);
    }
  });

  api.onSessionDisconnect(() => {
    if (interval) clearInterval(interval);
    if (unsubscribe) unsubscribe();
    stats = { cpu: 0, mem: 0, disk: 0 };
    updateUI();
  });

  function startMonitoring(sessionId) {
    // Listen to terminal output
    let buffer = '';
    unsubscribe = api.onTerminalOutput(sessionId, (data) => {
      buffer += data;
      if (buffer.includes('__MONITOR_END__')) {
        parseStats(buffer);
        buffer = '';
      }
    });

    // Poll every 3 seconds
    fetchStats(sessionId);
    interval = setInterval(() => fetchStats(sessionId), 3000);
  }

  async function fetchStats(sessionId) {
    const cmd = `echo "__MONITOR_START__" && ` +
      `echo "CPU:$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}')" && ` +
      `echo "MEM:$(free | awk 'NR==2{printf \"%.0f\", $3*100/$2}')" && ` +
      `echo "DISK:$(df / | awk 'NR==2{print $5}' | tr -d '%')" && ` +
      `echo "__MONITOR_END__"\n`;

    try {
      await api.writeToTerminal(sessionId, cmd);
    } catch (e) {
      console.error('[Monitor]', e);
    }
  }

  function parseStats(output) {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('CPU:')) stats.cpu = parseFloat(line.slice(4)) || 0;
      if (line.startsWith('MEM:')) stats.mem = parseFloat(line.slice(4)) || 0;
      if (line.startsWith('DISK:')) stats.disk = parseFloat(line.slice(5)) || 0;
    }
    updateUI();
  }

  api.registerPanel({
    id: 'monitor-panel',
    render: (container) => {
      window._monitorContainer = container;
      updateUI();
    }
  });

  function updateUI() {
    const container = window._monitorContainer;
    if (!container) return;

    const getColor = (value) => {
      if (value > 80) return '#e88b8b';
      if (value > 60) return '#e8c878';
      return '#9cd68d';
    };

    container.innerHTML = `
      <div style="padding: 12px; font-family: system-ui;">
        <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 14px;">
          Server Monitor
        </h3>

        ${['CPU', 'MEM', 'DISK'].map(key => {
          const value = stats[key.toLowerCase()];
          const color = getColor(value);
          return `
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #888; font-size: 12px;">${key}</span>
                <span style="color: ${color}; font-size: 14px; font-weight: 600;">${value}%</span>
              </div>
              <div style="
                height: 8px;
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                overflow: hidden;
              ">
                <div style="
                  height: 100%;
                  width: ${value}%;
                  background: ${color};
                  border-radius: 4px;
                  transition: width 0.5s, background 0.5s;
                "></div>
              </div>
            </div>
          `;
        }).join('')}

        <p style="color: #666; font-size: 10px; text-align: center; margin-top: 16px;">
          Updated every 3s
        </p>
      </div>
    `;
  }
}

module.exports.default = init;
```

---

## 5. Command History

History of executed commands.

### manifest.json
```json
{
  "id": "cmd-history",
  "name": "Command History",
  "version": "1.0.0",
  "description": "Command history per session",
  "permissions": ["panel:register", "terminal:read", "session:info"]
}
```

### index.js
```javascript
function init(api) {
  let history = [];
  let unsubscribe = null;

  api.onSessionConnect((session) => {
    history = [];
    if (unsubscribe) unsubscribe();

    // Capture inputs (typed commands)
    unsubscribe = api.onTerminalInput(session.id, (data) => {
      // Detect a command (ended by Enter)
      if (data.includes('\r') || data.includes('\n')) {
        const cmd = data.trim();
        if (cmd && cmd.length > 0) {
          history.unshift({
            cmd: cmd.replace(/[\r\n]/g, ''),
            time: new Date()
          });
          history = history.slice(0, 100);
          updateUI();
        }
      }
    });
  });

  api.registerPanel({
    id: 'history-panel',
    render: (container) => {
      window._historyContainer = container;
      updateUI();
    }
  });

  function updateUI() {
    const container = window._historyContainer;
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 12px; font-family: system-ui;">
        <h3 style="margin: 0 0 12px 0; color: #fff; font-size: 14px;">
          Command History
        </h3>
        <div style="max-height: 400px; overflow-y: auto;">
          ${history.length === 0
            ? '<p style="color: #666; text-align: center; padding: 20px;">No commands yet</p>'
            : history.map(h => `
              <div style="
                padding: 8px 10px;
                margin-bottom: 4px;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 12px;
                color: #9cd68d;
                cursor: pointer;
                transition: background 0.2s;
              " class="history-item" data-cmd="${encodeURIComponent(h.cmd)}">
                <span style="opacity: 0.5; margin-right: 8px;">$</span>${h.cmd}
              </div>
            `).join('')}
        </div>
      </div>
    `;

    // Click to re-execute
    container.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255,255,255,0.1)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(255,255,255,0.05)';
      });
      item.addEventListener('click', async () => {
        const session = api.getActiveSession();
        if (session) {
          const cmd = decodeURIComponent(item.dataset.cmd);
          await api.writeToTerminal(session.id, cmd + '\n');
        }
      });
    });
  }
}

module.exports.default = init;
```

---

## 6. SSH Bookmarks

Save commands per server.

### manifest.json
```json
{
  "id": "ssh-bookmarks",
  "name": "SSH Bookmarks",
  "version": "1.0.0",
  "description": "Favorite commands per server",
  "permissions": [
    "panel:register",
    "terminal:write",
    "session:info",
    "storage:read",
    "storage:write"
  ]
}
```

### index.js
```javascript
function init(api) {
  let bookmarks = {}; // { "host": [{ name, cmd }] }
  let currentHost = null;

  api.onLoad(async () => {
    const saved = await api.storage.get('bookmarks');
    if (saved) bookmarks = saved;

    const session = api.getActiveSession();
    if (session?.type === 'ssh') {
      currentHost = session.host;
    }
  });

  api.onSessionConnect((session) => {
    if (session.type === 'ssh') {
      currentHost = session.host;
      updateUI();
    }
  });

  api.onSessionDisconnect(() => {
    currentHost = null;
    updateUI();
  });

  api.registerPanel({
    id: 'bookmarks-panel',
    render: (container) => {
      window._bookmarksContainer = container;
      updateUI();
    }
  });

  function updateUI() {
    const container = window._bookmarksContainer;
    if (!container) return;

    const hostBookmarks = currentHost ? (bookmarks[currentHost] || []) : [];

    container.innerHTML = `
      <div style="padding: 12px; font-family: system-ui;">
        <h3 style="margin: 0 0 4px 0; color: #fff; font-size: 14px;">
          Bookmarks
        </h3>
        <p style="margin: 0 0 12px 0; color: #666; font-size: 11px;">
          ${currentHost || 'Not connected'}
        </p>

        ${!currentHost ? `
          <p style="color: #888; text-align: center; padding: 20px;">
            Connect to a server to see bookmarks
          </p>
        ` : `
          <div id="bookmark-list">
            ${hostBookmarks.length === 0
              ? '<p style="color: #666; font-size: 12px; text-align: center;">No bookmarks for this host</p>'
              : hostBookmarks.map((b, i) => `
                <div class="bookmark-item" style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 8px;
                  margin-bottom: 4px;
                  background: rgba(255,255,255,0.05);
                  border-radius: 6px;
                ">
                  <button data-index="${i}" class="run-bookmark" style="
                    flex: 1;
                    padding: 4px 8px;
                    background: transparent;
                    border: none;
                    color: #ddd;
                    text-align: left;
                    cursor: pointer;
                    font-size: 12px;
                  ">
                    <strong>${b.name}</strong>
                    <span style="color: #666; font-size: 10px; display: block;">${b.cmd}</span>
                  </button>
                  <button data-index="${i}" class="del-bookmark" style="
                    padding: 4px 8px;
                    background: transparent;
                    border: none;
                    color: #e88b8b;
                    cursor: pointer;
                  ">x</button>
                </div>
              `).join('')}
          </div>

          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
            <input id="bm-name" placeholder="Name" style="
              width: 100%;
              padding: 8px;
              margin-bottom: 6px;
              background: rgba(255,255,255,0.1);
              border: none;
              border-radius: 4px;
              color: #fff;
              font-size: 12px;
            "/>
            <input id="bm-cmd" placeholder="Command" style="
              width: 100%;
              padding: 8px;
              background: rgba(255,255,255,0.1);
              border: none;
              border-radius: 4px;
              color: #fff;
              font-size: 12px;
            "/>
            <button id="add-bookmark" style="
              width: 100%;
              margin-top: 8px;
              padding: 10px;
              background: linear-gradient(135deg, #7da6e8, #5a8fd8);
              border: none;
              border-radius: 6px;
              color: #fff;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
            ">+ Add Bookmark</button>
          </div>
        `}
      </div>
    `;

    // Run bookmark
    container.querySelectorAll('.run-bookmark').forEach(btn => {
      btn.addEventListener('click', async () => {
        const session = api.getActiveSession();
        if (session) {
          const bm = hostBookmarks[btn.dataset.index];
          await api.writeToTerminal(session.id, bm.cmd + '\n');
        }
      });
    });

    // Delete bookmark
    container.querySelectorAll('.del-bookmark').forEach(btn => {
      btn.addEventListener('click', async () => {
        hostBookmarks.splice(btn.dataset.index, 1);
        bookmarks[currentHost] = hostBookmarks;
        await api.storage.set('bookmarks', bookmarks);
        updateUI();
      });
    });

    // Add bookmark
    container.querySelector('#add-bookmark')?.addEventListener('click', async () => {
      const name = container.querySelector('#bm-name').value.trim();
      const cmd = container.querySelector('#bm-cmd').value.trim();

      if (name && cmd && currentHost) {
        if (!bookmarks[currentHost]) bookmarks[currentHost] = [];
        bookmarks[currentHost].push({ name, cmd });
        await api.storage.set('bookmarks', bookmarks);
        api.showNotification('Bookmark added!', 'success');
        updateUI();
      }
    });
  }
}

module.exports.default = init;
```

---

## 7. Color Theme

Customize panel colors.

### manifest.json
```json
{
  "id": "color-theme",
  "name": "Color Theme",
  "version": "1.0.0",
  "description": "Customize your colors",
  "permissions": ["panel:register", "storage:read", "storage:write"]
}
```

### index.js
```javascript
function init(api) {
  const defaultTheme = {
    primary: '#7da6e8',
    success: '#9cd68d',
    warning: '#e8c878',
    error: '#e88b8b',
    background: '#1a1a1a'
  };

  let theme = { ...defaultTheme };

  api.onLoad(async () => {
    const saved = await api.storage.get('theme');
    if (saved) theme = { ...defaultTheme, ...saved };
  });

  api.registerPanel({
    id: 'theme-panel',
    render: (container) => {
      container.innerHTML = `
        <div style="padding: 16px; font-family: system-ui;">
          <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 14px;">
            Color Theme
          </h3>

          ${Object.entries(theme).map(([key, value]) => `
            <div style="margin-bottom: 12px;">
              <label style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: #aaa;
                font-size: 12px;
                text-transform: capitalize;
              ">
                ${key}
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input
                    type="color"
                    value="${value}"
                    data-key="${key}"
                    class="color-input"
                    style="
                      width: 32px;
                      height: 24px;
                      border: none;
                      border-radius: 4px;
                      cursor: pointer;
                    "
                  />
                  <span style="
                    font-family: monospace;
                    font-size: 10px;
                    color: #666;
                  ">${value}</span>
                </div>
              </label>
            </div>
          `).join('')}

          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button id="save-theme" style="
              flex: 1;
              padding: 10px;
              background: ${theme.primary};
              border: none;
              border-radius: 6px;
              color: #1a1a1a;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
            ">Save</button>
            <button id="reset-theme" style="
              padding: 10px 16px;
              background: rgba(255,255,255,0.1);
              border: none;
              border-radius: 6px;
              color: #888;
              cursor: pointer;
              font-size: 12px;
            ">Reset</button>
          </div>

          <!-- Preview -->
          <div style="margin-top: 16px; padding: 12px; background: ${theme.background}; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; color: #888; font-size: 10px;">Preview</p>
            <div style="display: flex; gap: 8px;">
              ${['primary', 'success', 'warning', 'error'].map(k => `
                <div style="
                  width: 24px;
                  height: 24px;
                  background: ${theme[k]};
                  border-radius: 4px;
                "></div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Color change
      container.querySelectorAll('.color-input').forEach(input => {
        input.addEventListener('input', (e) => {
          theme[e.target.dataset.key] = e.target.value;
        });
      });

      // Save
      container.querySelector('#save-theme').addEventListener('click', async () => {
        await api.storage.set('theme', theme);
        api.showNotification('Theme saved!', 'success');
      });

      // Reset
      container.querySelector('#reset-theme').addEventListener('click', async () => {
        theme = { ...defaultTheme };
        await api.storage.set('theme', theme);
        api.showNotification('Theme reset!', 'info');
        api.hidePanel('theme-panel');
        api.showPanel('theme-panel');
      });
    }
  });
}

module.exports.default = init;
```

---

## Tips for Your Own Plugins

1. **Start simple** - Get one feature working before adding more
2. **Test often** - Disable/re-enable to see changes
3. **Handle errors** - Sessions can be null, APIs can fail
4. **Clean up** - Use `onUnload` to stop intervals/listeners
5. **Log everything** - Use `console.log('[MyPlugin]')` to debug

---

**Happy coding!**
