# SimplyTerm

A modern, secure SSH terminal client built with Tauri, React, and Rust.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## Features

### Terminal
- Multi-tab and split-pane interface
- Local shell and SSH connections
- Terminal search (Ctrl+F)
- Clickable URLs
- Custom themes (Catppuccin dark)

### SSH
- Password and key-based authentication
- FIDO2/hardware key support
- Session management with folders
- Recent connections history

### SFTP
- Integrated file browser
- External file editing with auto-sync
- Create, rename, delete files and folders

### Port Forwarding
- Local forwarding (-L)
- Remote forwarding (-R)
- Dynamic SOCKS5 proxy (-D)

### Security
- Encrypted credential vault (AES-256-GCM)
- Argon2id key derivation
- PIN code for quick unlock
- Memory zeroization for secrets

### Extensibility
- Plugin system for custom functionality
- Panel and command registration

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Build from source

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/simplyterm.git
cd simplyterm

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Split pane vertically |
| `Ctrl+Shift+E` | Split pane horizontally |
| `Ctrl+Shift+W` | Close current pane |
| `Ctrl+F` | Search in terminal |
| `Escape` | Close modal/search |
| `Enter` | Next search result |
| `Shift+Enter` | Previous search result |

## Project Structure

```
simplyterm/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── plugins/            # Plugin system
│   ├── styles/             # CSS styles
│   └── utils/              # Utility functions
├── src-tauri/              # Rust backend
│   └── src/
│       ├── connectors/     # SSH/SFTP connectors
│       ├── storage/        # Vault and session storage
│       ├── tunnels/        # Port forwarding
│       └── plugins/        # Plugin backend
└── docs/                   # Documentation
```

## Development

```bash
# Start development server
npm run tauri dev

# Run frontend only
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - Desktop app framework
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [Catppuccin](https://github.com/catppuccin/catppuccin) - Color scheme
- [Lucide](https://lucide.dev/) - Icons
- [Claude](https://claude.ai/) - AI assistant by Anthropic
- [JetBrains](https://www.jetbrains.com/) - Development tools
