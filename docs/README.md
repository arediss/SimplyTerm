# 📚 SimplyTerm Documentation

<div align="center">

<img src="../assets/logo.svg" alt="SimplyTerm Logo" width="120" />

### Terminal SSH moderne, rapide et extensible

[🚀 Quick Start](#quick-start) · [🔌 Plugins](#plugins) · [🛠️ Development](#development)

</div>

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [**Plugin Development Guide**](./PLUGIN_DEVELOPMENT.md) | Guide complet pour créer des plugins |
| [**Plugin API Reference**](./PLUGIN_API_REFERENCE.md) | Référence technique de l'API |
| [**Plugin Examples**](./PLUGIN_EXAMPLES.md) | Exemples de plugins prêts à l'emploi |

---

## 🚀 Quick Start

### Créer un plugin en 2 minutes

```bash
# 1. Créer le dossier
mkdir -p ~/.simplyterm/plugins/mon-plugin

# 2. Créer le manifest
cat > ~/.simplyterm/plugins/mon-plugin/manifest.json << 'EOF'
{
  "id": "mon-plugin",
  "name": "Mon Plugin",
  "version": "1.0.0",
  "permissions": ["panel:register"]
}
EOF

# 3. Créer le code
cat > ~/.simplyterm/plugins/mon-plugin/index.js << 'EOF'
function init(api) {
  api.registerPanel({
    id: 'hello',
    render: (c) => { c.innerHTML = '<h1>Hello!</h1>'; }
  });
}
module.exports.default = init;
EOF
```

Ouvrez SimplyTerm → Paramètres → Plugins → Actualiser → Activer !

---

## 🔌 Plugins

### Plugins inclus

| Plugin | Description |
|--------|-------------|
| **hello-world** | Exemple basique |
| **server-stats** | Monitoring CPU/RAM/Disk |

### Structure d'un plugin

```
~/.simplyterm/plugins/mon-plugin/
├── manifest.json    # Métadonnées
└── index.js         # Code
```

### Permissions disponibles

```
terminal:read      Lire le terminal
terminal:write     Écrire dans le terminal
panel:register     Créer des panels
command:register   Créer des commandes
session:info       Infos de session
storage:read       Lire le storage
storage:write      Écrire le storage
backend:exec       Appeler le backend
```

---

## 🛠️ Development

### Prérequis

- Node.js 18+
- Rust 1.70+
- pnpm ou npm

### Installation

```bash
git clone https://github.com/your-repo/simplyterm
cd simplyterm
pnpm install
pnpm tauri dev
```

### Structure du projet

```
simplyterm/
├── src/                 # Frontend React
│   ├── components/      # Composants UI
│   ├── plugins/         # Système de plugins
│   └── App.tsx          # Point d'entrée
├── src-tauri/           # Backend Rust
│   └── src/
│       ├── plugins/     # Gestion des plugins
│       ├── connectors/  # SSH, Local
│       └── storage/     # Persistance
└── docs/                # Documentation
```

---

## 🎨 Architecture des plugins

```
┌─────────────────────────────────────────────────────┐
│                 SimplyTerm App                       │
├─────────────────────────────────────────────────────┤
│  Frontend (React)                                    │
│  ┌─────────────┐  ┌─────────────┐                   │
│  │ PluginHost  │  │PluginPanel  │                   │
│  └──────┬──────┘  └─────────────┘                   │
│         │                                            │
│  ┌──────▼──────────────────────────────────┐        │
│  │         SimplyTerm Plugin API            │        │
│  │  • registerPanel()  • onTerminalOutput() │        │
│  │  • registerCommand()• storage.get/set()  │        │
│  └──────┬──────────────────────────────────┘        │
├─────────┼───────────────────────────────────────────┤
│  Backend Rust (Tauri)                                │
│  ┌──────▼──────────────────────────────────┐        │
│  │         PluginManager                    │        │
│  │  • Discover plugins  • Load/unload      │        │
│  │  • Permission check  • Plugin storage   │        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

---

## 📝 Changelog

### v1.0.0

- ✨ Système de plugins extensible
- 🔒 Permissions granulaires
- 💾 Storage persistant par plugin
- 📊 Panels personnalisables

---

## 🤝 Contributing

1. Fork le repo
2. Créez une branche (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Ouvrez une Pull Request

---

## 📄 License

MIT © SimplyTerm

---

<div align="center">

**[⬆ Retour en haut](#-simplyterm-documentation)**

Made with ❤️ by the SimplyTerm community

</div>
