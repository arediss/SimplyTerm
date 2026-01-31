# SimplyTerm

A modern, secure SSH terminal client built with Tauri, React, and Rust.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

---

## Disclaimer

**SimplyTerm is a learning project.** This is my first open-source project, built primarily for educational purposes and personal use.

### What you should know

- **AI-Assisted** — Some portions of this codebase were written with AI assistance. It's part of my learning process.

- **Expect Bugs** — This is alpha software. Features may be incomplete, unstable, or behave unexpectedly. Use at your own risk, especially in production environments.

- **Security** — While I've implemented security best practices (encrypted vault, host key verification, input sanitization), I'm not a security expert. If you spot vulnerabilities, please report them responsibly.

- **Constructive Feedback Welcome** — I'm here to learn! If you see something that could be improved, I'd love to hear about it. Just please be kind — we're all learning.

- **No Warranty** — This software is provided "as is", without warranty of any kind. See the [LICENSE](LICENSE) file for details.

### Why open source?

I believe in learning in public. By sharing this project, I hope to:
- Get feedback from more experienced developers
- Help others who are also learning
- Contribute something useful to the community

If you're an experienced developer and see room for improvement, PRs and issues are welcome!

---

## Features

### Terminal
- Multi-tab interface with split panes (horizontal/vertical)
- Local shell and SSH connections
- Terminal search with regex support (Ctrl+F)
- Clickable URLs
- Customizable font, cursor style, and scrollback

### SSH
- Password and key-based authentication (RSA, ECDSA, ED25519)
- Host key verification (OpenSSH-compatible known_hosts)
- Session management with folders and tags
- Recent connections history
- Quick reconnect from dropdown menu

### SFTP
- Integrated file browser
- Upload, download, rename, delete files and folders
- Create directories
- External editor integration with auto-sync

### Port Forwarding (Tunnels)
- Local forwarding (-L)
- Remote forwarding (-R)
- Dynamic SOCKS5 proxy (-D)
- Real-time transfer statistics

### Security
- Encrypted credential vault (AES-256-GCM)
- Argon2id key derivation
- Multiple unlock methods:
  - Master password
  - PIN code for quick unlock
  - FIDO2 hardware security keys
- Configurable auto-lock timeout
- Memory zeroization for secrets

### Extensibility
- Plugin system for custom functionality
- Panel and command registration
- Plugin storage with encryption
- See [Plugin Documentation](docs/README.md) for details

### Other
- Command palette (Ctrl+Shift+P)
- Internationalization (English, French)
- Dark theme with customizable accent colors

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

### Build from source

```bash
# Clone the repository
git clone https://github.com/arediss/SimplyTerm.git
cd SimplyTerm

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

---

## Keyboard Shortcuts

### Tabs
| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New local terminal |
| `Ctrl+N` | New SSH connection |
| `Ctrl+W` | Close current tab |
| `Ctrl+Arrow Left` | Previous tab |
| `Ctrl+Arrow Right` | Next tab |

### Panes
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Split pane vertically |
| `Ctrl+Shift+E` | Split pane horizontally |
| `Ctrl+Shift+W` | Close current pane |

### Terminal
| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Search in terminal |
| `Enter` | Next search result |
| `Shift+Enter` | Previous search result |
| `Escape` | Close search |

### General
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+,` | Open settings |

---

## Project Structure

```
SimplyTerm/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── i18n/               # Internationalization
│   ├── plugins/            # Plugin system (frontend)
│   └── styles/             # CSS styles
├── src-tauri/              # Rust backend
│   └── src/
│       ├── connectors/     # SSH/SFTP connectors
│       ├── storage/        # Vault and session storage
│       ├── tunnels/        # Port forwarding
│       └── plugins/        # Plugin system (backend)
├── docs/                   # Plugin documentation
└── .github/workflows/      # CI/CD pipelines
```

---

## Development

```bash
# Start development server (frontend + backend)
npm run tauri dev

# Run frontend only (for UI work)
npm run dev

# Build for production
npm run tauri build
```

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Tauri](https://tauri.app/) - Desktop app framework
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [Lucide](https://lucide.dev/) - Icons
- [russh](https://github.com/warp-tech/russh) - SSH implementation
