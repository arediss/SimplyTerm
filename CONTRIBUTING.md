# Contributing to SimplyTerm

Thank you for your interest in contributing to SimplyTerm! This guide will help you get started.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri CLI](https://tauri.app/start/)

### Getting Started

```bash
git clone https://github.com/arediss/SimplyTerm.git
cd SimplyTerm
npm install
npm run tauri dev
```

## How to Contribute

### Reporting Bugs

- Use the [Bug Report](https://github.com/arediss/SimplyTerm/issues/new?template=bug_report.yml) issue template
- Include steps to reproduce, expected vs actual behavior, and your environment details

### Suggesting Features

- Use the [Feature Request](https://github.com/arediss/SimplyTerm/issues/new?template=feature_request.yml) issue template
- Describe the use case and why it would be valuable

### Submitting Code

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
3. Make your changes following the conventions below
4. Run type checking before committing:
   ```bash
   npx tsc --noEmit
   ```
5. Commit using conventional commits (see below)
6. Push and open a Pull Request

## Conventions

### Branch Naming

- `feat/description` — New features
- `fix/description` — Bug fixes
- `chore/description` — Maintenance, docs, CI

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): resolve specific bug
chore(scope): update dependencies
```

Examples:
- `feat(vault): add FIDO2 security key support`
- `fix(terminal): resolve split pane resize issue`
- `chore(ci): update build workflow`

### Code Style

- **TypeScript/React**: Follow existing patterns in `src/`
- **Rust**: Follow existing patterns in `src-tauri/src/`, run `cargo clippy`
- Keep changes focused — one feature or fix per PR
- Don't add unrelated refactoring to feature PRs

### Pull Requests

- Keep PRs small and focused
- Fill in the PR template
- Ensure `npx tsc --noEmit` passes
- Link related issues

## Project Structure

```
simplyterm-app/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── i18n/               # Translations (en, fr)
│   └── utils/              # Utility functions
├── src-tauri/
│   └── src/                # Rust backend
│       ├── storage/        # Vault, sessions, config
│       ├── ssh/            # SSH connection handling
│       └── lib.rs          # Tauri command registration
└── docs/                   # Landing page (GitHub Pages)
```

## Questions?

Open a [discussion](https://github.com/arediss/SimplyTerm/issues) or reach out to the maintainers.
