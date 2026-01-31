# SimplyTerm Plugin Documentation

A modern, extensible SSH terminal with a powerful plugin system.

---

## Documentation

| Document | Description |
|----------|-------------|
| [**Plugin Development Guide**](./PLUGIN_DEVELOPMENT.md) | Complete guide to creating plugins |
| [**Plugin API Reference**](./PLUGIN_API_REFERENCE.md) | Technical API reference |
| [**Plugin Examples**](./PLUGIN_EXAMPLES.md) | Ready-to-use plugin examples |

---

## Quick Start

### Create a plugin in 2 minutes

```bash
# 1. Create the plugin folder
mkdir -p ~/.simplyterm/plugins/my-plugin

# 2. Create the manifest
cat > ~/.simplyterm/plugins/my-plugin/manifest.json << 'EOF'
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "permissions": ["panel:register"]
}
EOF

# 3. Create the code
cat > ~/.simplyterm/plugins/my-plugin/index.js << 'EOF'
function init(api) {
  api.registerPanel({
    id: 'hello',
    render: (c) => { c.innerHTML = '<h1>Hello!</h1>'; }
  });
}
module.exports.default = init;
EOF
```

Open SimplyTerm → Settings → Plugins → Refresh → Enable!

---

## Plugins

### Plugin structure

```
~/.simplyterm/plugins/my-plugin/
├── manifest.json    # Metadata
└── index.js         # Code
```

### Available permissions

```
terminal:read      Read terminal output
terminal:write     Write to terminal
panel:register     Create UI panels
command:register   Create commands
session:info       Access session info
storage:read       Read plugin storage
storage:write      Write to plugin storage
backend:exec       Call backend functions
```

---

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- npm

### Installation

```bash
git clone https://github.com/arediss/SimplyTerm
cd SimplyTerm
npm install
npm run tauri dev
```

### Project structure

```
SimplyTerm/
├── src/                 # React frontend
│   ├── components/      # UI components
│   ├── plugins/         # Plugin system
│   └── App.tsx          # Entry point
├── src-tauri/           # Rust backend
│   └── src/
│       ├── plugins/     # Plugin management
│       ├── connectors/  # SSH, Local
│       └── storage/     # Persistence
└── docs/                # Documentation
```

---

## Plugin Architecture

```
┌─────────────────────────────────────────────────────┐
│                 SimplyTerm App                      │
├─────────────────────────────────────────────────────┤
│  Frontend (React)                                   │
│  ┌─────────────┐  ┌─────────────┐                  │
│  │ PluginHost  │  │PluginPanel  │                  │
│  └──────┬──────┘  └─────────────┘                  │
│         │                                           │
│  ┌──────▼──────────────────────────────────┐       │
│  │         SimplyTerm Plugin API           │       │
│  │  • registerPanel()  • onTerminalOutput()│       │
│  │  • registerCommand()• storage.get/set() │       │
│  └──────┬──────────────────────────────────┘       │
├─────────┼──────────────────────────────────────────┤
│  Backend Rust (Tauri)                              │
│  ┌──────▼──────────────────────────────────┐       │
│  │         PluginManager                   │       │
│  │  • Discover plugins  • Load/unload      │       │
│  │  • Permission check  • Plugin storage   │       │
│  └─────────────────────────────────────────┘       │
└────────────────────────────────────────────────────┘
```

---

## Contributing

1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT - see [LICENSE](../LICENSE) for details.

---

**[Back to top](#simplyterm-plugin-documentation)**
